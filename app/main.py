"""Wistron PA Server Manager — 後端 (FastAPI)

提供：
- 專案分類（projects）：新增/列出/刪除，機台可掛到某個專案。
- 新增系統：輸入 OS IP/帳號/密碼 + BMC IP/帳號/密碼
  → 後端 SSH 抓 hostname 當系統名稱，並儲存。
- 列出系統（含各機台 OS/BMC 線上狀態，依 ping 判斷）、刪除系統。
- 網頁終端機：WebSocket bridge 到 OS / BMC 的 SSH，前端用 xterm 操作。

安全性註記：
- 目前密碼以明文存在記憶體(僅運行期間)。正式上線前必須加密存放或接秘密管理。
"""
import asyncio
import ipaddress
import node_identity
import equipment_policy
import topology_policy
import copy
import tempfile
from pathlib import Path
from functools import wraps
import json
import kvm_bridge
import network_identity
import os
import re
import subprocess
import threading
import base64
import csv
import datetime
import io
import time
import websockets
import paramiko
from concurrent.futures import ThreadPoolExecutor as _ThreadPoolExecutor


# Integration installs a request-identity binder. This deliberately does not
# copy arbitrary ContextVars (such as held reservations or enrollment secrets).
def _background_target(fn):
    return fn


def _machine_allowed(name, action='read'):
    parent=machines.get(name)
    if parent is None:
        parent=next((m for m in machines.values() if any(e.get('node_id')==name for e in m.get('os',[]) or [])),None)
    return parent is not None and _project_allowed(parent.get('project'), action)


def _project_allowed(project, action='read'):
    # Integration replaces this hook with the verified provider/context.
    return os.environ.get('CYCLE_MODE', 'synthetic') == 'synthetic'


class ThreadPoolExecutor(_ThreadPoolExecutor):
    def submit(self, fn, /, *args, **kwargs):
        return super().submit(_background_target(fn), *args, **kwargs)

import telemetry_core  # System Telemetry 核心（CPU/DIMM/SSD/NIC/GPU 歷史收集）
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field

app = FastAPI(title="Wistron PA Server Manager API")

# 開發用：允許本機檔案直接開
# Integration owns authentication, same-origin policy and route classification.

# ---- 儲存（存成 JSON 檔，重啟後資料仍在；正式可換 DB） ----
# 資料目錄可由環境變數 PA_DATA_DIR 指定（正式版與試用版隔離用）；未設則用程式所在目錄
def _data_dir():
    d = os.environ.get("PA_DATA_DIR")
    if d:
        os.makedirs(d, exist_ok=True)
        return d
    return os.path.dirname(os.path.abspath(__file__))

DATA_FILE = os.path.join(_data_dir(), "data.json")

_DATA_LOAD_ERROR = None

def _load_data():
    global machines, projects, _seq, links, _DATA_LOAD_ERROR
    loaded_machines = {}
    loaded_projects = {}
    loaded_links = []          # 機櫃拓樸連線：[{"a": 名稱, "b": 名稱, "type": "eth"|"ib"|"power"|"coolant"}]
    loaded_seq = 1
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                d = json.load(f)
            if not isinstance(d, dict) or not isinstance(d.get("machines", {}), dict) or not isinstance(d.get("projects", {}), dict) or not isinstance(d.get("links", []) or [], list):
                raise ValueError("Invalid inventory structure")
            loaded_machines = d.get("machines", {})
            loaded_projects = d.get("projects", {})
            loaded_links = d.get("links", []) or []
            loaded_seq = d.get("seq", 1)
        # 遷移：若缺 order 欄位，依插入順序補上
        if not any("order" in p for p in loaded_projects.values()):
            for i, n in enumerate(loaded_projects):
                loaded_projects[n]["order"] = i
        for n, p in loaded_projects.items():
            p.setdefault("order", 0)
        if not any("order" in m for m in loaded_machines.values()):
            for i, n in enumerate(loaded_machines):
                loaded_machines[n]["order"] = i
        for n, m in loaded_machines.items():
            m.setdefault("order", 0)
            m.setdefault("level", "system")   # system = L10 單機; rack = L11 整櫃
        machines, projects, links, _seq = loaded_machines, loaded_projects, loaded_links, loaded_seq
        _DATA_LOAD_ERROR = None
    except Exception as e:
        _DATA_LOAD_ERROR = "Inventory could not be loaded; restore a validated backup and restart"
        raise RuntimeError("Cannot load data.json; restore a validated backup before restarting. No data was saved.") from e



def _reindex_projects():
    """依 order 順序重新整理 projects 的順序。"""
    for i, n in enumerate(sorted(projects, key=lambda k: projects[k].get("order", 0))):
        projects[n]["order"] = i

_DATA_LOCK = threading.RLock()


def _data_transaction(fn):
    """Serialize inventory writers and restore memory on validation/save failure.

    This JSON store supports one application process, as before. A multi-worker
    deployment requires a shared transactional store, not a per-process lock.
    """
    @wraps(fn)
    def wrapped(*args, **kwargs):
        global _seq
        with _DATA_LOCK:
            before = copy.deepcopy((machines, projects, links, _seq))
            try:
                return fn(*args, **kwargs)
            except Exception:
                machines.clear()
                machines.update(before[0])
                projects.clear()
                projects.update(before[1])
                links[:] = before[2]
                _seq = before[3]
                raise
    return wrapped


def _save_data():
    if globals().get("_DATA_LOAD_ERROR"):
        raise HTTPException(503, _DATA_LOAD_ERROR)
    tmp = None
    with _DATA_LOCK:
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8",
                    dir=os.path.dirname(os.path.abspath(DATA_FILE)),
                    prefix=".pa-data-", suffix=".tmp", delete=False) as f:
                tmp = f.name
                if os.path.exists(DATA_FILE):
                    os.chmod(tmp, os.stat(DATA_FILE).st_mode & 0o777)
                json.dump({"machines": machines, "projects": projects,
                           "links": links, "seq": _seq}, f,
                          ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, DATA_FILE)
        except Exception as exc:
            raise HTTPException(503, "資料無法儲存，變更尚未寫入") from exc
        finally:
            if tmp and os.path.exists(tmp):
                try:
                    os.unlink(tmp)
                except OSError:
                    pass


def _rack_integer(value, field, low, high):
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        raise HTTPException(400, f"{field} must be an integer in {low}..{high}")
    return value


def _validate_rack(candidate, name):
    mount = candidate.get("rack_mount", "internal")
    if mount not in ("internal", "external"):
        raise HTTPException(400, "rack_mount must be internal or external")
    is_cdu = telemetry_core.kind_of(candidate, name) == "cdu"
    if mount == "external" and (candidate.get("level") != "rack" or not is_cdu):
        raise HTTPException(400, "Only rack CDU equipment supports external installation")
    if candidate.get("level") != "rack":
        return
    if candidate.get("rack_side", "front") not in ("front", "rear"):
        raise HTTPException(400, "rack_side must be front or rear")
    project = candidate.get("project") or ""
    if project and project not in projects:
        raise HTTPException(400, "Project does not exist")
    if is_cdu and project:
        for other_name, other in machines.items():
            if (other_name != name and other.get("level") == "rack"
                    and other.get("project") == project
                    and telemetry_core.kind_of(other, other_name) == "cdu"):
                raise HTTPException(409, f"This rack already has a CDU: {other_name}; edit its installation instead")
    if mount == "external":
        if not project:
            raise HTTPException(400, "An external CDU requires a project")
        # External equipment belongs to the rack but never occupies a U range.
        candidate["rack_u"] = 0
        candidate["rack_size"] = 0
        return
    u = _rack_integer(candidate.get("rack_u", 0), "rack_u", 0, 48)
    size = _rack_integer(candidate.get("rack_size", 1), "rack_size", 1, 48)
    if not u:
        return
    if not project or u - size + 1 < 1:
        raise HTTPException(400, "Placed components require a project and a complete U1..U48 range")
    if is_cdu and u != size:
        raise HTTPException(400, "An internal CDU must occupy the bottom U1..U{size}".format(size=size))
    # No depth metadata exists: both faces share the same physical U occupancy.
    for other_name, other in machines.items():
        if (other_name == name or other.get("level") != "rack" or other.get("project") != project
                or other.get("rack_mount", "internal") == "external"):
            continue
        top = other.get("rack_u", 0)
        height = other.get("rack_size", 1)
        if not isinstance(top, int) or top <= 0:
            continue
        if not isinstance(height, int) or height < 1 or top > 48 or top-height+1 < 1:
            raise HTTPException(409, f"Existing rack placement is invalid: {other_name}")
        if max(u-size+1, top-height+1) <= min(u, top):
            raise HTTPException(409, f"Rack U range overlaps {other_name}")


machines = {}    # hostname -> dict
projects = {}    # name -> {name, desc}
links = []       # 機櫃拓樸連線：[{"a", "b", "type"}]
_seq = 1
_load_data()


class AddRackPassive(BaseModel):
    name: str = ""
    mgx_type: str = "switch"
    project: str = ""
    rack_u: int = Field(default=1, strict=True, ge=0, le=48)
    rack_mount: str = "internal"
    rack_side: str = "front"
    manage_ip: str = ""
    rack_size: int = Field(default=1, strict=True, ge=0, le=48)


class OsEntry(BaseModel):
    """機框內單一 OS 的連線資訊（多 OS 機框用）。slot 由後端指派。"""
    ip: str
    user: str
    pass_: str = Field(..., alias="pass")
    port: int = 22
    label: str = ""
    bmc_ip: str = ""
    bmc_user: str = ""
    bmc_pass: str = ""
    bmc_ssh_port: int = Field(22, strict=True, ge=1, le=65535)
    ipmi_port: int = Field(623, strict=True, ge=1, le=65535)


class AddMachine(BaseModel):
    os_ip: str = Field(..., description="OS IP")
    os_user: str
    os_pass: str
    bmc_ip: str = ""
    bmc_user: str = ""
    bmc_pass: str = ""
    os_port: int = 22
    bmc_port: int = 22
    project: str = ""
    level: str = "system"   # 'system' = L10 單機; 'rack' = L11 整櫃
    rack_size: int = 1      # L11 rack level 用：機櫃占用高度（U 數）
    os: list[OsEntry] = []  # 多 OS 機框：額外 OS（os[0]=os_ip 為主 OS，此為 os[1..]）
    model_config = {"populate_by_name": True}


class AddProject(BaseModel):
    name: str
    desc: str = ""


def ssh_run(host, user, password, port, command, timeout=8):
    cmd = [
        "sshpass", "-p", password,
        "ssh", "-p", str(port),
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        "-o", "ConnectTimeout=5",
        "-o", "NumberOfPasswordPrompts=1",
        f"{user}@{host}",
        command,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        out = r.stdout.strip()
        return out, r.returncode, (r.stderr or "").strip()
    except subprocess.TimeoutExpired:
        return None, -1, "SSH 連線逾時"


def ssh_ipmi(m, sub_args, timeout=25):
    """在受控 OS 內執行本機 ipmitool（-I open），回 (stdout, rc, stderr)。
    有些 BMC 的 OOB cipher 設定（-C 17）只有透過 OS 本機 ipmitool 才穩，
    且診斷時直接抓本機 SEL/sensor 最貼近真實。OS 不可連時 fallback 到 OOB。"""
    if m.get("passive"):
        return "", -1, "無 OS"
    if m.get("os_ip") and m.get("os_user") and m.get("os_pass"):
        cmd = "ipmitool -I open " + " ".join(sub_args)
        out, rc, err = ssh_run(m["os_ip"], m.get("os_user",""), m.get("os_pass",""),
                               m.get("os_port",22), cmd, timeout=timeout)
        if rc == 0 and out:
            return out, rc, err
        if rc == 0 and sub_args[0] == "sdr":   # sdr 可能全空但也算成功
            return out, rc, err
        # 本機 ipmitool 失敗 → fallback OOB
    if m.get("bmc_ip") and m.get("bmc_user") and m.get("bmc_pass"):
        cmd = _ipmi_cmd(m, sub_args)
        if cmd:
            try:
                r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
                return (r.stdout or "").strip(), r.returncode, (r.stderr or "").strip()
            except Exception as e:
                return "", -1, str(e)
    return "", -1, "無法執行 ipmitool（無 OS 且無 BMC）"


def _ipmi_local(m, sub_args, timeout=25):
    """同 ssh_ipmi 但回傳字串，OS 不可連時用 OOB。失敗回空字串。"""
    out, rc, err = ssh_ipmi(m, sub_args, timeout)
    return out or err or ""


def ping_check(ip, timeout=3):
    """ping 一個 IP，回傳是否『線上』。"""
    if not ip:
        return False
    cmd = ["ping", "-c", "1", "-W", str(timeout), ip]
    # -c 1: 只送一次; -W: 逾時秒數
    try:
        from probe_budget import ping_slot
        with ping_slot:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 3)
        return r.returncode == 0
    except Exception:
        return False


# ---- BMC 控制 / 讀取（ipmitool / redfish）----
# 額設 cipher suite：fleet_l OpenBMC 需 -C 17（HMAC-SHA1），其他廠牌 BMC 若不接受可設 IPMI_CIPHER=3。
_IPMI_CIPHER = os.environ.get("IPMI_CIPHER", "17")

def _ipmi_cmd(m, sub_args):
    """組 ipmitool 命令（統一 -I lanplus -H -U -P -C cipher + 子指令）。
    依使用者指定格式：ipmitool -I lanplus -H <BMC_IP> -U <user> -P <pass> -C 17 <sub...>。
    sub_args 例如 ["chassis","power","status"]。
    machine.use_c17 為 False 時改用 3（或 IPMI_CIPHER 環境變數），即「不加 -C 17」。"""
    if not m.get("bmc_ip") or not m.get("bmc_user") or not m.get("bmc_pass"):
        return None
    cipher = _IPMI_CIPHER if m.get("use_c17", True) else (os.environ.get("IPMI_CIPHER_NO17", "3"))
    return ["ipmitool", "-I", "lanplus",
            "-H", m["bmc_ip"], "-U", m["bmc_user"], "-P", m["bmc_pass"],
            "-C", cipher] + sub_args


# ---- 自訂開關機 / AUX(AC cycle) 指令（變數代入）----
# 每台元件可存 power_on_cmd / power_off_cmd / aux_cmd；
# 用變數 $BMC_IP $BMC_USER $BMC_PW $BMC_PORT $OS_IP 等代入。留空則用預設 ipmitool。
_VAR_KEYS = {
    "${BMC_IP}": lambda m: m.get("bmc_ip", ""),
    "$BMC_IP": lambda m: m.get("bmc_ip", ""),
    "${BMC_USER}": lambda m: m.get("bmc_user", ""),
    "$BMC_USER": lambda m: m.get("bmc_user", ""),
    "${BMC_AC}": lambda m: m.get("bmc_user", ""),
    "$BMC_AC": lambda m: m.get("bmc_user", ""),
    "${BMC_PW}": lambda m: m.get("bmc_pass", ""),
    "$BMC_PW": lambda m: m.get("bmc_pass", ""),
    "${BMC_PASS}": lambda m: m.get("bmc_pass", ""),
    "$BMC_PASS": lambda m: m.get("bmc_pass", ""),
    "${BMC_PORT}": lambda m: str(m.get("bmc_port", 623)),
    "$BMC_PORT": lambda m: str(m.get("bmc_port", 623)),
    "${OS_IP}": lambda m: m.get("os_ip", ""),
    "$OS_IP": lambda m: m.get("os_ip", ""),
}
def subst_vars(tpl, m):
    out = tpl
    for k, fn in _VAR_KEYS.items():
        out = out.replace(k, fn(m) or "")
    return out

def run_control_cmd(m, action):
    """執行開/關/aux 自訂指令。action in {'poweron','poweroff','aux'}。
    優先：自訂指令（有填就用）→ 預設 ipmitool。回 (ok, info)。"""
    if action == "poweron":
        cmd_tpl = m.get("power_on_cmd") or ""
    elif action == "poweroff":
        cmd_tpl = m.get("power_off_cmd") or ""
    else:
        cmd_tpl = m.get("aux_cmd") or ""
    if cmd_tpl:
        cmd0 = subst_vars(cmd_tpl, m)
        # use_c17 關閉時，將自訂指令中的「-C 17」移除（例如改為 -C 3 / 不加）
        if not m.get("use_c17", True):
            cmd0 = cmd0.replace(" -C 17", "").replace(" -c 17", "")
        cmd = cmd0
        try:
            # 支援用 shell 執行，方便用戶寫 ipmitool / redfishcurl / ssh 等
            r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
            out = (r.stdout or "").strip() or (r.stderr or "").strip()
            return r.returncode == 0, out or "已送出指令"
        except subprocess.TimeoutExpired:
            return False, "指令執行逾時"
        except Exception as e:
            return False, str(e)
    # 沒有自訂指令 → 預設 ipmitool（僅 power on/off）
    if action == "aux":
        return ipmi_power(m, "cycle")
    return ipmi_power(m, "on" if action == "poweron" else "off")


def _ipmi_cipher_suites():
    """CIMC（Cisco）等多用 cipher suite 3；OpenBMC 需 17。回傳嘗試清單。"""
    env_c = os.environ.get("IPMI_CIPHER")
    if env_c:
        return [env_c]
    return [_IPMI_CIPHER, "3", "1"]


def _ipmi_run_any(m, sub_args, timeout=6):
    """用多種 cipher suite 逐一嘗試 ipmitool（OOB lanplus），取第一個成功者。
    回 (returncode, stdout, stderr)。全失敗回最後一筆結果。"""
    last = (1, "", "")
    for c in _ipmi_cipher_suites():
        cmd = ["ipmitool", "-I", "lanplus",
               "-H", m["bmc_ip"], "-U", m["bmc_user"], "-P", m["bmc_pass"],
               "-C", c] + sub_args
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            last = (r.returncode, (r.stdout or "").strip(), (r.stderr or "").strip())
            if r.returncode == 0 or (r.stderr or "").find("Unable") < 0:
                # 有回應（非 unable to establish）就算成功
                if r.returncode == 0 or r.stdout:
                    return last
        except subprocess.TimeoutExpired:
            last = (124, "", "ipmitool 逾時")
        except Exception as e:
            last = (1, "", str(e))
    return last


def ipmi_power(m, action):
    """對 BMC 下 chassis power 指令。回 (ok, info)。
    優先經 OS 本機 ipmitool -I open（快且兼容 CIMC），失敗才 OOB lanplus cipher fallback。"""
    if not m.get("os_ip") and not m.get("bmc_ip"):
        return False, "無 OS 亦無 BMC 位址，無法控制"
    # 1) OS 本機 -I open
    out, rc, err = ssh_ipmi(m, ["chassis", "power", action], timeout=20)
    if rc == 0 and out:
        ok = "on" in out.lower() or "off" in out.lower() if action == "status" else True
        return ok, out.strip()
    # 2) OOB lanplus cipher fallback
    if m.get("bmc_ip") and m.get("bmc_user") and m.get("bmc_pass"):
        rc2, out2, err2 = _ipmi_run_any(m, ["chassis", "power", action])
        o2 = (out2 or err2 or "").strip()
        ok2 = ("on" in o2.lower() or "off" in o2.lower()) if action == "status" else (rc2 == 0)
        return ok2, o2 or "ipmitool 逾時"
    return False, (err or "ipmitool 逾時").strip()


def ipmi_fw_list(m):
    """抓 BMC firmware 清單（ipmitool mc info）。優先 OS 本機 -I open，失敗 OOB fallback。"""
    out, rc, err = ssh_ipmi(m, ["mc", "info"], timeout=20)
    if rc != 0 or not out:
        if m.get("bmc_ip") and m.get("bmc_user") and m.get("bmc_pass"):
            _, out, _ = _ipmi_run_any(m, ["mc", "info"])
    lines = [l.strip() for l in (out or "").splitlines() if ":" in l]
    return [dict(zip(("key", "value"), (l.split(":", 1)[0].strip(), l.split(":", 1)[1].strip()))) for l in lines[:30]]


def ipmi_sensor_summary(m):
    """抓 sensor 摘要，回傳 critical/warning 的筆數與清單 + 完整 SDR 供下拉框。
    優先透過 OS 本機 ipmitool（-I open），OS 不可連時用 OOB。"""
    out, rc, err = ssh_ipmi(m, ["sdr", "list"], timeout=25)
    lines = out.splitlines() if out else []
    # 狀態是該行最後一個欄位；只用最後 token 判定，避免 sensor 名稱含 critical
    def status_token(l):
        parts = l.split()
        return parts[-1].lower() if parts else ""
    ok_n = crit = warn = ns = 0
    crit_entries, warn_entries, ns_entries, entries = [], [], [], []
    for l in lines:
        st = status_token(l)
        if st in ("cr", "critical"):
            crit += 1
            crit_entries.append(l)
        elif st in ("nc", "warn", "warning"):
            warn += 1
            warn_entries.append(l)
        elif st in ("ok",):
            ok_n += 1
        elif st in ("ns", "nr", "na", "no", "reading", "not_readable"):
            ns += 1
            ns_entries.append(l)
        entries.append(l)
    if not lines:
        return {"error": "sdr 讀取失敗: " + (err.strip() or "無輸出")[:200]}
    return {"total": len(lines), "ok": ok_n, "critical": crit, "warning": warn, "ns": ns,
            "critical_entries": crit_entries[:20], "warning_entries": warn_entries[:20],
            "ns_entries": ns_entries[:20],
            "entries": entries[:400]}


def ssh_login_ok(host, user, password, port=22, timeout=8):
    """用 paramiko 嘗試 SSH 登入，成功回 True（用於驗證 BMC 可連）。"""
    import paramiko
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, port=port, username=user, password=password, timeout=timeout,
                       allow_agent=False, look_for_keys=False)
        # 連上且認證成功即代表可連；嘗試執行一個無害指令（有些 BMC 不支援也無妨）
        try:
            client.exec_command("echo ok")
        except Exception:
            pass
        return True
    except Exception:
        return False
    finally:
        try:
            client.close()
        except Exception:
            pass


@app.post("/api/machines")
@_data_transaction
def add_machine(body: AddMachine):
    global _seq
    if not body.os_ip or not body.os_user or not body.os_pass:
        raise HTTPException(400, "OS IP / 帳號 / 密碼為必填")

    # 1) OS：SSH 抓 hostname（同時驗證 OS 連線）
    hostname, rc, err = ssh_run(body.os_ip, body.os_user, body.os_pass, body.os_port, "hostname")
    if rc != 0 or not hostname:
        raise HTTPException(400, f"OS 連線失敗（SSH）：{err or '無法登入'}")

    # 2) BMC：若有填 BMC IP → ping + SSH 登入 + 在 BMC 內跑 ipmitool lan print 確認 IP 無誤
    if body.bmc_ip:
        if not ping_check(body.bmc_ip):
            raise HTTPException(400, f"BMC 連線失敗（{body.bmc_ip} ping 不到）")
        if body.bmc_user and body.bmc_pass:
            # 2a) 先用 BMC 帳密 SSH 登入（驗證帳密）
            if not ssh_login_ok(body.bmc_ip, body.bmc_user, body.bmc_pass, body.bmc_port):
                raise HTTPException(400, f"BMC SSH 登入失敗（{body.bmc_user}@{body.bmc_ip}:{body.bmc_port}），請確認 BMC 帳密")
            # 2b) 在 BMC console 內跑 ipmitool lan print，確認它回報的 IP == 填入的 BMC IP
            bmc_out, bmc_rc, bmc_err = ssh_run(body.bmc_ip, body.bmc_user, body.bmc_pass,
                                                body.bmc_port, "ipmitool lan print 2>/dev/null", timeout=20)
            reported_ip = None
            for line in (bmc_out or "").splitlines():
                s = line.strip()
                if s.startswith("IP Address") and ":" in s and "Source" not in s:
                    reported_ip = s.split(":", 1)[1].strip()
                    break
            if reported_ip and reported_ip != body.bmc_ip:
                raise HTTPException(400,
                    f"BMC IP 不符：你填的是 {body.bmc_ip}，但 BMC（{body.bmc_user}@{body.bmc_ip}）"
                    f"回報自己的 IP 是 {reported_ip}。請確認填對 BMC 管理網卡。")
            # reported_ip 為 None = BMC 內無 ipmitool 或取不到，不阻擋（2a 已驗證帳密可登入）

    if body.project and body.project not in projects:
        raise HTTPException(400, f"專案不存在: {body.project}")

    name = hostname
    # 衝突檢查：hostname / os_ip / bmc_ip 任一與現有機台重複時明確擋下，
    # 避免「默默覆蓋」造成既有機台消失。允許加入時才寫入。
    conflicts = []
    for mk, mv in machines.items():
        if mk == name:
            conflicts.append(f"主機名稱「{name}」已被 {mk}（專案 {mv.get('project') or '-'}）使用")
        if mv.get("os_ip") and mv["os_ip"] == body.os_ip:
            conflicts.append(f"OS IP {body.os_ip} 已被「{mk}」使用")
        if body.bmc_ip and mv.get("bmc_ip") and mv["bmc_ip"] == body.bmc_ip:
            conflicts.append(f"BMC IP {body.bmc_ip} 已被「{mk}」使用")
        # 多 OS：每個額外 OS 的 IP 也要做衝突檢查（不與其他機台主 OS / 其他 OS 重複）
        for eo in (body.os or []):
            if eo.ip and eo.ip == mv.get("os_ip"):
                conflicts.append(f"OS IP {eo.ip} 已被「{mk}」使用")
            for xo in (mv.get("os") or []):
                if eo.ip and xo.get("ip") == eo.ip:
                    conflicts.append(f"OS IP {eo.ip} 已被「{mk}」的 OS{xo.get('slot')} 使用")
    if conflicts:
        detail = "；".join(dict.fromkeys(conflicts))
        raise HTTPException(400, f"無法新增：偵測到衝突 — {detail}。若確實要重複新增，請先處理既有機台，或確認這是同一個名稱/IP。")

    rec = {
        "id": _seq,
        "name": name,
        "os_ip": body.os_ip,
        "os_user": body.os_user,
        "os_pass": body.os_pass,
        "bmc_ip": body.bmc_ip,
        "bmc_user": body.bmc_user,
        "bmc_pass": body.bmc_pass,
        "os_port": body.os_port,
        "bmc_port": body.bmc_port,
        "project": body.project,
        "level": body.level if body.level in ("system", "rack") else "system",
        "rack_size": body.rack_size if body.level == "rack" else 1,
        "rack_u": 0,   # L11 新增時一律不指定 U（0=未放上機櫃），由 Rack Manager 的＋手動放置
        "use_c17": True,
        "order": max([x.get("order", 0) for x in machines.values()] or [-1]) + 1,
        "created": datetime.datetime.now().isoformat(timespec="seconds"),
    }

    # 多 OS 機框：把 os[0]=主 OS（=os_ip）+ 額外 OS 組成 os 陣列，並驗證每個額外 OS
    os_list = _norm_os_entry({"ip": body.os_ip, "user": body.os_user, "pass": body.os_pass,
                              "port": body.os_port, "label": "OS 1", "bmc_ip": body.bmc_ip, "bmc_user": body.bmc_user, "bmc_pass": body.bmc_pass, "bmc_ssh_port": 22 if body.bmc_port == 623 else body.bmc_port}, 1)
    if os_list:
        os_list = [os_list]
        for i, eo in enumerate(body.os or [], start=2):
            entry = _norm_os_entry({"ip": eo.ip, "user": eo.user, "pass": eo.pass_,
                                    "port": eo.port, "label": eo.label or f"OS {i}", "bmc_ip": getattr(eo,"bmc_ip",""), "bmc_user": getattr(eo,"bmc_user",""), "bmc_pass": eo.bmc_pass, "bmc_ssh_port": eo.bmc_ssh_port, "ipmi_port": eo.ipmi_port}, i)
            if not entry:
                raise HTTPException(400, f"OS {i} 的 IP / 帳號 / 密碼為必填")
            # 驗證額外 OS 可連（SSH hostname）
            h2, rc2, err2 = ssh_run(entry["ip"], entry["user"], entry["pass"], entry["port"], "hostname")
            if rc2 != 0:
                raise HTTPException(400, f"OS {i}（{entry['ip']}）SSH 連線失敗：{err2 or '無法登入'}")
            os_list.append(entry)
        if len(os_list) > 1:
            rec["os"] = os_list
            rec["active_os"] = 1
            _sync_active_os(rec)

    _seq += 1
    _validate_rack(rec, name)
    rec = node_identity.canonical(rec)
    machines[name] = rec
    _save_data()
    return {"ok": True, "machine": _bmc_safe(rec)}


class ProbeBMC(BaseModel):
    machine_name: str = ""
    os_ip: str
    os_user: str = ""
    os_pass: str = ""
    os_port: int = 22
    expected_hostname: str = ""   # 非空時：OS hostname 必須等於此值才抓 BMC IP（變更 IP 用）


def _probe_bmc_ip(os_ip, os_user, os_pass, os_port):
    """在 OS 內用本機 ipmitool lan print 抓 BMC IP Address。
    回 (bmc_ip or None, has_ipmitool, err)。"""
    out, rc, err = ssh_run(os_ip, os_user, os_pass, os_port,
                            "ipmitool lan print 2>/dev/null; ipmitool lan print 1 2>/dev/null; command -v ipmitool",
                            timeout=25)
    if rc != 0:
        return None, False, err or "SSH 執行失敗"
    has_ipmi = False
    bmc_ip = None
    for line in (out or "").splitlines():
        s = line.strip()
        if s == "/usr/bin/ipmitool" or s.endswith("/ipmitool"):
            has_ipmi = True
        if "IP Address" in s and ":" in s:
            v = s.split(":", 1)[1].strip()
            if v and v.lower() != "0.0.0.0" and not (
                s.lower().startswith("ip address source") or "source" in s.lower()):
                bmc_ip = v
    if bmc_ip:
        return bmc_ip, has_ipmi, ""
    return None, has_ipmi, "ipmitool 已安裝但取不到 IP Address"


@app.post("/api/machines/probe-bmc")
def probe_bmc(body: ProbeBMC):
    """新增系統前探測：用 OS SSH 抓 hostname，並用 OS 本機 ipmitool lan print
    自動取得 BMC IP Address（填入表單自動帶入）。若 OS 內無 ipmitool 則回傳
    ipmitool_ok=False，由前端提示需下載/安裝 ipmitool。"""
    if body.machine_name:
        with _DATA_LOCK:
            stored = dict(machines.get(body.machine_name) or {})
        if not stored:
            raise HTTPException(404, "Machine not found")
        if body.os_ip != stored.get("os_ip"):
            raise HTTPException(409, "Target changed; enter explicit SSH credentials for the new IP")
        body.os_user = stored.get("os_user", "")
        body.os_pass = stored.get("os_pass", "")
        body.os_port = stored.get("os_port") or 22
        body.expected_hostname = stored["name"]
    if not body.os_ip or not body.os_user or not body.os_pass or "**" in body.os_pass:
        raise HTTPException(400, "請填 OS IP / SSH 帳號 / 密碼")
    if not 1 <= body.os_port <= 65535:
        raise HTTPException(422, "Invalid SSH port")
    hostname, rc, err = ssh_run(body.os_ip, body.os_user, body.os_pass, body.os_port, "hostname", timeout=12)
    if rc != 0 or not hostname:
        return {"ok": False, "error": f"OS 連線失敗（SSH）：{err or '無法登入'}"}
    hostname = hostname.strip()
    # 變更 IP 場景：必須確認 hostname 與原機台相同（連 hostname 都換了＝換主機，走新增系統）
    if body.expected_hostname and hostname != body.expected_hostname:
        return {"ok": False, "hostname": hostname,
                "error": f"新 OS 的 hostname 是「{hostname}」，與機台名稱「{body.expected_hostname}」不符。"
                         f"（等於換了一台主機，請改用「＋ 新增系統」重新加入，而非變更 IP。）"}
    bmc_ip, has_ipmi, perr = _probe_bmc_ip(body.os_ip, body.os_user, body.os_pass, body.os_port)
    if not has_ipmi:
        return {"ok": False, "hostname": hostname, "ipmitool_ok": False,
                "error": "OS 內未偵測到 ipmitool，無法自動抓取 BMC IP。請先在該主機安裝 ipmitool 後再試。"}
    if not bmc_ip:
        return {"ok": False, "hostname": hostname, "ipmitool_ok": True,
                "error": f"ipmitool 已安裝，但抓取 BMC IP Address 失敗：{perr}"}
    return {"ok": True, "hostname": hostname, "bmc_ip": bmc_ip, "ipmitool_ok": True}


@app.post("/api/rack/passive")
@_data_transaction
def add_rack_passive(body: AddRackPassive):
    """新增一個『純機櫃元件』（switch / power shelf / CDU / PDU / Storage / Network）。
    這類元件通常沒有 OS / BMC IP，無法用 SSH 加入；只需名稱 + 類型 + U 槽（+可選管理 IP）。
    回傳建立的 record，前端再呼叫 rackAssign 指派 project。"""
    global _seq
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(400, "請填元件名稱")
    if name in machines:
        raise HTTPException(400, f"名稱已存在: {name}")
    valid = ("server", "switch", "nvlink", "powershelf", "pdu", "cdu", "storage", "network", "blanking")
    if body.mgx_type not in valid:
        raise HTTPException(400, f"元件類型無效: {body.mgx_type}")
    rec = {
        "id": _seq,
        "name": name,
        "os_ip": "", "os_user": "", "os_pass": "",
        "bmc_ip": body.manage_ip or "", "bmc_user": "", "bmc_pass": "",
        "os_port": 22, "bmc_port": 623,
        "project": body.project or "",
        "level": "rack",
        "mgx_type": body.mgx_type,
        "rack_mount": getattr(body, "rack_mount", "internal"),
        "rack_u": body.rack_u,   # 0 = 未放上機櫃（不佔 U、不顯示在 rack），由 Rack Manager 的＋手動放置
        "rack_side": body.rack_side,
        "rack_size": body.rack_size,
        "use_c17": True,
        "passive": True,
        "order": max([x.get("order", 0) for x in machines.values()] or [-1]) + 1,
        "created": datetime.datetime.now().isoformat(timespec="seconds"),
    }
    _seq += 1
    _validate_rack(rec, name)
    machines[name] = rec
    _save_data()
    return {"ok": True, "machine": _bmc_safe(rec)}


def _machine_candidate(name: str, body: dict):
    """移動機台：可指定 project 與 order。{project, order}
    order 只在同專案內有意義；此處不重新編號，保留各機台手動排定的順序。"""
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    m = copy.deepcopy(machines[name])
    if m.get("level", "system") != "rack" and body.get("level") == "rack":
        raise HTTPException(422, "Use rack-specification with the current equipment snapshot to promote L10")
    if m.get("level") == "rack":
        fixed = {"mgx_type": telemetry_core.kind_of(m, name), "rack_size": m.get("rack_size", 1),
                 "rack_mount": m.get("rack_mount", "internal")}
        for field, value in fixed.items():
            if field in body and (body[field] != value or type(body[field]) is not type(value)):
                raise HTTPException(400, "Existing L11 specifications are fixed: " + field)

    if "project" in body:
        tgt = body["project"]
        if tgt and tgt not in projects:
            raise HTTPException(400, f"專案不存在: {tgt}")
        m["project"] = tgt
    if "order" in body and isinstance(body["order"], (int, float)):
        m["order"] = int(body["order"])
    if body.get("level") == "system" and (telemetry_core.kind_of(m, name) != "server" or (m.get("passive") and m.get("mgx_type") != "server")):
        raise HTTPException(400, "Only servers can be converted to L10")
    if "level" in body and body["level"] in ("system", "rack"):
        m["level"] = body["level"]
    # Rack Manager 擴充欄位：MGX 元件類型 + 機櫃位置（U 數 & 前後排）
    if "mgx_type" in body:
        t = str(body["mgx_type"])
        m["mgx_type"] = t if t in ("server", "switch", "nvlink", "pdu", "powershelf", "cdu", "storage", "network", "blanking") else "server"
    if "rack_mount" in body:
        m["rack_mount"] = body["rack_mount"]
    for field, low in (("rack_u", 0), ("rack_size", 0 if m.get("rack_mount") == "external" else 1)):
        if field in body:
            m[field] = _rack_integer(body[field], field, low, 48)
    if "rack_side" in body:
        if body["rack_side"] not in ("front", "rear"):
            raise HTTPException(400, "rack_side must be front or rear")
        m["rack_side"] = body["rack_side"]
    for f in ("power_on_cmd", "power_off_cmd", "aux_cmd"):
        if f in body:
            m[f] = str(body[f] or "").strip()
    if "use_c17" in body:
        m["use_c17"] = bool(body["use_c17"])
    connection_map = {'os_ip':'ip','os_user':'user','os_pass':'pass','os_port':'port',
                      'bmc_ip':'bmc_ip','bmc_user':'bmc_user','bmc_pass':'bmc_pass',
                      'bmc_port':'bmc_ssh_port','ipmi_port':'ipmi_port'}
    updates={connection_map[k]:v for k,v in body.items() if k in connection_map}
    for field,value in updates.items():
        if field not in {'port','bmc_ssh_port','ipmi_port'} and not isinstance(value,str):
            raise HTTPException(422,'Expected text connection field: '+field)
    if updates and m.get('os') is not None:
        nodes=[e for e in m['os'] if e.get('node_id')==body.get('expected_node_id')]
        if len(nodes)!=1 or node_identity.binding(nodes[0])!=body.get('expected_binding_revision'):
            raise HTTPException(409,'Explicit current node binding required; reload the node editor')
        cur=nodes[0];previous=node_identity.binding(cur)
        for field,value in updates.items():
            if field in {'pass','bmc_pass'}:
                if not value or _is_masked(value): continue
                if value!=cur.get(field): cur['credential_version']=__import__('uuid').uuid4().hex
            if field in {'port','bmc_ssh_port','ipmi_port'} and (type(value) is not int or not 1<=value<=65535):
                raise HTTPException(422,'Invalid connection port')
            if field in {'ip','bmc_ip'} and value:
                try: ipaddress.ip_address(value)
                except ValueError: raise HTTPException(422,'Invalid connection IP')
            if field=='ip' and value and (conflict:=_os_conflict(name,m,value,exclude_slot=cur['slot'])):
                raise HTTPException(409,conflict)
            cur[field]=value
        if previous!=node_identity.binding(cur): cur['binding_revision']=int(cur.get('binding_revision',1))+1
        if m.get('active_os')==cur['slot']: _sync_active_os(m)
    else:
        for field,value in body.items():
            if field in connection_map:
                if field.endswith('_pass') and (not value or _is_masked(value)): continue
                m[field]=value
    _validate_rack(m, name)
    return m


@app.patch("/api/machines/{name}")
@_data_transaction
def edit_machine(name: str, body: dict):
    m = _machine_candidate(name, body)
    machines[name] = m
    _save_data()
    _invalidate_machine_cache(name)
    return {"ok": True, "machine": _bmc_safe(m)}


@app.patch("/api/machines/{name}/rack-specification")
@_data_transaction
def set_rack_specification(name: str, body: dict):
    """Explicit promotion or height correction; ordinary placement stays immutable."""
    if name not in machines:
        raise HTTPException(404, "Machine not found")
    m = copy.deepcopy(machines[name])
    required = {"rack_size", "project", "expected_level", "expected_project",
                "expected_size", "expected_u"}
    if set(body) != required:
        raise HTTPException(422, "Provide height, project and the current equipment snapshot")
    for key, stored in (("level", m.get("level", "system")), ("project", m.get("project", "")),
                        ("size", m.get("rack_size", 1)), ("u", m.get("rack_u", 0))):
        actual = body["expected_" + key]
        if actual != stored or type(actual) is not type(stored):
            raise HTTPException(409, "Equipment changed; reload before updating its height")
    kind = telemetry_core.kind_of(m, name)
    if m.get("level") != "rack" and (kind != "server" or m.get("passive")):
        raise HTTPException(400, "Only L10 servers can be promoted")
    if m.get("rack_mount", "internal") == "external":
        raise HTTPException(400, "External CDU uses the installation workflow, not a U height")
    project = body["project"]
    if (not isinstance(project, str) or (not project and m.get("level") != "rack")
            or (project and (project not in projects or projects[project].get("level") == "system"))):
        raise HTTPException(400, "Select an L11 project")
    if project and m.get("level") != "rack" and projects[project].get("level") != "rack":
        members = [item for item in machines.values() if item.get("project") == project]
        if members and not any(item.get("level") == "rack" for item in members):
            raise HTTPException(400, "Select an empty or L11 project, not a pure L10 project")
    if m.get("level") == "rack" and project != (m.get("project") or ""):
        raise HTTPException(400, "Height correction must stay in the current project")
    size = _rack_integer(body["rack_size"], "rack_size", 1, 48)
    top = m.get("rack_u", 0) if m.get("level") == "rack" else 0
    if kind == "cdu" and top:
        top = size
    m.update(level="rack", project=project, rack_size=size, rack_u=top)
    _validate_rack(m, name)
    machines[name] = m
    _save_data()
    return {"ok": True, "machine": _bmc_safe(m)}


@app.patch("/api/machines/{name}/placement")
@_data_transaction
def place_machine(name: str, body: dict):
    if name not in machines:
        raise HTTPException(404, "Machine not found")
    m = machines[name]
    if m.get("level") != "rack":
        raise HTTPException(400, "Only existing L11 equipment can be placed")
    if set(body) - {"rack_u", "expected_project"} or "rack_u" not in body:
        raise HTTPException(400, "Placement accepts only rack_u and expected_project")
    if body.get("expected_project") != m.get("project"):
        raise HTTPException(409, "Project changed; reload the equipment before placing it")
    return edit_machine(name, {"rack_u": body["rack_u"]})


@app.patch("/api/machines/{name}/cdu-installation")
@_data_transaction
def set_cdu_installation(name: str, body: dict):
    if name not in machines:
        raise HTTPException(404, "Machine not found")
    m = copy.deepcopy(machines[name])
    if m.get("level") != "rack" or telemetry_core.kind_of(m, name) != "cdu":
        raise HTTPException(400, "Only CDU installation can be changed here")
    if set(body) - {"rack_mount", "rack_size", "expected_project"}:
        raise HTTPException(400, "Unexpected installation field")
    if body.get("expected_project") != m.get("project"):
        raise HTTPException(409, "Project changed; reload equipment")
    mount = body.get("rack_mount")
    if mount not in ("internal", "external"):
        raise HTTPException(400, "Choose internal or external")
    size = 0 if mount == "external" else _rack_integer(body.get("rack_size"), "rack_size", 1, 48)
    if mount == "internal" and m.get("rack_mount", "internal") == "internal" and size != m.get("rack_size", 1):
        raise HTTPException(400, "Existing internal CDU height is fixed")
    m.update(rack_mount=mount, rack_size=size, rack_u=size)
    _validate_rack(m, name)
    machines[name] = m
    _save_data()
    return {"ok": True, "machine": _bmc_safe(m)}


@app.patch("/api/machines/{name}/management-ip")
@_data_transaction
def change_management_ip(name: str, body: dict):
    if name not in machines:
        raise HTTPException(404, "Machine not found")
    m = machines[name]
    classification = equipment_policy.classify(m, name)
    if classification["kind"] in ("server", "blanking") and classification["status"] != "needs_confirmation":
        raise HTTPException(400, "Use the server IP workflow; blanking has no management IP")
    if set(body)-{"target", "ip", "expected_ip", "expected_node_id", "expected_binding_revision"} or not {'target','ip','expected_ip'}<=set(body) or body.get("target") not in ("os", "bmc"):
        raise HTTPException(422, "Choose a management connection and IP")
    field = body["target"] + "_ip"
    if body["expected_ip"] != (m.get(field) or ""):
        raise HTTPException(409, "IP changed; reload equipment")
    try:
        value = str(ipaddress.ip_address(str(body["ip"]).strip()))
    except ValueError:
        raise HTTPException(422, "Enter a valid IPv4 or IPv6 address")
    if m.get("os") is not None:
        entry=_connection_node(m,body.get('expected_node_id'),body.get('expected_binding_revision'))
        entry["ip" if body["target"] == "os" else "bmc_ip"] = value
        entry['binding_revision']=int(entry.get('binding_revision',1))+1
        if entry['slot']==m.get('active_os'):_sync_active_os(m)
    else:m[field] = value
    _save_data()
    _invalidate_machine_cache(name)
    return {"ok": True, "ip": value, "target": body["target"]}


class ChangeOsIp(BaseModel):
    new_os_ip: str
    os_user: str = ""
    os_pass: str = ""
    os_port: int = 22
    expected_node_id: str | None = None
    expected_binding_revision: str | None = None


@app.post("/api/machines/{name}/change-os-ip")
def change_os_ip(name: str, body: ChangeOsIp):
    """變更機台的 OS IP（因 DHCP 有時會漂移）。

    只允許改 OS IP（BMC IP 不給改）。改之前必須「驗證該新 IP 確實是同一台」：
      1) ping 得到（線上）
      2) Use explicitly supplied credentials for the new IP, then check hostname.
    → 符合才更新 os_ip 並存檔。避免把 IP 誤配到別的機器。
    """
    with _DATA_LOCK:
        if name not in machines:
            raise HTTPException(404, f"機台不存在: {name}")
        m = copy.deepcopy(machines[name])
    entry = _connection_node(m,body.expected_node_id,body.expected_binding_revision)
    new_ip = (body.new_os_ip or "").strip()
    if not new_ip:
        raise HTTPException(400, "請輸入新的 OS IP")
    if new_ip == (entry.get('ip') if entry is not None else m.get("os_ip")):
        return {"ok": True, "changed": False, "msg": "IP 與原本相同，未變更。"}
    user = getattr(body, "os_user", "")
    password = getattr(body, "os_pass", "")
    port = getattr(body, "os_port", 22)
    if not user or not password or "**" in password:
        raise HTTPException(400, "Enter explicit SSH credentials for the new IP")
    if not isinstance(port, int) or not 1 <= port <= 65535:
        raise HTTPException(422, "Invalid SSH port")

    # The approved bounded SSH probe is the reachability evidence; ICMP is not identity.
    hostname, rc, err = ssh_run(new_ip, user, password, port, "hostname", timeout=12)
    if rc != 0 or not hostname:
        return {"ok": False, "changed": False,
                "msg": f"無法以 SSH 連上新 IP {new_ip}（rc={rc}，{err or '連線失敗'}）"}

    hostname = hostname.strip()
    expected = entry.get("os_hostname") if entry is not None else name
    if not expected or hostname != expected:
        return {"ok": False, "changed": False,
                "msg": f"新 IP {new_ip} 的 hostname 是「{hostname}」，與本機「{name}」不符，"
                       f"判定為別的機器，拒絕變更。"}

    old_ip = entry.get('ip') if entry is not None else m.get("os_ip")
    safe = _commit_connection(name, m, {"os_ip": new_ip, "os_user": user, "os_pass": password, "os_port": port},
                              body.expected_node_id,body.expected_binding_revision)
    return {"ok": True, "changed": True, "msg": f"已將 OS IP 由 {old_ip} 更新為 {new_ip}。",
            "machine": safe}


class ChangeBmcIp(BaseModel):
    new_bmc_ip: str
    bmc_user: str = ''
    bmc_pass: str = ''
    bmc_ssh_port: int = Field(22,strict=True,ge=1,le=65535)
    expected_node_id: str | None = None
    expected_binding_revision: str | None = None


@app.post("/api/machines/{name}/change-bmc-ip")
def change_bmc_ip(name: str, body: ChangeBmcIp):
    """Explicit node binding and provider-approved new-endpoint credentials."""
    with _DATA_LOCK:
        if name not in machines:
            raise HTTPException(404, f"機台不存在: {name}")
        m = copy.deepcopy(machines[name])
    entry=_connection_node(m,body.expected_node_id,body.expected_binding_revision)
    new_ip = (body.new_bmc_ip or "").strip()
    if not new_ip:
        raise HTTPException(400, "請輸入新的 BMC IP")
    old_ip=entry.get('bmc_ip') if entry is not None else m.get('bmc_ip')
    if new_ip == old_ip:
        return {"ok": True, "changed": False, "msg": "IP 與原本相同，未變更。"}
    if not body.bmc_user or not body.bmc_pass or _is_masked(body.bmc_pass):
        raise HTTPException(422,'Explicit credentials for the new BMC endpoint are required')
    hostname,rc,_=ssh_run(new_ip,body.bmc_user,body.bmc_pass,body.bmc_ssh_port,'hostname',timeout=12)
    expected=entry.get('bmc_hostname') if entry is not None else m.get('bmc_hostname')
    if rc or not expected or hostname.strip()!=expected:
        raise HTTPException(409,'BMC identity could not be verified; inventory unchanged')
    safe = _commit_connection(name, m, {"bmc_ip": new_ip,'bmc_user':body.bmc_user,'bmc_pass':body.bmc_pass,
        'bmc_port':body.bmc_ssh_port},body.expected_node_id,body.expected_binding_revision)
    return {"ok": True, "changed": True, "msg": f"已將 BMC IP 由 {old_ip} 更新為 {new_ip}。",
            "machine": safe}


# ---- 多 OS 機框（一台 server 含多個獨立 OS，每個 OS 配對一個 BMC）CRUD ----
class AddOs(BaseModel):
    ip: str
    user: str
    pass_: str = Field(..., alias="pass")
    port: int = Field(22, strict=True, ge=1, le=65535)
    label: str = ""
    # 該 OS 節點的 BMC；SSH 和 IPMI 使用獨立 ports。
    bmc_ip: str = ""
    bmc_user: str = ""
    bmc_pass: str = ""
    bmc_ssh_port: int = Field(22, strict=True, ge=1, le=65535)
    ipmi_port: int = Field(623, strict=True, ge=1, le=65535)
    model_config = {"populate_by_name": True}


class UpdateOs(BaseModel):
    expected_node_id: str | None = None
    expected_binding_revision: str | None = None
    ip: str = ""
    user: str = ""
    pass_: str = Field("", alias="pass")
    port: int | None = None
    label: str = ""
    # BMC 欄位：留空 = 不更動
    bmc_ip: str = ""
    bmc_user: str = ""
    bmc_pass: str = ""
    bmc_ssh_port: int | None = Field(None, strict=True, ge=1, le=65535)
    ipmi_port: int | None = Field(None, strict=True, ge=1, le=65535)
    model_config = {"populate_by_name": True}


class SelectOs(BaseModel):
    slot: int


def _os_conflict(m_name, m, ip, exclude_slot=None):
    """檢查 ip 是否與任何其他機台（主 OS 或任一 OS slot）衝突。回傳訊息或 None。"""
    for mk, mv in machines.items():
        if mk == m_name:
            if any(e.get("ip") == ip and e.get("slot") != exclude_slot for e in mv.get("os", [])):
                return "OS endpoint already belongs to a sibling node"
            continue
        if mv.get("os_ip") and mv["os_ip"] == ip:
            return f"OS IP {ip} 已被「{mk}」使用"
        for xo in (mv.get("os") or []):
            if xo.get("ip") == ip:
                return f"OS IP {ip} 已被「{mk}」的 OS{xo.get('slot')} 使用"
    return None


@app.post("/api/machines/{name}/os")
@_data_transaction
def machine_add_os(name: str, body: AddOs):
    """為機框新增一個 OS slot。IP/帳號必填，密碼可空（之後用 PATCH 補）。
    不做 SSH 強驗證（方便先註冊 slot 再補帳密）；實際 SSH 連線驗證在開終端時才做。"""
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    m = machines[name]
    ip = (body.ip or "").strip()
    user = (body.user or "").strip()
    pw = "" if _is_masked(body.pass_) else (body.pass_ or "")
    add_bmc_pass = "" if _is_masked(body.bmc_pass) else (body.bmc_pass or "")
    if not ip or not user:
        raise HTTPException(400, "OS IP / 帳號為必填（密碼可之後再補）")
    try:
        ipaddress.ip_address(ip)
        if body.bmc_ip:ipaddress.ip_address(body.bmc_ip.strip())
    except ValueError:raise HTTPException(422,'Valid OS and BMC IP addresses required')
    port = int(body.port or 22)
    if (c := _os_conflict(name, m, ip)):
        raise HTTPException(400, f"無法新增：{c}")
    # 確保有 os 陣列；os[0] 若缺（舊單 OS 機台）先補（主 OS 允許 user 空，只要 ip 有）
    os_list = m.get("os")
    if os_list is None:
        primary_ip = (m.get("os_ip") or "").strip()
        if primary_ip:
            primary = {
                "slot": 1, "ip": primary_ip,
                "user": (m.get("os_user") or "").strip(),
                "pass": "" if _is_masked(m.get("os_pass")) else (m.get("os_pass") or ""),
                "port": int(m.get("os_port") or 22),
                "label": "OS 1",
                # 主 OS 節點沿用機台層級 BMC（舊單 OS 機台遷移過來的 BMC）
                "bmc_ip": (m.get("bmc_ip") or "").strip(),
                "bmc_user": (m.get("bmc_user") or "").strip(),
                "bmc_pass": "" if _is_masked(m.get("bmc_pass")) else (m.get("bmc_pass") or ""),
            }
            os_list = [primary]
        else:
            os_list = []
    else:
        if any(not isinstance(entry,dict) for entry in os_list):
            raise HTTPException(422,'Invalid canonical node entry; repair inventory before adding a node')
        os_list=list(os_list)  # An empty canonical chassis never resurrects parent OS fields.
    slot = next(i for i in range(1, len(os_list) + 2) if all(e.get("slot") != i for e in os_list))
    entry = _norm_os_entry({"ip": ip, "user": user, "pass": pw, "port": port,
                            "label": body.label or f"OS {slot}",
                            "bmc_ip": body.bmc_ip, "bmc_user": body.bmc_user,
                            "bmc_pass": add_bmc_pass, "bmc_ssh_port": body.bmc_ssh_port, "ipmi_port": body.ipmi_port}, slot)
    if entry is None:
        # 新增的 OS 也要有 ip+user 才成立（上面已檢查 ip/user 非空，這裡只是防禦）
        raise HTTPException(400, "OS 資料無效")
    entry["node_id"] = __import__("uuid").uuid4().hex
    os_list.append(entry)
    m["os"] = os_list
    m.update(node_identity.canonical(m))
    m.setdefault("active_os", None)
    _sync_active_os(m)   # 同步 active（通常仍是 slot1，但若 active_os 指到新 slot 會更新）
    _save_data()
    return {"ok": True, "machine": _bmc_safe(m)}


@app.patch("/api/machines/{name}/os/{slot}")
@_data_transaction
def machine_update_os(name: str, slot: int, body: UpdateOs):
    """更新某 OS slot 的帳密（只改有填的欄位）。"""
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    m = machines[name]
    os_list = m.get("os") or []
    if not any(e.get("slot") == slot for e in os_list):
        raise HTTPException(404, f"OS {slot} 不存在")
    cur = node_identity.slot_entry(m, slot)
    previous_binding = node_identity.binding(cur)
    if body.expected_node_id is not None or body.expected_binding_revision is not None:
        if body.expected_node_id != cur.get("node_id") or body.expected_binding_revision != previous_binding:
            raise HTTPException(409, "Node binding changed; reload before editing")
    previous_credentials = (cur.get("pass"), cur.get("bmc_pass"))
    if body.ip:
        new_ip = body.ip.strip()
        if (c := _os_conflict(name, m, new_ip, exclude_slot=slot)):
            raise HTTPException(400, f"無法變更：{c}")
        cur["ip"] = new_ip
    if body.user:
        cur["user"] = body.user.strip()
    if body.pass_ and not _is_masked(body.pass_):
        cur["pass"] = body.pass_
    if "port" in body.model_fields_set:
        if type(body.port) is not int or not 1 <= body.port <= 65535: raise HTTPException(422, "Invalid SSH port")
        cur["port"] = body.port
    if body.label:
        cur["label"] = body.label.strip()
    # BMC 欄位（留空 = 不更動）
    if body.bmc_ip:
        cur["bmc_ip"] = body.bmc_ip.strip()
    if body.bmc_user:
        cur["bmc_user"] = body.bmc_user.strip()
    if body.bmc_pass and not _is_masked(body.bmc_pass):
        cur["bmc_pass"] = body.bmc_pass
    for field in ("bmc_ssh_port", "ipmi_port"):
        if field in body.model_fields_set:
            value = getattr(body, field)
            if value is None: raise HTTPException(422, "Explicit port required")
            cur[field] = value
    if previous_credentials != (cur.get("pass"), cur.get("bmc_pass")):
        # Version the binding without hashing or exposing password material.
        cur["credential_version"] = __import__("uuid").uuid4().hex
    if slot == m.get("active_os"):
        _sync_active_os(m)
    if node_identity.binding(cur) != previous_binding:
        cur["binding_revision"] = int(cur.get("binding_revision",1)) + 1
    _save_data()
    _invalidate_machine_cache(name)
    return {"ok": True, "machine": _bmc_safe(m)}


@app.delete("/api/machines/{name}/os/{slot}")
@_data_transaction
def machine_delete_os(name: str, slot: int):
    if name not in machines: raise HTTPException(404, "Machine not found")
    m = machines[name]
    m.update(node_identity.canonical(m))
    try: entry = node_identity.slot_entry(m, slot)
    except ValueError as exc: raise HTTPException(404, str(exc))
    m.setdefault("retired_nodes", []).append({k: entry[k] for k in ("node_id", "slot_id", "slot", "label") if k in entry})
    m["os"] = [e for e in m["os"] if e["node_id"] != entry["node_id"]]
    if m.get("active_os", 1) == slot:
        m["active_os"] = None
        for key in ("os_ip", "os_user", "os_pass", "bmc_ip", "bmc_user", "bmc_pass"): m[key] = ""
    _invalidate_machine_cache(name)
    _save_data()
    return {"ok": True, "machine": _bmc_safe(m)}


@app.post("/api/machines/{name}/select-os")
@_data_transaction
def machine_select_os(name: str, body: SelectOs):
    """切換機框「目前選定 OS」。把該 slot 的帳密同步到 os_ip/...（成為終端/SSH 目標）。
    切換時清除該機台所有 OS/BMC/感測器快取，確保下一次 detail/sensors 用『新選定 OS』
    重新抓取，避免不同 slot 的硬體/感測器因共用 name 快取而串台。"""
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    m = machines[name]
    os_list = m.get("os") or []
    if not any(e.get("slot") == body.slot for e in os_list):
        raise HTTPException(404, f"OS {body.slot} 不存在")
    m["active_os"] = body.slot
    _sync_active_os(m)
    _save_data()
    # 換 OS → 舊快取不屬於新 OS，全部清掉，重抓
    _invalidate_machine_cache(name)
    return {"ok": True, "machine": _bmc_safe(m)}


class ProbeOsSlot(BaseModel):
    slot: int


@app.post("/api/machines/{name}/os/{slot}/probe")
def machine_probe_os(name: str, slot: int, body: ProbeOsSlot = None):
    """用「該 slot 的 OS 帳密」SSH 上去：
    1) 抓 hostname（自動填 OS 標籤）
    2) 在本機跑 ipmitool lan print 抓 BMC IP Address（自動填 BMC IP）
    回 {ok, hostname, bmc_ip, ipmitool_ok, error}。BMC 帳號/密碼不抓（手動填）。"""
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    m = machines[name]
    os_list = m.get("os") or []
    if not any(e.get("slot") == slot for e in os_list):
        raise HTTPException(404, f"OS {slot} 不存在")
    e = node_identity.slot_entry(m, slot)
    os_ip = e.get("ip") or ""
    os_user = e.get("user") or ""
    os_pass = e.get("pass") or ""
    os_port = int(e.get("port") or 22)
    if not os_ip or not os_user or not os_pass:
        return {"ok": False, "error": f"OS {slot} 未填齊 OS IP/帳號/密碼，無法自動抓取。請先補齊再按「抓」。"}
    # 1) hostname
    hostname, rc, err = ssh_run(os_ip, os_user, os_pass, os_port, "hostname", timeout=12)
    if rc != 0 or not hostname:
        return {"ok": False, "error": f"SSH 連不上 OS {slot}（{os_ip}）：{err or '無法登入'}"}
    hostname = hostname.strip()
    # 2) BMC IP（用該 OS 本機 ipmitool lan print）
    bmc_ip, has_ipmi, perr = _probe_bmc_ip(os_ip, os_user, os_pass, os_port)
    if not has_ipmi:
        return {"ok": True, "hostname": hostname, "bmc_ip": None, "ipmitool_ok": False,
                "error": f"hostname 已抓到（{hostname}），但 OS {slot} 內無 ipmitool，無法自動抓 BMC IP。請手動填 BMC IP。"}
    if not bmc_ip:
        return {"ok": True, "hostname": hostname, "bmc_ip": None, "ipmitool_ok": True,
                "error": f"hostname 已抓到（{hostname}），但 ipmitool 取不到 BMC IP：{perr}。請手動填。"}
    return {"ok": True, "hostname": hostname, "bmc_ip": bmc_ip, "ipmitool_ok": True}


# ---- 線上狀態快取（TTL），避免大量機台時每次 API 都同步 ping 卡住 ----
_status_cache = {}
_STATUS_TTL = 5          # 5 秒內不重複 ping 同一台
_STATUS_TIME = None


# ---- 健康度快取（依 BMC 回報，綠/橘/紅/unknown/offline）----
_health_cache = {}
_HEALTH_TTL = 30      # 健康度較慢，快取久一點
_POWER = {}              # name -> {"v": "ON"/"OFF"/None, "t": epoch}
_POWER_TTL = 30         # 電源狀態快取 30s


def _detect_health(m):
    """判定單台 BMC 健康燈（邏輯已與使用者確認）：
    綠=Redfish HealthRollup OK / 橘=Warning / 紅=Critical；
    若 Redfish 不通再視 EventLog severity；連不到= 'unknown'；無BMC='offline'。
    """
    bmc = m.get("bmc_ip")
    if not bmc:
        return "offline"
    if not _status_cache.get(("bmc", m["name"]), False):
        return "unknown"                      # BMC ping 不到
    u = m.get("bmc_user") or ""
    pw = m.get("bmc_pass") or ""
    try:
        import requests, urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    except Exception:
        return "unknown"
    auth = (u, pw) if u else None
    # 1) Redfish System HealthRollup
    for sysid in ("system", "1"):
        try:
            r = requests.get(f"https://{bmc}/redfish/v1/Systems/{sysid}/", auth=auth, verify=False, timeout=8)
            if r.status_code == 200:
                st = (r.json() or {}).get("Status", {})
                rollup = ((st.get("HealthRollup") or st.get("Health")) or "").upper()
                if rollup == "OK":
                    return "green"
                if rollup == "WARNING":
                    return "amber"
                if rollup in ("CRITICAL", "MAJOR"):
                    return "red"
        except Exception:
            pass
    # 2) EventLog 最近 severity
    try:
        r = requests.get(f"https://{bmc}/redfish/v1/Systems/system/LogServices/EventLog/Entries/",
                         auth=auth, verify=False, timeout=8)
        if r.status_code == 200:
            sevs = [((e or {}).get("Severity") or "").upper() for e in (r.json() or {}).get("Members", [])]
            if any(s == "CRITICAL" for s in sevs):
                return "red"
            if any(s in ("WARNING", "WARN") for s in sevs):
                return "amber"
    except Exception:
        pass
    return "unknown"


def _parse_power(raw):
    """從 ipmitool chassis power status 輸出解析 ON / OFF。"""
    if not raw:
        return None
    m = re.search(r"Power\s+is\s+(on|off)|Power\s*:\s*(on|off)|\b(on|off)\b", raw, re.I)
    if m:
        v = (m.group(1) or m.group(2) or m.group(3)).lower()
        return "ON" if v == "on" else "OFF"
    if "on" in raw.lower() and "off" not in raw.lower():
        return "ON"
    return None


def _collect_power():
    """並行抓所有機台的 BMC 電源狀態，寫入 _POWER（name → {"v","t"}）。
    已在 TTL 內的不重複抓（避免 ipmitool 併發爆掉）。"""
    now = time.time()
    targets = [
        n for n, m in machines.items()
        if _machine_allowed(n) and not m.get("passive")
        and (m.get("bmc_ip") or m.get("os_ip"))
        and (m.get("bmc_ip") or _status_cache.get(("os", n)))
        and (n not in _POWER or (now - _POWER[n].get("t", 0)) > _POWER_TTL)
    ]
    if not targets:
        return
    with ThreadPoolExecutor(max_workers=16) as ex:
        def pjob(n):
            try:
                ok, st = ipmi_power(machines[n], "status")
            except Exception:
                ok, st = False, ""
            _POWER[n] = {"v": _parse_power(st) if ok else None, "t": time.time()}
        list(ex.map(pjob, targets))


_status_observed = {}

def _refresh_status(force=False):
    """並行掃描所有機台的 OS / BMC 線上狀態與健康度，寫入快取。"""
    global _STATUS_TIME
    now = time.time()
    if not force and _STATUS_TIME and (now - _STATUS_TIME) < _STATUS_TTL:
        return
    hosts = set()
    for m in machines.values():
        if not _project_allowed(m.get("project")): continue
        if m.get("os_ip"):
            hosts.add(("os", m["name"]))
        if m.get("bmc_ip"):
            hosts.add(("bmc", m["name"]))

    def scan(kind, name):
        ip = machines[name].get("os_ip" if kind == "os" else "bmc_ip")
        key = (kind, name)
        alive = ping_check(ip)
        if machines.get(name, {}).get("os_ip" if kind == "os" else "bmc_ip") == ip:
            _status_cache[key] = alive
            _status_observed[key] = time.time()

    with ThreadPoolExecutor(max_workers=32) as ex:
        list(ex.map(lambda h: scan(*h), list(hosts)))
    # 電源狀態：OS/BMC 至少一端在線才抓（較慢，排在 ping 之後）
    _collect_power()
    # 電源抓完再跑健康度深度偵測
    # 健康度：僅對 BMC 可達的機台做深度偵測（較慢，獨立快取）
    hnow = time.time()
    with ThreadPoolExecutor(max_workers=12) as ex:
        def hjob(name):
            if name in _health_cache and (hnow - _health_cache[name][1]) < _HEALTH_TTL:
                return
            _health_cache[name] = (_detect_health(machines[name]), hnow)
        list(ex.map(hjob, [n for n in machines if _machine_allowed(n)]))
    _STATUS_TIME = now


_STATUS_LOCK = threading.Lock()

def _kick_status_scan(force=False):
    """若快取過期，在背景 thread 刷新狀態，立即回傳舊快取（避免阻塞 API 回應）。
    force=True 時同步執行。"""
    if force:
        if not _STATUS_LOCK.acquire(blocking=False):
            # Join the current scan instead of issuing a duplicate full scan.
            with _STATUS_LOCK:
                pass
            return
        try:
            _refresh_status(force=True)
        finally:
            _STATUS_LOCK.release()
        return
    now = time.time()
    if _STATUS_TIME and (now - _STATUS_TIME) < _STATUS_TTL:
        return
    if not _STATUS_LOCK.acquire(blocking=False):
        return  # 已有一個掃描在背景跑
    def _run():
        try:
            _refresh_status()
        except Exception as e:
            print("背景狀態掃描失敗：", e)
        finally:
            _STATUS_LOCK.release()
    threading.Thread(target=_background_target(_run), daemon=True).start()


@app.get("/api/machines")
def list_machines(force_scan: bool = False):
    if os.environ.get("CYCLE_MODE", "synthetic") != "synthetic": _kick_status_scan(force=force_scan)
    safe = []
    for name in sorted(machines, key=lambda k: machines[k].get("order", 0)):
        m = machines[name]
        if not _project_allowed(m.get("project")): continue
        c = dict(m)
        c["os_pass"] = "****" if c.get("os_pass") else ""
        c["bmc_pass"] = "****" if c.get("bmc_pass") else ""
        c["os_alive"] = _status_cache.get(("os", name))
        c["connectivity"] = {kind: {"source": "ICMP ping", "observed_at": _status_observed.get((kind, name)),
            "configured": bool(m.get(kind + "_ip"))} for kind in ("os", "bmc")}
        c["power"] = (_POWER.get(name) or {}).get("v")
        c["bmc_alive"] = _status_cache.get(("bmc", name)) if m.get("bmc_ip") else None
        c["health"] = _health_cache.get(name, ("unknown", 0))[0]
        c.pop("status", None)
        c["os"] = _mask_os_list(m.get("os"))
        c["active_os"] = m.get("active_os", 1)
        safe.append(c)
    return {"machines": safe, "last_scan": _STATUS_TIME}


@app.delete("/api/machines/{name}")
@_data_transaction
def delete_machine(name: str):
    if name in machines:
        del machines[name]
        links[:] = [link for link in links if name not in (link.get("a"), link.get("b"))]
        _save_data()
    return {"ok": True}


# ---- 測試庫 (test library) ----
_TESTLIB_FILE = os.path.join(_data_dir(), "tests.json")
_testlib_cache = {"mtime": None, "data": None}


def _load_testlib():
    try:
        mt = os.path.getmtime(_TESTLIB_FILE)
        if _testlib_cache["mtime"] == mt and _testlib_cache["data"] is not None:
            return _testlib_cache["data"]
        with open(_TESTLIB_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        from test_library_contract import prepare_library
        prepare_library(data)
        _testlib_cache["mtime"] = mt
        _testlib_cache["data"] = data
        return data
    except Exception as e:
        print("\u8f09\u5165 tests.json \u5931\u6557\uff1a", e)
        return None


@app.get("/api/testlibrary")
def api_testlibrary(sheet: str = ""):
    """\u6e2c\u8a66\u5eab\u8cc7\u6599\u3002 sheet= \u53ef\u6307\u5b9a\u4e2d\u6587\u6a19\u7c64\u6216\u539f\u59cb sheet \u540d\u3002"""
    data = _load_testlib()
    if data is None:
        raise HTTPException(404, "\u6e2c\u8a66\u5eab\u5c1a\u672a\u7522\u751f\uff08\u7f3a\u5c11 tests.json\uff09")
    if sheet:
        for label, s in data.get("sheets", {}).items():
            if label == sheet or s.get("name") == sheet:
                return s
        raise HTTPException(404, f"\u627e\u4e0d\u5230\u6e2c\u9805\u5206\u985e: {sheet}")
    return data


@app.get("/api/testlibrary/meta")
def api_testlibrary_meta():
    """\u6e2c\u8a66\u5eab\u5206\u985e\u5217\u8868\uff08label + \u539f\u59cb sheet \u540d + \u7b46\u6578 + YES/PARTIAL/NO \u7d71\u8a08\uff09\u3002"""
    data = _load_testlib()
    if data is None:
        raise HTTPException(404, "\u6e2c\u8a66\u5eab\u5c1a\u672a\u7522\u751f\uff08\u7f3a\u5c11 tests.json\uff09")
    out = []
    for label, s in data.get("sheets", {}).items():
        cnt = {"YES": 0, "PARTIAL": 0, "NO": 0, "UNRESOLVED": 0}
        for it in s.get("items", []):
            k = (it.get("ai_can_execute") or "UNRESOLVED").upper()
            cnt[k if k in cnt else "UNRESOLVED"] += 1
        out.append({"label": label, "sheet": s.get("name"), "count": s.get("count"),
                    "auto": cnt["YES"], "partial": cnt["PARTIAL"], "no": cnt["NO"], "unresolved": cnt["UNRESOLVED"]})
    return {"total": data.get("total", 0), "sheets": out, "version": data.get("version"), "schema_version": data.get("schema_version")}


@app.get("/api/testlibrary/export")
def api_testlibrary_export(sheet: str = ""):
    """\u5c0e\u51fa\u6e2c\u8a66\u5eab CSV\uff08CSV \u4e0b\u8f09\uff09\u3002 sheet= \u53ef\u6307\u5b9a\u4e2d\u6587\u6a19\u7c64\u6216\u539f\u59cb sheet \u540d\uff1b\u7565\u7565\u5247\u5168\u90e8\u3002"""
    data = _load_testlib()
    if data is None:
        raise HTTPException(404, "\u6e2c\u8a66\u5eab\u5c1a\u672a\u7522\u751f\uff08\u7f3a\u5c11 tests.json\uff09")
    sheets = []
    if sheet:
        for label, s in data.get("sheets", {}).items():
            if label == sheet or s.get("name") == sheet:
                sheets.append(s)
                break
        if not sheets:
            raise HTTPException(404, f"\u627e\u4e0d\u5230\u6e2c\u9805\u5206\u985e: {sheet}")
    else:
        sheets = list(data.get("sheets", {}).values())

    fields = ["code", "sub_function", "test_set", "items", "procedure", "criteria",
              "ai_can_execute", "ai_packages_needed", "ai_commands", "ai_logs_output", "risk"]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, lineterminator="\n")
    w.writeheader()
    for s in sheets:
        for it in s.get("items", []):
            row = {k: (it.get(k) if it.get(k) is not None else "") for k in fields}
            w.writerow(row)
    payload = "\ufeff" + buf.getvalue()
    if not sheet or len(sheets) != 1:
        fname = "testlibrary.csv"
    else:
        sname = sheets[0].get("name") or ""
        fname = "testlibrary_%s.csv" % sname
    return PlainTextResponse(payload, media_type="text/csv; charset=utf-8",
                             headers={"Content-Disposition": "attachment; filename=%s" % fname})


class TestlibSearchReq(BaseModel):
    query: str = Field(..., description="以自然語描述要驗的項目，例如：驗 B200 的 NVLink / GPU 溫度 / 硬碟 SMART")


@app.post("/api/ai/testlib-search")
def ai_testlib_search(req: TestlibSearchReq):
    """測試庫 AI 導航：用人話搜 3112 條測項。
    先用 LLM 抽關鍵字，再對 test_set/items/sub_function/criteria 做分數比對，回傳最佳測項。"""
    data = _load_testlib()
    if data is None:
        return {"ok": False, "error": "測試庫尚未產生（缺少 tests.json）"}
    q = (req.query or "").strip()
    if not q:
        return {"ok": False, "error": "請輸入想驗證的項目"}
    kw = q
    try:
        txt = _llm_chat(
            "你是測試工程師。使用者用一句自然語言描述『想驗哪些測試』。請只回 JSON 陣列，例如 [\"NVLink\",\"B200\"]，最多 5 個關鍵字，不要任何其它文字。",
            q, temperature=0.0, max_tokens=120)
        m = re.search(r"\[.*?\]", txt, re.S)
        if m:
            arr = json.loads(m.group(0))
            if isinstance(arr, list):
                kw = " ".join(str(x) for x in arr if str(x).strip())
    except Exception:
        pass
    words = [w.strip().lower() for w in re.split(r"[\s,，、/]+", kw) if len(w.strip()) >= 2]
    if not words:
        words = [w.lower() for w in re.split(r"[\s,，、/]+", q) if len(w.strip()) >= 2]

    def score(it, words):
        hay = " ".join([
            str(it.get("test_set", "")), str(it.get("items", "")),
            str(it.get("sub_function", "")), str(it.get("criteria", "")),
            str(it.get("code", ""))]).lower()
        s = 0
        for w in words:
            if w in hay:
                item_str = str(it.get("items", "")).lower() + " " + str(it.get("test_set", "")).lower()
                s += 2 if w in item_str else 1
        return s
    hits = []
    for label, s in data.get("sheets", {}).items():
        for it in s.get("items", []):
            sc = score(it, words)
            if sc:
                hits.append((sc, label, it.get("code", ""), it.get("test_set", ""),
                             it.get("items", ""), (it.get("ai_can_execute") or "").upper(),
                             it.get("risk", "")))
    hits.sort(key=lambda x: (-x[0], x[2]))
    top = hits[:8]
    if not top:
        return {"ok": False, "query": q, "keywords": words, "error": "找不到相符的測試項目，請換個關鍵字"}
    return {"ok": True, "query": q, "keywords": words,
            "hits": [{"score": sc, "sheet": label, "code": code, "test_set": ts,
                      "items": it_, "auto": auto, "risk": risk} for sc, label, code, ts, it_, auto, risk in top]}


class TestlibAdviceReq(BaseModel):
    code: str = Field("", description="測試代碼，例如 Wistron-HW-00001-V006")
    case_variant_id: str = ""
    log: str = Field(..., description="失敗 / 異常 log 內容")
    machine: str = Field("", description="機台名稱（可選）")


@app.post("/api/ai/testlib-advice")
def ai_testlib_advice(req: TestlibAdviceReq):
    """測試庫 AI 會診：給出測項失敗 log，AI 傍著 procedure/criteria/ai_commands
    給『可能原因 + 下一步指令 + 一句結論』。"""
    data = _load_testlib()
    if data is None:
        return {"ok": False, "error": "測試庫尚未產生（缺少 tests.json）"}
    from test_library_contract import select_variant
    try:
        target = select_variant(data, req.code.strip(), req.case_variant_id.strip())
    except ValueError as error:
        raise HTTPException(409, str(error))
    if not target:
        return {"ok": False, "error": f"找不到測試代碼: {req.code}"}
    proc = str(target.get("procedure", "") or "")[:3000]
    cri = str(target.get("criteria", "") or "")[:1500]
    cmds = "\n".join((target.get("ai_commands") or []) if isinstance(target.get("ai_commands"), list)
                     else [str(target.get("ai_commands") or "")])[:1500]
    log = (req.log or "").strip()[:4000]
    sysp = ("你是伺服器硬體測試工程師。使用者給你『測試項目 + 失敗 log』。\n"
            "請用繁體中文、簡潔條列：\n"
            "1) 可能原因（2~3 個，依可能性排序）\n"
            "2) 下一步驗證指令（最多 3 條，直接給 shell 指令）\n"
            "3) 一句話結論。不要 Markdown 表格。")
    usr = (f"測試項目：{target.get('code')} / {target.get('test_set')} / {target.get('items')}\n"
           f"判準(criteria)：{cri}\n"
           f"程序(procedure 摘要)：{proc[:1200]}\n"
           f"內建命令：{cmds}\n"
           f"機台：{req.machine or '未知'}\n"
           f"---- 失敗 log ----\n{log}\n請分析：")
    try:
        txt = _llm_chat(sysp, usr, temperature=0.2, max_tokens=700)
    except Exception as e:
        return {"ok": False, "error": f"AI 分析失敗: {e}"}
    return {"ok": True, "code": target["code"], "case_variant_id": target["case_variant_id"], "sheet": target["sheet"],
            "analysis": txt, "criteria": cri[:500]}


# ---- 單機 / 整櫃 控制與詳細資訊 ----
# OS 系統資訊「最後一次成功抓取」的快取（關機時回給前端當歷史值）
_os_info_cache = {}
_os_info_time = {}


@app.get("/api/machine/{name}")
def machine_get_one(name: str):
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    m = machines[name]
    c = dict(m)
    c["os_pass"] = "****" if c.get("os_pass") else ""
    c["bmc_pass"] = "****" if c.get("bmc_pass") else ""
    c["os_alive"] = (False if os.environ.get("CYCLE_MODE", "synthetic")=="synthetic" else ping_check(m.get("os_ip"), 2))
    c["bmc_alive"] = (False if os.environ.get("CYCLE_MODE", "synthetic")=="synthetic" else ping_check(m.get("bmc_ip"), 2)) if m.get("bmc_ip") else None
    c["os"] = _mask_os_list(m.get("os"))
    c["active_os"] = m.get("active_os", 1)
    # 每個 OS 的即時 ping（多 OS 機框用；單 OS 機台也給一個）
    c["os_alive_map"] = {
        str(int(e.get("slot") or i + 1)): (False if os.environ.get("CYCLE_MODE", "synthetic")=="synthetic" else ping_check(e.get("ip"), 2))
        for i, e in enumerate(m.get("os") or []) if e.get("ip")
    }
    return {"machine": c}


def _bmc_safe(m):
    """Mask credentials and report cached observations without network I/O."""
    c = dict(m)
    c["os_pass"] = "****" if c.get("os_pass") else ""
    c["bmc_pass"] = "****" if c.get("bmc_pass") else ""
    c["os"] = _mask_os_list(m.get("os"))
    c["connectivity"] = {}
    for kind in ("os", "bmc"):
        key = (kind, m.get("name"))
        configured = bool(m.get(kind + "_ip"))
        c[kind + "_alive"] = globals().get("_status_cache", {}).get(key) if configured else None
        c["connectivity"][kind] = {
            "source": "ICMP ping cache",
            "observed_at": globals().get("_status_observed", {}).get(key) if configured else None,
            "configured": configured,
        }
    return c


def _connection_node(machine,node_id,revision):
    if machine.get('os') is None:return None
    matches=[e for e in machine['os'] if e.get('node_id')==node_id and not e.get('empty')]
    if len(matches)!=1 or node_identity.binding(matches[0])!=revision:
        raise HTTPException(409,'Explicit node and current binding revision required')
    return matches[0]


def _commit_connection(name, snapshot, updates, node_id=None, revision=None):
    """Compare and save after probes finish outside the inventory lock."""
    with _DATA_LOCK:
        m = machines.get(name)
        if m is None or m != snapshot:
            raise HTTPException(409, "Equipment changed during verification; reload and retry")
        try:
            slot = _connection_node(m,node_id,revision)
            if slot is not None:
                if updates.get('os_ip') and (conflict:=_os_conflict(name,m,updates['os_ip'],exclude_slot=slot['slot'])):
                    raise HTTPException(409,conflict)
                for key, value in updates.items():
                    slot[{"os_ip": "ip", "os_user": "user", "os_pass": "pass",
                          "os_port": "port", "bmc_port":"bmc_ssh_port"}.get(key, key)] = value
                if 'os_pass' in updates or 'bmc_pass' in updates:slot['credential_version']=__import__('uuid').uuid4().hex
                slot['binding_revision']=int(slot.get('binding_revision',1))+1
                if slot['slot']==m.get('active_os'):_sync_active_os(m)
            else:m.update(updates)
            _save_data()
        except Exception:
            m.clear()
            m.update(copy.deepcopy(snapshot))
            raise
        _invalidate_machine_cache(name)
        return _bmc_safe(m)

def _is_masked(v):
    """前端回傳的密碼若含遮罩符號（**）就視為「未提供」，不得寫回成為真實密碼。
    避免 masking 的值（****）被當成真實密碼存進資料檔，導致 SSH/IPMI 連線失效。"""
    return isinstance(v, str) and "**" in v


def _mask_os_list(os_list):
    """回傳 os 陣列的副本，每個 OS 的 pass + bmc_pass 遮成 ****（回傳前端用）。"""
    if not os_list:
        return os_list
    out = []
    for e in os_list:
        d = dict(e)
        d["expected_binding_revision"] = node_identity.binding(e)
        d["pass"] = "****" if d.get("pass") else ""
        d["bmc_pass"] = "****" if d.get("bmc_pass") else ""
        out.append(d)
    return out


def _norm_os_entry(e, slot):
    """把一個 OS 輸入（dict）正規化成記錄格式
    {slot, ip, user, pass, port, label, bmc_ip, bmc_user, bmc_pass}。
    IP/帳號必填；密碼可空（先註冊 slot 再補帳密）。BMC SSH 與 IPMI ports 分開保存。
    回傳 None 表示無效。"""
    if not isinstance(e, dict):
        return None
    ip = (e.get("ip") or "").strip()
    user = (e.get("user") or "").strip()
    pw = (e.get("pass") or e.get("pass_") or "")
    if not ip or not user:
        return None
    return {
        **{k: copy.deepcopy(v) for k, v in e.items() if k in ("node_id", "slot_id", "binding_revision", "credential_ref", "credential_version", "os_hostname", "bmc_hostname", "expected_identity", "capabilities", "power_domain", "aux_domain", "controller_id", "system_uri", "bmc_ssh_port", "ipmi_port", "ipmi_cipher", "aux_scope_confirmed", "console_id", "node_serial", "hardware_uuid", "mapping_status", "trust")},
        "slot": int(e.get("slot") or slot),
        "ip": ip,
        "user": user,
        "pass": pw,
        "port": int(e.get("port") or 22),
        "label": (e.get("label") or f"OS {slot}").strip(),
        "bmc_ip": (e.get("bmc_ip") or "").strip(),
        "bmc_user": (e.get("bmc_user") or "").strip(),
        "bmc_pass": (e.get("bmc_pass") or ""),
    }


def _invalidate_machine_cache(name):
    for cache_name in ("_os_info_cache", "_os_info_time", "_os_hw_cache", "_os_hw_time",
                       "_bmc_fw_cache", "_bmc_pwr_cache", "_os_access_cache", "_sensors_cache", "_sensors_time", "_POWER", "_health_cache"):
        globals().get(cache_name, {}).pop(name, None)
    for kind in ("os", "bmc"):
        globals().get("_status_cache", {}).pop((kind, name), None)
        globals().get("_status_observed", {}).pop((kind, name), None)


def _sync_active_os(m):
    """把 m 的 active OS（依明確 physical slot 查找）同步到 m 的 os_ip/os_user/os_pass/os_port，
    以及該 OS 節點配對的 BMC（bmc_ip/bmc_user/bmc_pass）。
    單一 OS 機台（無 os 陣列）不動。多 OS 機台靠這個讓「目前選定 OS」成為
    所有既有邏輯（ssh_run / ssh_ipmi / status / terminal / 電源 / KVM）的目標。
    頂層 bmc_port 是所選 node 的 SSH port，IPMI port 保存在 node。"""
    os_list = m.get("os") or []
    if not os_list:
        return
    if "active_os" in m and m["active_os"] is None:
        for key in ("os_ip","os_user","os_pass","bmc_ip","bmc_user","bmc_pass"): m[key]=""
        return
    active = int(m.get("active_os") or 1)
    if not any(e.get("slot") == active for e in os_list):
        raise HTTPException(409, "Selected physical slot is empty; select an installed node")
    cur = node_identity.slot_entry(m, active)
    m["os_ip"] = cur.get("ip", "")
    m["os_user"] = cur.get("user", "")
    m["os_pass"] = cur.get("pass", "")
    m["os_port"] = int(cur.get("port") or 22)
    # An unpaired OS must never inherit another slot's BMC credentials.
    m["bmc_ip"] = cur.get("bmc_ip", "")
    m["bmc_user"] = cur.get("bmc_user", "")
    m["bmc_pass"] = cur.get("bmc_pass", "")
    m["bmc_port"] = int(cur.get("bmc_ssh_port") or 22)
    m["active_os"] = active


@app.get("/api/ping-ip")
def ping_ip(ip: str = ""):
    """直接 ping 一個原始 IP，回傳是否在線（用於「新增元件前檢查」）。"""
    ip = (ip or "").strip()
    if not ip:
        return {"ok": False, "alive": False}
    return {"ok": True, "ip": ip, "alive": ping_check(ip, 2)}


def _rack_ping_ip(value, label):
    """Only literal addresses can become subprocess arguments."""
    value = str(value or "").strip()
    if not value:
        return ""
    try:
        return str(ipaddress.ip_address(value))
    except ValueError as exc:
        raise HTTPException(422, f"{label}: \u0049\u0050 \u683c\u5f0f\u7121\u6548") from exc


def _rack_ping_plan(machine, topology):
    """Use host OS reachability for servers, management IP for other equipment."""
    topology = topology if isinstance(topology, dict) else {}
    name = machine["name"]
    kind = equipment_policy.classify(machine, name)["kind"]
    os_ip = _rack_ping_ip(machine.get("os_ip"), name)
    bmc_ip = _rack_ping_ip(machine.get("bmc_ip"), name)
    targets = []
    source = "none"
    canonical_nodes = node_identity.observation_nodes(machine) if kind == "server" else None
    if canonical_nodes is not None:
        for node in canonical_nodes:
            ip = _rack_ping_ip(node['ip'], name + '/' + node['node_name'])
            if ip:
                targets.append(dict(node, ip=ip, field='host_os'))
        source = "inventory_os_slots" if targets else "none"
    elif kind == "server":
        topology_nodes = {}
        configured_slots = set()
        for rack in topology.get("racks") or []:
            if not isinstance(rack, dict):
                continue
            for device in rack.get("devices") or []:
                if not isinstance(device, dict) or device.get("inventory") != name:
                    continue
                for index, node in enumerate(device.get("nodes") or [], 1):
                    if not isinstance(node, dict):
                        continue
                    topology_nodes.setdefault(index, (rack, device, node))
                    ip = _rack_ping_ip(node.get("host_os"), f"{name}/{node.get('name', '')}")
                    if ip:
                        configured_slots.add(index)
                        targets.append({"ip": ip, "field": "host_os", "rack_id": rack.get("id", ""),
                                        "device_id": device.get("id", ""), "node_id": node.get("id", ""),
                                        "node_name": node.get("name", "")})
        topology_count = len(targets)
        for index, slot in enumerate(machine.get("os") or [], 1):
            if not isinstance(slot, dict) or index in configured_slots:
                continue
            ip = _rack_ping_ip(slot.get("ip"), f"{name}/OS Slot {index}")
            if ip:
                slot_number = slot.get("slot") or index
                mapped = topology_nodes.get(index)
                target = {"ip": ip, "field": "host_os",
                          "node_id": mapped[2].get("id", "") if mapped else f"os-slot-{slot_number}",
                          "node_name": mapped[2].get("name", "") if mapped else f"OS Slot {slot_number}"}
                if mapped:
                    target.update(rack_id=mapped[0].get("id", ""),
                                  device_id=mapped[1].get("id", ""))
                targets.append(target)
        if topology_count and len(targets) > topology_count:
            source = "topology_host_os+inventory_os_slots"
        elif topology_count:
            source = "topology_host_os"
        elif targets:
            source = "inventory_os_slots"
        elif not targets and os_ip:
            targets = [{"ip": os_ip, "field": "os_ip"}]
            source = "legacy_os"
    elif os_ip or bmc_ip:
        targets = [{"ip": os_ip or bmc_ip, "field": "os_ip" if os_ip else "bmc_ip"}]
        source = "management"
    return {"name": name, "level": machine.get("level"), "kind": kind,
            "os_ip": machine.get("os_ip"), "bmc_ip": machine.get("bmc_ip"),
            "os_address": os_ip, "bmc_address": bmc_ip,
            "rack_ping_source": source, "ping_targets": targets}


@app.get("/api/rack/ping")
def rack_ping(project: str = "", name: str = ""):
    """Snapshot placed equipment and probe bounded, deduplicated address batches.

    Results are transient reachability observations, never a physical power reading.
    A server's BMC responding cannot hide a failed host OS probe.
    """
    with _DATA_LOCK:
        if name and name not in machines:
            raise HTTPException(404, f"\u6a5f\u53f0\u4e0d\u5b58\u5728: {name}")
        selected = [machine for key, machine in machines.items()
                    if _machine_allowed(key) and (not name or key == name) and (not project or machine.get("project") == project)]
        selected = [machine for machine in selected if machine.get("level") == "rack"
                    and equipment_policy.classify(machine)["kind"] != "blanking"
                    and ((isinstance(machine.get("rack_u"), int) and machine["rack_u"] > 0)
                         or (machine.get("rack_mount") == "external"
                             and equipment_policy.classify(machine)["kind"] == "cdu"))]
        snapshots = copy.deepcopy(selected)
        topologies = {project_name: copy.deepcopy(projects.get(project_name, {}).get("topology", {}))
                      for project_name in {machine.get("project") for machine in selected}}
    plans = [_rack_ping_plan(machine, topologies.get(machine.get("project"), {})) for machine in snapshots]
    # Probe only the addresses selected by the Rack Ping policy.  In particular,
    # server BMC/DPU addresses must not become hidden extra probes when Host OS
    # nodes are configured, while non-server equipment contributes one primary
    # management address.
    unique_ips = sorted({target["ip"] for plan in plans
                         for target in plan["ping_targets"]})
    if len(unique_ips) > 2048 or sum(len(plan["ping_targets"]) for plan in plans) > 4096:
        raise HTTPException(422, "\u55ae\u6b21\u6700\u591a\u6aa2\u67e5 2048 \u500b\u4e0d\u540c IP \u6216 4096 \u500b\u7bc0\u9ede IP \u6b04\u4f4d")

    started = time.monotonic()
    def probe(ip):
        return ping_check(ip, 1) or ping_check(ip, 1)

    if unique_ips:
        with ThreadPoolExecutor(max_workers=min(64, len(unique_ips))) as pool:
            states = dict(zip(unique_ips, pool.map(probe, unique_ips)))
    else:
        states = {}
    results = []
    for plan in plans:
        os_address, bmc_address = plan.pop("os_address"), plan.pop("bmc_address")
        targets = [{**target, "alive": bool(states[target["ip"]])} for target in plan["ping_targets"]]
        alive = sum(target["alive"] for target in targets)
        count = len(targets)
        status = "unknown" if not count else "up" if alive == count else "partial" if alive else "down"
        results.append({**plan, "os_alive": states.get(os_address), "bmc_alive": states.get(bmc_address),
                        "rack_ping_state": status, "ping_targets": targets,
                        "ping_counts": {"configured": count, "alive": alive, "down": count - alive}})
    return {"ok": True, "nodes": results,
            "checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "duration_ms": round((time.monotonic() - started) * 1000),
            "unique_ips": len(unique_ips)}


# ---- 機櫃拓樸 / 連線圖 ----
@app.get("/api/projects/{name}/topology")
def get_project_topology(name: str):
    with _DATA_LOCK:
        if name not in projects:
            raise HTTPException(404, "找不到專案")
        return copy.deepcopy(projects[name].get("topology", {"revision": 0, "racks": []}))


@app.put("/api/projects/{name}/topology")
@_data_transaction
def put_project_topology(name: str, body: dict):
    if name not in projects:
        raise HTTPException(404, "找不到專案")
    current = projects[name].get("topology", {"revision": 0, "racks": []})
    revision = body.get("revision")
    if type(revision) is not int or revision != current["revision"]:
        raise HTTPException(409, "其他視窗已修改拓樸。請先匯出目前草稿，再重新載入後重試。")
    try:
        document = topology_policy.validate(body)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    document["revision"] = revision + 1
    projects[name]["topology"] = document
    _save_data()
    return copy.deepcopy(document)


_TOPOLOGY_PING_FIELDS = ("host_os",)


def _topology_ping_targets(document: dict, rack_id: str, inventory=None):
    """Resolve server OS nodes and each non-server's primary inventory address."""
    racks = document.get("racks", [])
    selected = next((rack for rack in racks if rack.get("id") == rack_id), None)
    if selected is None:
        raise HTTPException(404, "找不到指定的機櫃")
    targets = []
    inventory = inventory if isinstance(inventory, dict) else {}

    def address(value, label):
        value = str(value or "").strip()
        if not value:
            return ""
        try:
            return str(ipaddress.ip_address(value))
        except ValueError as exc:
            raise HTTPException(422, f"{label}\uff1aIP \u683c\u5f0f\u7121\u6548") from exc

    for device in selected.get("devices", []):
        machine = inventory.get(device.get("inventory", ""))
        canonical_nodes = (node_identity.observation_nodes(machine)
                           if isinstance(machine, dict) and device.get("kind") == "server" else None)
        if canonical_nodes is not None:
            for node in canonical_nodes:
                ip = address(node['ip'], node['node_name'])
                if ip:
                    targets.append(dict(node, ip=ip, field='host_os', device_id=device.get('id','')))
            continue
        if device.get("kind") == "server":
            saved_nodes = device.get("nodes", [])
            for node in saved_nodes:
                device_name = device.get("name") or "\u8a2d\u5099"
                node_name = node.get("name") or "\u7bc0\u9ede"
                ip = address(node.get("host_os"),
                             device_name + "\uff0f" + node_name)
                if not ip:
                    continue
                targets.append({
                    "device_id": device.get("id", ""), "node_id": node.get("id", ""),
                    "node_name": node.get("name", ""), "field": "host_os", "ip": ip,
                })
        machine = inventory.get(device.get("inventory", ""))
        if not isinstance(machine, dict):
            continue
        if device.get("kind") == "server":
            for index, slot in enumerate(machine.get("os") or [], 1):
                if not isinstance(slot, dict):
                    continue
                saved_node = (saved_nodes[index - 1]
                              if index <= len(saved_nodes)
                              and isinstance(saved_nodes[index - 1], dict) else {})
                if str(saved_node.get("host_os") or "").strip():
                    continue
                ip = address(slot.get("ip"), device.get("name", "\u8a2d\u5099"))
                if ip:
                    slot_number = slot.get("slot") or index
                    targets.append({"device_id": device.get("id", ""),
                                    "node_id": saved_node.get("id") or f"os-slot-{slot_number}",
                                    "node_name": f"OS Slot {slot_number}",
                                    "field": "host_os", "ip": ip})
            if any(target["device_id"] == device.get("id", "") for target in targets):
                continue
        ip = address(machine.get("os_ip") or machine.get("bmc_ip"),
                     device.get("name", "\u8a2d\u5099"))
        if ip:
            targets.append({"device_id": device.get("id", ""), "node_id": "", "node_name": "",
                            "field": "primary_ip", "ip": ip})
    return targets


@app.post("/api/projects/{name}/topology/ping")
def ping_project_topology(name: str, body: dict):
    """Probe the fixed IPs recorded for one rack; results are transient."""
    rack_id = str(body.get("rack_id", "")).strip()
    if not rack_id:
        raise HTTPException(422, "請選擇要檢查的機櫃")
    with _DATA_LOCK:
        if name not in projects:
            raise HTTPException(404, "找不到專案")
        document = copy.deepcopy(projects[name].get("topology", {"revision": 0, "racks": []}))
        inventory = {machine_name: copy.deepcopy(machine) for machine_name, machine in machines.items()
                     if machine.get("project") == name}
    targets = _topology_ping_targets(document, rack_id, inventory)
    if len(targets) > 4096:
        raise HTTPException(422, "單次最多檢查 4096 個 IP 欄位")
    unique_ips = sorted({target["ip"] for target in targets})
    if len(unique_ips) > 2048:
        raise HTTPException(422, "單次最多檢查 2048 個不同 IP")

    started = time.monotonic()
    def probe(ip):
        # Retry once to reduce a single dropped ICMP packet being shown as a failure.
        return ping_check(ip, 1) or ping_check(ip, 1)

    if unique_ips:
        with ThreadPoolExecutor(max_workers=min(64, len(unique_ips))) as pool:
            states = dict(zip(unique_ips, pool.map(probe, unique_ips)))
    else:
        states = {}
    results = [{**target, "alive": bool(states[target["ip"]])} for target in targets]
    alive = sum(1 for target in results if target["alive"])
    return {
        "ok": True, "rack_id": rack_id,
        "checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "duration_ms": round((time.monotonic() - started) * 1000),
        "targets": results,
        "summary": {"configured": len(results), "unique_ips": len(unique_ips),
                    "alive": alive, "down": len(results) - alive},
    }


@app.get("/api/links")
def list_links():
    """回傳所有連線。"""
    from legacy_links import ensure_ids
    with _DATA_LOCK:
        ensure_ids(links)
    return {"ok": True, "links": [link for link in links if _machine_allowed(link.get("a")) and _machine_allowed(link.get("b"))]}


@app.post("/api/links")
@_data_transaction
def add_link(body: dict):
    """新增連線 {a, a_port, b, b_port, type}。type: eth/ib/power/coolant。"""
    a = str(body.get("a", "")).strip()
    b = str(body.get("b", "")).strip()
    t = str(body.get("type", "eth")).strip()
    a_port = str(body.get("a_port", "") or "").strip()
    b_port = str(body.get("b_port", "") or "").strip()
    if not a or not b or a == b:
        raise HTTPException(400, "連線需要兩個不同端點")
    if a not in machines or b not in machines:
        raise HTTPException(422, "Both link endpoints must exist")
    if t not in ("eth", "ib", "power", "coolant"):
        raise HTTPException(422, "Invalid link type")
    from legacy_links import ensure_ids, signature
    ensure_ids(links)
    candidate = {"a": a, "b": b, "type": t, "a_port": a_port or None, "b_port": b_port or None}
    if any(signature(link) == signature(candidate) for link in links):
        return {"ok": True, "note": "Already exists", "links": [link for link in links if _machine_allowed(link.get("a")) and _machine_allowed(link.get("b"))]}
    # 去重（無向）：同兩端且同類型視為同一條（允許 a_port/b_port 不同→多條同類型連線）
    links.append(candidate)
    ensure_ids(links)
    _save_data()
    return {"ok": True, "links": [link for link in links if _machine_allowed(link.get("a")) and _machine_allowed(link.get("b"))]}


@app.delete("/api/links")
@_data_transaction
def delete_link(body: dict):
    """刪除連線 {a, b}。"""
    from legacy_links import ensure_ids, matches
    ensure_ids(links)
    a = str(body.get("a", "")).strip()
    b = str(body.get("b", "")).strip()
    candidates = [i for i, link in enumerate(links) if matches(link, body)]
    if len(candidates) > 1:
        raise HTTPException(409, "Ambiguous link; reload and specify its id")
    if candidates:
        links.pop(candidates[0])
        _save_data()
        return {"ok": True, "links": [link for link in links if _machine_allowed(link.get("a")) and _machine_allowed(link.get("b"))]}
    return {"ok": True, "note": "未找到", "links": [link for link in links if _machine_allowed(link.get("a")) and _machine_allowed(link.get("b"))]}


def _operation_target(name, body):
    with _DATA_LOCK:
        m = copy.deepcopy(machines[name])
    expected = (body or {}).get("expected_target")
    if expected is not None:
        actual = {"active_os": int(m.get("active_os") or 1), "os_ip": m.get("os_ip") or "", "bmc_ip": m.get("bmc_ip") or ""}
        if expected != actual:
            raise HTTPException(409, "Operation target changed. Reload and confirm the selected OS and BMC.")
    return m


@app.post("/api/machine/{name}/power")
def machine_power(name: str, body: dict):
    """對機台開/關機。body: {on: bool}。優先使用該機台的自訂 power 指令。"""
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    if type(body.get("on")) is not bool:
        raise HTTPException(422, "on must be a boolean")
    if not equipment_policy.can_power(machines[name], body["on"]):
        raise HTTPException(400, "Server power control is unavailable for this equipment")
    _POWER.pop(name, None)
    m = _operation_target(name, body)
    action = "poweron" if body.get("on") else "poweroff"
    ok, info = run_control_cmd(m, action)
    # 狀態查詢：自訂指令不存在 power status → 略過
    if m.get("power_on_cmd") or m.get("power_off_cmd"):
        return {"ok": ok, "action": "on" if body.get("on") else "off", "info": info, "power_status": ""}
    _, status = ipmi_power(m, "status")
    return {"ok": ok, "action": "on" if body.get("on") else "off", "info": info, "power_status": (status or "").strip()}


@app.post("/api/machine/{name}/aux")
def machine_aux_cycle(name: str, body: dict = None):
    """對機台執行 AUX / AC cycle（ac cycle）。優先使用自訂 aux_cmd。"""
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    _POWER.pop(name, None)  # AC cycle 後狀態作廢
    m = _operation_target(name, body)
    ok, info = run_control_cmd(m, "aux")
    return {"ok": ok, "action": "aux", "info": info}


@app.post("/api/machine/{name}/reboot")
def machine_reboot(name: str, body: dict = None):
    """對機台執行 OS reboot。透過 sshpass/ssh 到 OS 下 reboot；無 OS 才改用 BMC chassis power reset。"""
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    m = _operation_target(name, body)
    ok, info = _reboot_machine(m)
    return {"ok": ok, "action": "reboot", "info": info}


def _reboot_machine(m):
    """OS reboot：SSH 進 OS 下 reboot。若無 OS 連線資訊，退而求其次用 BMC chassis power reset。"""
    if m.get("os_ip") and m.get("os_user") and m.get("os_pass"):
        out, rc, err = ssh_run(m["os_ip"], m.get("os_user", ""), m.get("os_pass", ""),
                               m.get("os_port", 22), "sudo -n true 2>/dev/null && sudo reboot || reboot", timeout=10)
        if rc == 0:
            return True, "已送出 reboot（OS）— SSH 可能馬上斷線代表正在重開"
        if err and ("closed" in err.lower() or "broken" in err.lower()):
            return False, "SSH disconnected; reboot acceptance is unconfirmed. Check power state before retrying."
        return False, f"SSH 無法送 reboot：{err or '無回應'}"
    if m.get("bmc_ip") and m.get("bmc_user") and m.get("bmc_pass"):
        ok, info = ipmi_power(m, "reset")
        return ok, f"（無 OS，改用 BMC power reset）{info}"
    return False, "此元件無 OS 亦無 BMC，無法 reboot"


@app.get("/api/machine/{name}/power")
def machine_power_status(name: str):
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    ok, status = ipmi_power(machines[name], "status")
    return {"ok": ok, "power_status": (status or "").strip()}


# ---- 硬體資訊（CPU / DIMM / SSD / NIC / GPU 型號）----
_HW_CMD = (
    "echo '===HW==='; "
    "echo '__CPU__'; lscpu 2>/dev/null | grep -E 'Model name:|Socket\\(s\\)|Core\\(s\\) per socket|Thread\\(s\\) per core|CPU\\(s\\):' ; "
    "echo '__DIMM__'; dmidecode -t memory 2>/dev/null | grep -E 'Size:|Type:|Speed:|Part Number:|Manufacturer:' | grep -v 'No Module' | grep -v 'Unknown' ; "
    "echo '__SOCKETDIMM__'; dmidecode -t memory 2>/dev/null | grep -c 'Size: ' ; "
    "echo '__BLK__'; lsblk -d -o NAME,MODEL,SIZE,TRAN 2>/dev/null | grep -v loop ; "
    "echo '__NIC__'; lspci 2>/dev/null | grep -Ei 'Ethernet|Network controller|InfiniBand' ; "
    "echo '__IPLINK__'; ip -o link show 2>/dev/null | awk -F': ' '{print $2}' | grep -Ev '^(lo|dummy|docker|virbr|veth|br-|vlan)' | sed 's/@.*//' ; "
    "echo '__GPU__'; nvidia-smi --query-gpu=index,name,memory.total,utilization.gpu --format=csv,noheader 2>/dev/null ; "
    "echo '__AMDGPU__'; rocm-smi --showproductname 2>/dev/null ; rocm-smi --showmeminfo vram 2>/dev/null ; "
    "echo '__GPULSPCI__'; lspci -nn 2>/dev/null | grep -Ei '3D controller|Processing accelerators' | grep -Ei 'NVIDIA|Advanced Micro Devices|AMD' ; "
    "echo '__AMD_ROCM__' ; rocm-smi --showuse 2>/dev/null ; rocm-smi --showtemp 2>/dev/null ; rocm-smi --showpower 2>/dev/null ; "
    "echo '__FW__'; dmidecode -t bios 2>/dev/null | grep -E 'Vendor:|Version:|Release Date:' | sed 's/^[[:space:]]*//' ; "
    "echo '__FW_SSD__'; for n in /sys/class/nvme/nvme[0-9]/firmware_rev; do [ -f \"$n\" ] && fw=$(cat \"$n\" | tr -d '[:space:]') && [ -n \"$fw\" ] && echo \"$(basename $(dirname $n)): $fw\"; done ; "
    "echo '__FW_NIC__'; for i in $(ls /sys/class/net/ 2>/dev/null | grep -Ev '^(lo|docker|veth|virbr|br-)'); do fw=$(ethtool -i \"$i\" 2>/dev/null | awk -F': ' '/firmware-version/{gsub(/^ +| +$/,\"\",$2); print $2}'); [ -n \"$fw\" ] && echo \"$i: $fw\"; done ; "
    "echo '__FW_GPU__'; nvidia-smi --query-gpu=index,name,vbios_version --format=csv,noheader 2>/dev/null ; if command -v amd-smi >/dev/null 2>&1; then amd-smi static --json 2>/dev/null | python3 -c 'import sys,json;[print(str(c.get(\"gpu\",\"\"))+\",\"+str((c.get(\"asic\") or {}).get(\"market_name\",\"AMD GPU\"))+\",\"+str((c.get(\"vbios\") or {}).get(\"version\",\"\"))) for c in json.load(sys.stdin)]' 2>/dev/null ; fi ; "
    "true"
)

def parse_hw(text):
    """解析硬體命令輸出 → {cpu, dimm, ssd, nic, gpu}。回 None 表示無法解析。"""
    if not text:
        return None
    hw = {}
    # CPU
    cpu_line = next((l for l in text.splitlines() if "Model name:" in l), "")
    sockets = next((l.split(":")[1].strip() for l in text.splitlines() if l.strip().startswith("Socket")), "")
    cores_s = next((l.split(":")[1].strip() for l in text.splitlines() if "Core(s) per socket" in l), "")
    thr_s = next((l.split(":")[1].strip() for l in text.splitlines() if "Thread(s) per core" in l), "")
    cpu = cpu_line.split("Model name:")[1].strip() if "Model name:" in cpu_line else ""
    if cpu:
        hw["cpu"] = {"model": cpu, "sockets": sockets, "cores": cores_s, "threads": thr_s}
    # DIMM：抓所有 Size + 唯一 Part Number + Manufacturer + Type/Speed
    sizes, parts, manufacturers, types, speeds = [], [], [], [], []
    for l in text.splitlines():
        s = l.strip()
        if s.startswith("Size:"):
            v = s.split(":", 1)[1].strip()
            if v and v != "No Module Installed":
                sizes.append(v)
        elif s.startswith("Part Number:"):
            v = s.split(":", 1)[1].strip()
            if v and v.upper() != "NO DIMM" and v not in parts:
                parts.append(v)
        elif s.startswith("Manufacturer:"):
            v = s.split(":", 1)[1].strip()
            if v and v.upper() != "UNKNOWN" and v not in manufacturers:
                manufacturers.append(v)
        elif s.startswith("Type:") and "Error" not in s and s != "Type: Unknown":
            v = s.split(":", 1)[1].strip()
            if v and v not in types:
                types.append(v)
        elif s.startswith("Speed:"):
            v = s.split(":", 1)[1].strip()
            if v and "Unknown" not in v and v not in speeds:
                speeds.append(v)
    if parts:
        hw["dimm"] = {"count": len(sizes), "parts": parts, "manufacturers": manufacturers, "types": types, "speeds": speeds}
    def _section(start, end=None):
        """擷取 start 標記到 end（或下一個 __XX__ 標記）之間的非空行。"""
        lines = text.splitlines()
        out, on = [], False
        for ln in lines:
            s = ln.strip()
            if s.startswith("__") and s.endswith("__") and not s.startswith(start):
                if on and end is None:
                    break
            if s == start:
                on = True
                continue
            if end is not None and s == end:
                break
            if on and s:
                out.append(s)
        return out

    # SSD / NVMe（lsblk：NAME MODEL SIZE TRAN）
    devs = []
    for l in _section("__BLK__", "__NIC__"):
        cols = l.split()
        if len(cols) >= 2 and "model" not in cols[1].lower() and cols[0].lower() != "name":
            devs.append({"name": cols[0], "model": " ".join(cols[1:-2]),
                         "size": cols[-2] if len(cols) >= 3 else "", "tran": cols[-1] if cols else ""})
    devs = [d for d in devs if d.get("model") and d["model"].lower() not in ("loop",) and d["name"].lower().startswith(("nvme", "sd", "hd", "vd", "md"))]
    if devs:
        hw["ssd"] = devs
    # NIC（優先 lspci；不同品牌網卡名稱各異，若 LSPCI 抓不到改用 ip link 列出實體網卡）
    nics = _section("__NIC__", "__IPLINK__")
    if not nics:
        nics = [f"網路介面：{s}" for s in _section("__IPLINK__", "__GPU__")]
    if nics:
        hw["nic"] = nics
    # GPU（nvidia-smi: index,name,mem_total,util）
    gpus = []
    for l in _section("__GPU__"):
        parts = [p.strip() for p in l.split(",")]
        if len(parts) >= 4:
            gpus.append({"name": parts[1], "mem": parts[2], "util": parts[3]})
    if not gpus:
        # AMD GPU：rocm-smi --showproductname 每張卡各有一行「Card Series」→ 張數/型號；
        # --showmeminfo vram 抓 VRAM Total Memory (B) → 顯示用 GiB。與 NVIDIA {name,mem,util} 同構。
        amd_lines = _section("__AMDGPU__")
        am_name = None
        am_count = 0
        am_mem_mib = None
        for l in amd_lines:
            if "Card Series" in l:
                am_count += 1
                v = l.split("Card Series", 1)[1].strip(": ").strip()
                if v:
                    am_name = v
            if "VRAM Total Memory (B)" in l:
                try:
                    b = float(l.split("VRAM Total Memory (B):", 1)[1].strip())
                    am_mem_mib = int(round(b / (1024 ** 2)))
                except Exception:
                    pass
        if am_count:
            memtxt = str(am_mem_mib) if am_mem_mib else ""
            gpus = [{"name": am_name or "AMD GPU", "mem": memtxt, "util": ""} for _ in range(am_count)]
    if not gpus:
        # 第三級備案：nvidia-smi / rocm-smi 皆無輸出（如 GPU driver 未 load）→
        # 用 lspci -nn 辨識「誰家的卡、幾張」（只有型別/張數，無 mem/util）。
        # NVIDIA：3D controller；AMD Instinct：Processing accelerators。
        lpcis = _section("__GPULSPCI__", "__AMD_ROCM__")
        pcis = []
        for l in lpcis:
            vendor = "NVIDIA" if ("NVIDIA" in l.upper()) else ("AMD" if ("AMD" in l.upper() or "Advanced Micro Devices" in l) else None)
            if not vendor:
                continue
            # -nn 格式：裝置名稱後附 [vendor:device ID]
            idm = re.search(r"\[([0-9a-fA-F]{4}):([0-9a-fA-F]{4})\]\s*$", l)
            pcis.append({"vendor": vendor, "dev_id": idm.group(2).upper() if idm else "", "raw": l})
        if pcis:
            for i, p in enumerate(pcis):
                nm = p["vendor"] + (" Device " + p["dev_id"] if p["dev_id"] else "")
                gpus.append({"name": nm, "mem": "", "util": "", "note": "lspci 偵測（GPU 工具無輸出，可能未載入 driver/工具鏈）"})
    if gpus:
        hw["gpu"] = gpus

    # Firmware 版本（BIOS / NVMe SSD / NIC / GPU）——跨 vendor 用標準工具容錯收集
    fw = {}
    bios = {}
    for l in _section("__FW__", "__FW_SSD__"):
        k, _, v = l.partition(":")
        ke = k.strip().lower()
        if "vendor" in ke: bios["vendor"] = v.strip()
        elif "version" in ke: bios["version"] = v.strip()
        elif "release" in ke: bios["release"] = v.strip()
    if bios:
        fw["bios"] = bios
    ssd_fw = []
    for l in _section("__FW_SSD__", "__FW_NIC__"):
        d, _, v = l.partition(":")
        if v.strip():
            ssd_fw.append({"dev": d.strip(), "fw": v.strip()})
    if ssd_fw:
        fw["ssd"] = ssd_fw
    nic_fw = []
    for l in _section("__FW_NIC__", "__FW_GPU__"):
        i, _, v = l.partition(":")
        if v.strip():
            nic_fw.append({"iface": i.strip(), "fw": v.strip()})
    if nic_fw:
        fw["nic"] = nic_fw
    gpu_fw = []
    for l in _section("__FW_GPU__"):
        parts = [p.strip() for p in l.split(",")]
        # nvidia-smi csv: index,name,firmware_version
        if len(parts) >= 3:
            gpu_fw.append({"index": parts[0], "name": parts[1], "fw": parts[2]})
    if gpu_fw:
        fw["gpu"] = gpu_fw
    if fw:
        hw["firmware"] = fw
    return hw or None


def _parse_os_summary(raw):
    """從 os_info raw（uname+OSREL+UPTIME+CPU+MEM）解析出簡潔結構。"""
    s = {"uname": "", "distro": "", "uptime": "", "cpu": "", "mem": ""}
    if not raw:
        return s
    section, distro_vals = "", {}
    for line in raw.splitlines():
        line = line.rstrip()
        if line.startswith("---"):
            section = line.strip("-").strip()
            continue
        if section == "OSREL":
            if "=" in line:
                k, v = line.split("=", 1)
                distro_vals[k] = v.strip('"')
        elif section == "UPTIME" and line.strip():
            s["uptime"] = line.strip()
        elif section == "CPU" and line.strip():
            s["cpu"] = line.strip()
        elif section == "MEM" and line.strip():
            s["mem"] = line.strip()
        elif not section and not s["uname"] and line.strip():
            s["uname"] = line.strip()
    s["distro"] = distro_vals.get("PRETTY_NAME", distro_vals.get("NAME", ""))
    if distro_vals.get("VERSION_ID") and "VERSION_ID" not in distro_vals.get("PRETTY_NAME", ""):
        s["distro"] = f'{distro_vals.get("PRETTY_NAME", distro_vals.get("NAME",""))}' or s["distro"]
    return s


_os_hw_cache = {}            # name -> {cpu,dimm,ssd,nic,gpu}（硬體型號，變化極低）
_os_hw_time = {}             # name -> 抓取時間

# BMC FW / 電源快取：OOB lanplus 對 Cisco CIMC 等每連一次可達 15s，避免每次 detail 都卡。
# refresh=1 時強制重抓；一般瀏覽用 TTL 秒數內秒回。
_bmc_fw_cache = {}           # name -> (ts, fw_list)
_bmc_pwr_cache = {}          # name -> (ts, power_str)
_BMC_TTL = 60                # 秒
_bmc_pending = set()         # name -> 背景抓取進行中

_network_identity_cache = {}
_network_identity_pending = set()
_network_identity_lock = threading.Lock()


def _network_identity(m, refresh=False):
    # Bind evidence to the selected slot and exact addresses, never just the name.
    key = (m.get("name"), m.get("active_os"), m.get("os_ip"),
           m.get("os_port"), m.get("bmc_ip"))
    empty = {"os": None, "bmc": None}
    with _network_identity_lock:
        cached = _network_identity_cache.get(key)
        if key in _network_identity_pending:
            return {**empty, "loading": True}
        if cached and not refresh and time.monotonic() - cached[0] < 60:
            return cached[1]
        _network_identity_pending.add(key)

    def collect():
        result = dict(empty)
        try:
            result = network_identity.collect(m, ssh_run)
        except Exception:
            pass
        result["checked_at"] = datetime.datetime.now().isoformat(timespec="seconds")
        with _network_identity_lock:
            if len(_network_identity_cache) >= 256:
                _network_identity_cache.pop(next(iter(_network_identity_cache)))
            _network_identity_cache[key] = (time.monotonic(), result)
            _network_identity_pending.discard(key)
    threading.Thread(target=_background_target(collect), daemon=True).start()
    return {**empty, "loading": True}


_os_access_cache = {}

@app.get("/api/machine/{name}/detail")
def machine_detail(name: str, refresh: int = 0):
    """單機詳細頁：BMC/OS 資訊（只讀，不做開關機）。
    refresh=1 時強制重新抓取 OS/HW 資訊（「重新整理」按鈕）。"""
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    m = copy.deepcopy(machines[name])
    base = _bmc_safe(m)
    out = {"machine": base}
    if telemetry_core.kind_of(m, name) == "cdu":
        out["cdu"] = {"collector": "not_implemented", "management_ip": m.get("os_ip") or "",
                      "installation": m.get("rack_mount") or "internal"}
        return out
    out["network_identity"] = _network_identity(copy.deepcopy(m), bool(refresh))
    now = datetime.datetime.now()

    # ---- OS / 硬體資訊（SSH） ----
    if base.get("os_alive"):
        want_fresh = bool(refresh) or name not in _os_info_cache
        if want_fresh:
            hostname, rc, err = ssh_run(m["os_ip"], m.get("os_user",""), m.get("os_pass",""), m.get("os_port",22),
                                        "uname -a && echo ---OSREL--- && cat /etc/os-release 2>/dev/null | head -4 && echo ---UPTIME--- && uptime && echo ---CPU--- && nproc && echo ---MEM--- && free -h | head -2 && echo ---GPU--- && (nvidia-smi --query-gpu=name,memory.total,memory.used,utilization.gpu --format=csv,noheader 2>/dev/null || rocm-smi --showuse 2>/dev/null || rocm-smi --showmemuse vram 2>/dev/null) | head -20")
            if machines.get(name) == m:
                _os_access_cache[name] = {"source": "SSH", "observed_at": time.time(),
                    "state": "success" if rc == 0 else "authentication_failed" if any(t in (err or "").lower() for t in ("authentication", "permission denied")) else "connection_failed"}
            if rc == 0 and hostname:
                if machines.get(name) != m:
                    raise HTTPException(409, "Target changed; reload the selected OS")
                _os_info_cache[name] = hostname
                _os_info_time[name] = now.isoformat(timespec="seconds")
        # 硬體型號（CPU/DIMM/SSD/NIC/GPU）— 變化極低；refresh 時也重新抓
        if name not in _os_hw_cache or refresh:
            try:
                hwout, hw_rc, _ = ssh_run(m["os_ip"], m.get("os_user",""), m.get("os_pass",""), m.get("os_port",22),
                                          _HW_CMD, timeout=20)
                hw = parse_hw(hwout) if hw_rc == 0 else None
                if hw and machines.get(name) == m:
                    _os_hw_cache[name] = hw
                    _os_hw_time[name] = now.isoformat(timespec="seconds")
            except Exception:
                pass

        hostname = _os_info_cache.get(name, "")
        out["os_info"] = {"raw": hostname, "fetched_at": _os_info_time.get(name),
                          "os": _parse_os_summary(hostname)}
        out["os_info_cached"] = (not want_fresh and name in _os_info_cache)
        if name in _os_hw_cache:
            out["os_info"]["hw"] = _os_hw_cache.get(name)
            out["os_info"]["hw_fetched_at"] = _os_hw_time.get(name)
        if not hostname:
            out["os_info"]["cached_note"] = "SSH 無回應，暫無 OS 資訊"
    else:
        # 關機/不可連 → 回傳最後一次成功抓取的資訊
        out["os_info"] = {"raw": _os_info_cache.get(name, ""),
                          "fetched_at": _os_info_time.get(name)}
        out["os_info_cached"] = (name in _os_info_cache)
        if name in _os_hw_cache:
            out["os_info"]["hw"] = _os_hw_cache.get(name)
            out["os_info"]["hw_fetched_at"] = _os_hw_time.get(name)
        if name in _os_info_cache:
            out["os_info"]["cached_note"] = "此為最後一次成功抓取的資訊（機台目前不可連）"

    # ---- BMC：FW + 電源（有快取秒回；refresh=1 強制重抓；首次背景非同步） ----
    if base.get("bmc_alive"):
        nowts = time.time()
        fw_ts, fw = _bmc_fw_cache.get(name, (0, []))
        pwr_ts, pwr = _bmc_pwr_cache.get(name, (0, ""))
        fw_fresh = (nowts - fw_ts) < _BMC_TTL
        pwr_fresh = (nowts - pwr_ts) < _BMC_TTL
        if fw_fresh and pwr_fresh and not refresh:
            out["fw"], out["power"] = fw, pwr
        elif name in _bmc_pending:
            # refresh 明確要求，或背景抓取已進行中 → 回目前快取（可能為空）
            out["fw"], out["power"] = fw, pwr
            out["bmc_loading"] = (name in _bmc_pending)
        else:
            # 首次進入：背景抓取，先回空 + bmc_loading，前端稍後輪詢
            _bmc_pending.add(name)
            out["fw"], out["power"] = fw, pwr
            out["bmc_loading"] = True
            snapshot = copy.deepcopy(m)
            def _bg(name=name):
                try:
                    nf = ipmi_fw_list(snapshot)
                    ok, npwr = ipmi_power(snapshot, "status")
                    if machines.get(name) != snapshot:
                        return
                    _bmc_fw_cache[name] = (time.time(), nf)
                    _bmc_pwr_cache[name] = (time.time(), npwr)
                except Exception:
                    pass
                finally:
                    _bmc_pending.discard(name)
            threading.Thread(target=_background_target(_bg), daemon=True).start()
        # 感測器（sdr list）很慢，由前端呼叫 /sensors 非同步載入。
    out["ssh_observation"] = _os_access_cache.get(name)
    out["bmc_fetched_at"] = {"firmware": _bmc_fw_cache.get(name, (None,))[0], "power": _bmc_pwr_cache.get(name, (None,))[0]}
    return out


# ---- 感測器（慢，獨立端點 + 背景快取）----
_sensors_cache = {}          # name -> data
_sensors_time = {}           # name -> timestamp
_sensors_pending = {}        # name -> 是否有抓取執行中（避免併發重複抓）
_SENSORS_TTL = 600           # 秒內直接回傳快取（感測器 sdr list 抓取慢且狀態變動不快，TTL 太短會讓前端頻繁出現『背景重抓中』）
_sensors_lock = threading.Lock()

def _fetch_sensors_async(name: str):
    """背景執行 ipmitool sdr list，結果寫入快取（同一時間只抓一台一次）。"""
    with _sensors_lock:
        if _sensors_pending.get(name):
            return
        _sensors_pending[name] = True
    try:
        m = copy.deepcopy(machines.get(name))
        if not m:
            return
        data = ipmi_sensor_summary(m)
        if machines.get(name) != m:
            return
        with _sensors_lock:
            _sensors_cache[name] = data
            _sensors_time[name] = time.time()
    except Exception:
        pass
    finally:
        with _sensors_lock:
            _sensors_pending.pop(name, None)


@app.get("/api/machine/{name}/sensors")
def machine_sensors(name: str, refresh: int = 0):
    """感測器：有快取立即回，否則啟動背景抓取並回傳 loading 提示。
    refresh=1 時忽略 TTL，直接重新抓取。"""
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    if refresh:
        _sensors_time.pop(name, None)   # 強制視為過期 → 啟動重抓
    now = time.time()
    with _sensors_lock:
        t = _sensors_time.get(name)
        fresh = t is not None and (now - t) < _SENSORS_TTL
        cached = _sensors_cache.get(name)
    if fresh and cached is not None:
        return {"machine": name, "sensors": cached, "fetched_at": t, "loading": False, "cached": True}
    if cached is not None:
        # 快取過期：先回舊值，背後重新抓
        with _sensors_lock:
            pending = _sensors_pending.get(name)
        if not pending:
            th = threading.Thread(target=_background_target(_fetch_sensors_async), args=(name,), daemon=True)
            th.start()
        return {"machine": name, "sensors": cached, "fetched_at": t, "loading": True, "cached": True, "refreshing": True}
    # 完全沒有快取：啟動背景抓取，回傳 loading
    with _sensors_lock:
        pending = _sensors_pending.get(name)
    if not pending:
        th = threading.Thread(target=_background_target(_fetch_sensors_async), args=(name,), daemon=True)
        th.start()
    return {"machine": name, "sensors": None, "loading": True, "cached": False}


@app.get("/api/machine/{name}/sensors/analyze")
def machine_sensors_analyze(name: str):
    """針對單機 BMC 感測器摘要（sdr）叫本機 AI 做『簡短』診斷。
    讀取已抓取到的感測器快取，把 ok/ns/critical/warning 數量與條目給 LLM，回一段話。
    即使只有 OK / No Reading 也會呼叫 AI 分析（點出 ns 數量與感測器類別，供維運判斷）。"""
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    with _sensors_lock:
        cached = _sensors_cache.get(name)
    if not cached or cached.get("error"):
        return {"ok": False, "error": "感測器尚未抓取完成，稍後再試"}

    summary = _sensor_summary(cached)
    crit_lines = "；".join(cached.get("critical_entries") or [])[-600:]
    warn_lines = "；".join(cached.get("warning_entries") or [])[-600:]
    ns_lines = "；".join(cached.get("ns_entries") or [])[-600:]
    detail = []
    if crit_lines:
        detail.append(f"Critical：{crit_lines}")
    if warn_lines:
        detail.append(f"Warning：{warn_lines}")
    if ns_lines:
        detail.append(f"No Reading：{ns_lines}")
    if not detail:
        detail.append("無異常條目（所有感測器皆正常回讀數值）")
    sys_prompt = (
        "你是伺服器 BMC/IPMI 感測器的資深維運工程師。使用者會給你單台的感測器摘要。\n"
        "請用繁體中文，回覆**非常簡短**的一段話（2~3 句內，勿超過 3 句），語氣平實：\n"
        "1) 先一句：整體感測器狀態『正常』還是『需留意』。\n"
        "2) 若有 No Reading（ns）或其他異常，簡短點出數量與最需注意的感測器名稱（例如電源／風扇／溫度感測器沒回讀數值可能代表感測器異常或線路問題）；若全部正常則不需列。\n"
        "3) 不要列點、不要給指令、不要重複列出所有數值。"
    )
    user_prompt = f"以下為該機台 BMC 感測器摘要：\n{summary}\n條目：\n{('；'.join(detail) if detail else '')}\n請給簡短診斷："
    try:
        txt = _llm_chat(sys_prompt, user_prompt, temperature=0.3, max_tokens=320, timeout=45)
        if not txt:
            return {"ok": False, "error": "AI 未產生內容"}
    except Exception as e:
        return {"ok": False, "error": f"AI 診斷失敗: {e}"}
    return {"ok": True, "summary": summary, "analysis": txt,
            "counts": {"total": cached.get("total", 0), "ok": cached.get("ok", 0),
                       "critical": cached.get("critical", 0), "warning": cached.get("warning", 0),
                       "ns": cached.get("ns", 0)}}


def _sensor_summary(s):
    return (f"共 {s.get('total',0)} 筆感測器：Critical {s.get('critical',0)}、"
            f"Warning {s.get('warning',0)}、OK {s.get('ok',0)}、其他 {s.get('ns',0)}。")

# ---- 專案分類 ----
@app.post("/api/projects")
@_data_transaction
def add_project(body: AddProject):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "專案名稱不能為空")
    if name in projects:
        raise HTTPException(400, f"專案已存在: {name}")
    order = max([p.get("order", 0) for p in projects.values()] or [-1]) + 1
    projects[name] = {"name": name, "desc": body.desc, "order": order}
    _save_data()
    return {"ok": True, "project": projects[name]}


@app.get("/api/projects")
def list_projects():
    result = []
    # 依手動順序排列
    for name in sorted(projects, key=lambda k: projects[k].get("order", 0)):
        p = projects[name]
        if not _project_allowed(name): continue
        count = sum(1 for m in machines.values() if m.get("project") == p["name"])
        result.append({**p, "machine_count": count, "index": list(projects.keys()).index(name)})
    return {"projects": result}


@app.post("/api/machines/reorder")
@_data_transaction
def reorder_machines(body: dict):
    """批次設定機台順序：{names: [hostname...]} 依序寫入 order，只存檔一次。
    用於 System Manager 拖曳換位，避免逐台 PATCH 多次寫檔。"""
    names = body.get("names", [])
    if not names:
        raise HTTPException(400, "names 不能為空")
    for i, n in enumerate(names):
        if n in machines:
            machines[n]["order"] = i
    _save_data()
    return {"ok": True}


@app.post("/api/projects/reorder")
@_data_transaction
def reorder_projects(body: dict):
    names = body.get("names", [])
    if not names:
        raise HTTPException(400, "names 不能為空")
    for i, n in enumerate(names):
        if n in projects:
            projects[n]["order"] = i
    _reindex_projects()
    _save_data()
    return {"ok": True}


@app.delete("/api/projects/{name}")
@_data_transaction
def delete_project(name: str):
    # 有機台的專案不可刪除（避免誤刪整批）；若一定要刪得先移走機台
    count = sum(1 for m in machines.values() if m.get("project") == name)
    if count:
        raise HTTPException(400, f"專案「{name}」下還有 {count} 台機台，請先移走/刪除機台才能刪除專案")
    if name in projects:
        del projects[name]
        _save_data()
    return {"ok": True}


@app.patch("/api/projects/{name}")
@_data_transaction
def edit_project(name: str, body: AddProject):
    if name not in projects:
        raise HTTPException(404, f"專案不存在: {name}")
    new_name = (body.name or "").strip() or name
    if new_name != name:
        # 改名：不可與現有專案重名
        if new_name in projects and new_name != name:
            raise HTTPException(400, f"專案已存在: {new_name}")
        # 同步更新所有掛在此專案下的機台
        for m in machines.values():
            if m.get("project") == name:
                m["project"] = new_name
        projects[new_name] = {
            **projects[name],
            "name": new_name,
            "desc": body.desc or projects[name].get("desc", ""),
            "order": projects[name].get("order", 0),
        }
        del projects[name]
    else:
        projects[name]["desc"] = body.desc or projects[name].get("desc", "")
    _save_data()
    return {"ok": True, "project": projects[new_name]}


# ---- 網頁終端機（xterm / SSH bridge）----
def _start_terminal(websocket: WebSocket, machine, kind: str, overrides: dict = None):
    """建立 paramiko 互動 shell，並在 SSH <-> WebSocket 之間橋接。
    kind: 'os' 連 OS；'bmc' 連 BMC。overrides 可覆寫 host/user/pass/port（例如 passive 元件點開時由前端動態填帳密）。"""
    overrides = overrides or {}
    if kind == "os":
        host = overrides.get("host") or machine.get("os_ip", "")
        user = overrides.get("user") or machine.get("os_user", "")
        pw   = overrides.get("pass") or machine.get("os_pass", "")
        port = overrides.get("port") or machine.get("os_port", 22)
    else:
        host = overrides.get("host") or machine.get("bmc_ip", "")
        user = overrides.get("user") or machine.get("bmc_user", "")
        pw   = overrides.get("pass") or machine.get("bmc_pass", "")
        port = overrides.get("port") or machine.get("bmc_port", 623)

    if not host or not user or not pw:
        asyncio.run_coroutine_threadsafe(
            websocket.send_json({"type": "error", "msg": f"{kind} 未設定連線資訊"}),
            asyncio.get_event_loop(),
        )
        return None, None

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, port=port, username=user, password=pw, timeout=8)
    except Exception as e:
        asyncio.run_coroutine_threadsafe(
            websocket.send_json({"type": "error", "msg": f"{kind} SSH 連線失敗: {e}"}),
            asyncio.get_event_loop(),
        )
        return None, None

    channel = client.invoke_shell(width=120, height=30)
    channel.settimeout(0.05)
    return client, channel


def _channel_pump(channel, websocket, loop, stop_flag):
    """把 SSH channel 的輸出不斷送到 WebSocket（背景執行緒）。"""
    while not stop_flag.is_set():
        try:
            if channel.recv_ready():
                data = channel.recv(4096)
                if data:
                    asyncio.run_coroutine_threadsafe(
                        websocket.send_bytes(data),
                        loop,
                    )
            elif channel.exit_status_ready() and not channel.recv_ready():
                # 對方 shell 已結束且沒有剩餘輸出
                break
            else:
                import time
                time.sleep(0.02)
        except Exception:
            break
    asyncio.run_coroutine_threadsafe(websocket.close(), loop)


TERM_BRIDGE_PORT = int(os.environ.get("TERM_BRIDGE_PORT", "7001"))
TERM_BRIDGE_URL = f"ws://127.0.0.1:{TERM_BRIDGE_PORT}"


async def _proxy_ws(websocket: WebSocket, target_path: str):
    """把前端 WebSocket 雙向代理到 node terminal bridge（port 6968）。
    target_path 為要連到 bridge 的路徑（例如 /ws/terminal/{name}/{kind} 或 /ws/broadcast）。"""
    await websocket.accept()
    url = TERM_BRIDGE_URL + target_path
    try:
        token_file = os.environ.get("CYCLE_BRIDGE_TOKEN_FILE")
        if not token_file:
            raise RuntimeError("Protected bridge token not configured")
        token = Path(token_file).read_text(encoding="utf-8").strip()
        if len(token) < 32: raise RuntimeError("Invalid bridge token")
        async with websockets.connect(url, max_size=1048576, additional_headers={"X-Cycle-Gateway":token}) as upstream:
            async def client_to_upstream():
                try:
                    while True:
                        message = await websocket.receive()
                        if message["type"] == "websocket.disconnect":
                            break
                        text = message.get("text")
                        if text is not None:
                            await upstream.send(text)
                        else:
                            await upstream.send(message.get("bytes"))
                except Exception:
                    pass
                finally:
                    try:
                        await upstream.close()
                    except Exception:
                        pass

            async def upstream_to_client():
                try:
                    async for data in upstream:
                        if isinstance(data, (bytes, bytearray)):
                            await websocket.send_bytes(bytes(data))
                        else:
                            await websocket.send_text(str(data))
                except Exception:
                    pass
                finally:
                    try:
                        await websocket.close()
                    except Exception:
                        pass

            await asyncio.gather(client_to_upstream(), upstream_to_client())
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "msg": f"無法連到 terminal bridge：{exc}"})
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass


@app.get("/api/kvm/basecode")
async def kvm_basecode(request: Request):
    """偵測指定專案（或全部）內各帶 BMC 機台的 basecode，回傳協定資訊。

    query: ?project=<專案名> 或省略 = 全部分組。
    前端點「📺 KVM 廣播」時先呼叫此 API，判斷大家是否同協議、能否同步。
    """
    proj = (request.query_params.get("project") or "").strip()
    _load_data()                      # 更新全域 machines
    ms = machines
    cands = []
    for name, m in ms.items():
        if isinstance(m, dict) and m.get("bmc_ip"):
            mname = m.get("name") or name
            if proj and (m.get("project") or "") != proj:
                continue
            cands.append(mname)
    det = await kvm_bridge.detect_basecode_async(cands)
    # 綜合判定是否可同步：所有線上機台必須同協議（全 RFB 或全 IVTP）
    kinds = {v["kind"] for v in det.values() if v["online"]}
    if not kinds:
        sync_ok, reason = False, "專案內沒有可連線（偵測得出 basecode）的 BMC"
    elif len(kinds) == 1:
        sync_ok, reason = True, ""
        only_kind = next(iter(kinds))
        if not kvm_bridge.basecode_label(only_kind)["rfb"]:
            sync_ok, reason = False, (f"全部都是 IVTP（{kvm_bridge.basecode_label(only_kind)['label']}），"
                                      "同協議但 SP-X 鍵鼠同步尚未實作")
    else:
        plist = "、".join(f"{v['label']}({v['proto']})" for v in det.values() if v["online"])
        sync_ok, reason = False, f"混合協議無法同步：{plist}"
    return {"project": proj, "machines": det, "sync_ok": sync_ok, "reason": reason,
            "detected_kinds": sorted(kinds or [])}


@app.websocket("/ws/kvm/{name}")
async def kvm_ws(websocket: WebSocket, name: str):
    """KVM 代理：把前端 /ws/kvm/{name} 雙向連到該 BMC 的 KVM (RFB over WSS)。
    瀏覽器只用 noVNC 連這個端點，BMC 帳密全部留在後端（kvm_bridge 處理）。"""
    await kvm_bridge.kvm_proxy(websocket, name)


@app.websocket("/ws/terminal/{name}/{kind}")
async def terminal(websocket: WebSocket, name: str, kind: str):
    # 終端已移轉至獨立的 node/ssh2 bridge（port 6968，事件驅動，避免 paramiko
    # 併發 SSH 造成 "Invalid packet blocking"）。此處雙向代理到 bridge 對應路徑。
    # 必須把瀏覽器帶來的 query（?host=..&user=..&pass=..&port=..）一併轉發，否則
    # bridge 收不到手動填寫的帳密 → 對沒有存帳密的機台會回「未設定連線資訊」。
    target_path = f"/ws/terminal/{name}/{kind}"
    qp = websocket.query_params
    if qp:
        from urllib.parse import urlencode
        q = urlencode([(k, v) for k, v in qp.items()])
        target_path += "?" + q
    await _proxy_ws(websocket, target_path)


# ---- 整櫃廣播終端（Broadcast Terminal）----
# 一台控制端同時把同個輸入送到多台被選取系統的 OS shell，
# 輸出依主機名稱個別標記送回前端（Clusterssh / screen fan-out 風格）。
def _open_broadcast_shell(machine):
    """建立單台機器的 OS SSH shell，回傳 (client, channel)；失敗回 (None, None)。"""
    host = machine.get("os_ip"); user = machine.get("os_user"); pw = machine.get("os_pass")
    port = machine.get("os_port") or 22
    if not host or not user or not pw:
        return None, None
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, port=port, username=user, password=pw, timeout=8)
        channel = client.invoke_shell(width=100, height=24)
        channel.settimeout(0.05)
        return client, channel
    except Exception:
        try:
            client.close()
        except Exception:
            pass
        return None, None


@app.websocket("/ws/rack-broadcast")
async def rack_broadcast(websocket: WebSocket):
    # 廣播終端已移轉至 node terminal bridge（/ws/broadcast，port 6968）。此處
    # 把 /ws/rack-broadcast 雙向代理到 bridge 的 /ws/broadcast，路徑不同需轉換。
    await _proxy_ws(websocket, "/ws/broadcast")


# ---- AI（串本機 vLLM / OpenAI-compatible）----
VLLM_URL = "http://127.0.0.1:18002"
VLLM_MODEL = "qwen3-coder"


def _llm_chat(system: str, user: str, temperature: float = 0.3,
              max_tokens: int = 320, timeout: int = 120) -> str:
    """呼叫本機 vLLM 的 OpenAI-compatible /v1/chat/completions，回傳 assistant 文字。失敗時拋例外。"""
    import requests
    payload = {
        "model": VLLM_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    r = requests.post(VLLM_URL + "/v1/chat/completions", json=payload, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    return (data["choices"][0]["message"]["content"] or "").strip()


# ---- 視覺 AI（B4）：本機 qwen3-vl-32b @18004 ----
VISION_URL = os.environ.get("VISION_URL", "http://127.0.0.1:18004")
VISION_MODEL = os.environ.get("VISION_MODEL", "qwen3-vl-32b")


def _vision_ask(question: str, image_b64: str, mime: str = "image/png",
                temperature: float = 0.2, max_tokens: int = 600) -> str:
    """把單張 base64 圖片送給本機視覺模型，回覆 assistant 文字。失敗拋例外。"""
    import requests
    payload = {
        "model": VISION_MODEL,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": question},
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
        ]}],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    r = requests.post(VISION_URL + "/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return (data["choices"][0]["message"]["content"] or "").strip()


class VisionReq(BaseModel):
    image_b64: str = Field(..., description="圖片 base64（不含 data: 前綴）")
    mime: str = Field("image/png", description="圖片 MIME，例如 image/png / image/jpeg")
    question: str = Field("", description="使用者對這張圖的疑問（可留空，AI 自動描述）")
    machine: str = Field("", description="機台名稱（可選，用於帶 context）")


@app.post("/api/ai/vision")
def ai_vision(req: VisionReq):
    """視覺 AI 會診：給一張 BMC KVM / noVNC 畫面截圖或機櫃照片，
    回『畫面描述 / 異常偵測 / 建議下一步』三區。"""
    img = (req.image_b64 or "").strip()
    if not img:
        return {"ok": False, "error": "缺少圖片（image_b64 為空）"}
    machine = req.machine.strip()
    ctx = ""
    if machine and machine in machines:
        m = machines[machine]
        h = _health_cache.get(machine, ("unknown", 0))[0]
        ctx = (f"（機台 {machine}：{m.get('level','system')}，health={h}，"
               f"OS={'正常' if _status_cache.get(('os',machine)) == 'ok' else '異常'}）")
    q = (req.question or "").strip()
    prompt = (
        "你是伺服器機房工程師。給你一張畫面截圖或照片，請用繁體中文回覆，格式：\n"
        "1) 畫面描述：簡短講出你看到的內容（開機畫面 / BIOS / OS 桌面 / 錯誤視窗 / 無畫面 / 照片場景）。\n"
        "2) 異常偵測：若看到 panic、錯誤訊息、警告、黑屏、卡住、硬體異常則點出；一切正常就寫『正常』。\n"
        "3) 建議下一步：1~2 句具體動作。\n"
        "不要臆測無法從畫面確認的硬體狀態。"
    )
    if q:
        prompt += f"\n使用者特別想問：{q}"
    if ctx:
        prompt += f"\n{ctx}"
    try:
        txt = _vision_ask(prompt, img, req.mime or "image/png")
    except Exception as e:
        return {"ok": False, "error": f"視覺 AI 分析失敗: {e}"}
    return {"ok": True, "analysis": txt, "machine": machine, "question": q}


class CopilotReq(BaseModel):
    message: str = Field(..., description="使用者輸入")
    project: str = Field("", description="限定回答某個專案（機櫃）的 context；留空表示整個機隊")


def _copilot_context(project: str = ""):
    """把目前機台/健康度整理成給 LLM 的文字 context。
    傳入 project（非空）時，只保留該專案（Rack）的機台，供 Rack Manager 的 Copilot 使用。"""
    lines = []
    names = [k for k in machines if machines[k].get("project") == project] if project else list(machines)
    for name in sorted(names, key=lambda k: machines[k].get("order", 0)):
        if not _machine_allowed(name): continue
        m = machines[name]
        h = _health_cache.get(name, ("unknown", 0))[0]
        lines.append(
            f"- {name} | level={m.get('level','system')} | project={m.get('project','-')} | "
            f"os_ip={m.get('os_ip')} | bmc_ip={m.get('bmc_ip') or '-'} | "
            f"os_alive={_status_cache.get(('os',name))} | health={h}"
        )
    return "\n".join(lines)


# ==================== B5 診斷會動手（唯讀 tool 迴圈） ====================
# 設計：LLM 只能呼叫唯讀工具（查 fleet / 查 telemetry / 跑白名單內的唯讀診斷指令）。
# 沒有任何會變更狀態的動作——狀態變更維持「前端人工確認」原則。

# 唯讀診斷指令白名單（用前綴比對，防止注入複雜 shell）
_DIAG_WHITELIST = (
    "nvidia-smi", "uptime", "free -h", "df -h", "dmesg -T | tail -", "dmesg | tail -",
    "ipmitool -I open sel list", "ipmitool -I open sensor",
    "ps aux --sort=-%cpu | head", "top -bn1 | head", "lscpu", "lsblk",
    "systemctl status --failed", "systemctl --failed --no-pager",
    "cat /sys/class/thermal/", "cat /proc/meminfo", "cat /proc/loadavg",
    "uname -a", "cat /etc/os-release", "lspci | grep -i nvidia",
)
_MAX_DIAG_STEPS = 4


def _diag_allowed(cmd: str) -> bool:
    """白名單嚴格比對：只允許『精確等於白名單項』或『白名單項 | tail -N』。
    避免 nvidia-smi; reboot 這類注入（前綴比對會被騙過去）。"""
    c = (cmd or "").strip()
    for p in _DIAG_WHITELIST:
        if c == p:
            return True
        base = p.split(" | tail -")[0]
        if c.startswith(base + " | tail -") and c[len(base) + len(" | tail -"):].isdigit():
            return True
    return False


def _run_diag_safe(machine: str, command: str) -> str:
    """在指定機台 OS 執行白名單內的唯讀指令，回文字結果（限制長度）。"""
    if not _machine_allowed(machine):
        return "Target unavailable or outside authorized scope"
    m = machines[machine]
    if not (m.get("os_ip") and m.get("os_user") and m.get("os_pass")):
        return f"{machine} 沒有可用的 OS SSH 連線資訊"
    if not _diag_allowed(command):
        return f"指令不在唯讀白名單中，已拒絕: {command}"
    out, rc, err = ssh_run(m["os_ip"], m.get("os_user", ""), m.get("os_pass", ""),
                           m.get("os_port") or 22, command, timeout=15)
    if out is None:
        return f"(執行逾時/失敗) {err[:200]}"
    return out[:2500] + (f"\n[rc={rc}]" if rc else "")


def _diag_summary(machine: str, minutes: int = 15) -> str:
    """輕量回傳單機最新 OS/GPU 摘要（給 tool 用），避免直接吃整段 analyse prompt。"""
    if not _machine_allowed(machine): return "Target unavailable or outside authorized scope"
    try:
        telemetry_core.init_db()
        observed = machine_telemetry(machine, minutes)
        osd, gpu = observed["os"], observed["gpu"]
        os_arr = (osd.get("os") or [])
        line = []
        if os_arr:
            last = os_arr[-1]
            line.append(f"cpu={last.get('cpu_used')}% load1={last.get('load1')} "
                        f"mem={last.get('mem_used_pct')}%")
        gser = gpu.get("series") or []
        if gser:
            u = [x for s in gser for x in s.get("util", []) if x is not None]
            t = [x for s in gser for x in s.get("temp", []) if x is not None]
            if u: line.append(f"gpu_util_peak={max(u)}%")
            if t: line.append(f"gpu_temp_peak={max(t)}C")
        return f"{machine}: " + ("；".join(line) if line else "無 telemetry 資料")
    except Exception as e:
        return f"{machine}: 讀取失敗 ({e})"


def _llm_chat_tools(system: str, user: str, max_steps: int = _MAX_DIAG_STEPS,
                    timeout: int = 240) -> str:
    """帶唯讀工具的多輪迴圈。LLM 要求 tool_call 就執行並回填，直到直接回覆或達上限。"""
    import requests
    tools = [
        {"type": "function", "function": {
            "name": "fleet_status",
            "description": "取得目前所有機台的狀態總覽（唯讀）。",
            "parameters": {"type": "object", "properties": {}, "required": []}}},
        {"type": "function", "function": {
            "name": "get_telemetry",
            "description": "取得單一機台最近 N 分鐘的 OS/GPU 指標摘要（唯讀）。",
            "parameters": {"type": "object", "properties": {
                "machine": {"type": "string", "description": "機台名稱"},
                "minutes": {"type": "integer", "description": "回看分鐘數，預設 15"}},
                "required": ["machine"]}}},
        {"type": "function", "function": {
            "name": "run_diag",
            "description": "在指定機台 OS 執行『白名單內』的唯讀診斷指令，例如 nvidia-smi、uptime、df -h、ipmitool -I open sel list、dmesg -T | tail -30。",
            "parameters": {"type": "object", "properties": {
                "machine": {"type": "string"},
                "command": {"type": "string", "description": "白名單可允許的唯讀指令"}},
                "required": ["machine", "command"]}}},
    ]
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    for _ in range(max_steps):
        r = requests.post(VLLM_URL + "/v1/chat/completions", json={
            "model": VLLM_MODEL, "messages": messages, "tools": tools,
            "temperature": 0.3, "max_tokens": 700}, timeout=timeout)
        r.raise_for_status()
        msg = r.json()["choices"][0]["message"]
        tcs = msg.get("tool_calls") or []
        if not tcs:
            return (msg.get("content") or "").strip()
        messages.append(msg)
        for tc in tcs:
            fn = tc["function"]
            name, args = fn["name"], {}
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except Exception:
                args = {}
            if name == "fleet_status":
                result = _copilot_context("")
            elif name == "get_telemetry":
                result = _diag_summary(str(args.get("machine", "")), int(args.get("minutes") or 15))
            elif name == "run_diag":
                result = _run_diag_safe(str(args.get("machine", "")), str(args.get("command", "")))
            else:
                result = f"未知工具: {name}"
            messages.append({"role": "tool", "tool_call_id": tc.get("id", ""), "content": result[:3000]})
    # 步數用盡：請 LLM 收尾
    messages.append({"role": "user", "content": "請根據以上工具結果，直接給最終簡短結論（繁體中文）。"})
    r = requests.post(VLLM_URL + "/v1/chat/completions", json={
        "model": VLLM_MODEL, "messages": messages, "temperature": 0.3, "max_tokens": 700}, timeout=timeout)
    r.raise_for_status()
    return (r.json()["choices"][0]["message"].get("content") or "").strip()


@app.post("/api/copilot")
def copilot_chat(body: CopilotReq):
    _refresh_status()   # 確保 context 用的是最新掃描/健康資料
    scope = body.project.strip()
    scope_note = (f"你正在回答「{scope}」這個機櫃專案的問題。"
                  if scope else "你正在回答整個機隊的問題。")
    sys = (
        "You are the AI assistant (Copilot) for a Wistron GPU server management system. "
        "Answer the user in Traditional Chinese (zh-TW), concise and practical. "
        "health values: green=OK, amber=warning, red=critical, unknown=offline/unreachable.\n"
        "CRITICAL RULE: you MUST answer ONLY from the CURRENT FLEET context. "
        "Never invent or assume machine names, projects, temperatures, or issues that are "
        "not listed. If a machine has health=unknown, say it is unreachable/offline.\n"
        f"{scope_note}\n"
        "工具規則：當使用者要『診斷 / 檢查某台機』時，可用唯讀工具 get_telemetry 與 run_diag "
        "實際取得資料再回答；不要憑空猜測。工具只能執行白名單內的唯讀指令，禁止任何會變更狀態的動作。\n\n"
        "CURRENT FLEET:\n" + _copilot_context(scope)
    )

    # 需要診斷工具的情形：使用者要深入檢查單機（診斷/檢查/為什麼/狀態/溫度/磁碟/log）。
    want_tools = bool(re.search(r"診斷|檢查|為什麼|狀態|溫度|磁碟|log|gpu|硬碟|健康|詳細看|跑一下|看看", body.message))
    try:
        if want_tools:
            text = _llm_chat_tools(sys, body.message)
        else:
            text = _llm_chat(sys, body.message, temperature=0.4, max_tokens=600)
        if not text:
            return {"ok": False, "error": "AI 回傳空白"}
        return {"ok": True, "reply": text}
    except Exception as e:
        return {"ok": False, "error": f"AI 呼叫失敗: {e}"}


# ==================== B6 跨機器日誌搜尋（deepseek 262k） ====================
DEEPSEEK_URL = os.environ.get("DEEPSEEK_URL", "http://127.0.0.1:18011")
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-flash")


class LogSearchReq(BaseModel):
    query: str = Field(..., description="想找的異常/關鍵字，例如 Xid 13、OOM、SEL、temperature、PCIe error")
    machines: list = Field([], description="指定機台（空 list = 所有有 OS 的機台）")
    tail: int = Field(300, description="每台 dmesg 抓幾行（上限 800）")


def _gather_machine_logs(name: str, keywords, tail: int) -> str:
    """對一台機台抓 dmesg tail + SEL，只留含關鍵字的行。回『機台名 + 命中的行』。"""
    m = machines.get(name)
    if not m:
        return f"[{name}] 不存在\n"
    if not (m.get("os_ip") and m.get("os_user") and m.get("os_pass")):
        return f"[{name}] 無 OS SSH，跳過\n"
    kw = "|".join(re.escape(k) for k in (keywords or ["error", "fail"]) if k)
    pat = re.compile(kw, re.I)
    keep = []
    # dmesg
    out, rc, err = ssh_run(m["os_ip"], m.get("os_user", ""), m.get("os_pass", ""),
                           m.get("os_port") or 22, f"dmesg -T | tail -{min(tail,800)}", timeout=20)
    if out:
        for ln in out.splitlines():
            if not ln.strip():
                continue
            keep.append(ln) if (not pat or pat.search(ln)) else None
    # SEL（本機 ipmitool，OS 內）
    sel = _ipmi_local(m, ["sel", "list", "last", "40"], timeout=20)
    if sel:
        for ln in sel.splitlines():
            if not ln.strip():
                continue
            keep.append(f"[SEL] {ln}") if (not pat or pat.search(ln)) else None
    head = f"===== {name} ====="
    if not keep:
        return head + "\n(無符合的行)\n"
    # 去重並限長
    seen, outl = set(), []
    for ln in keep:
        if ln in seen:
            continue
        seen.add(ln)
        outl.append(ln)
        if len(outl) >= 200:
            outl.append("...(超過 200 行已截斷)")
            break
    return head + "\n" + "\n".join(outl) + "\n"


@app.post("/api/ai/logsearch")
def ai_logsearch(req: LogSearchReq):
    """跨機器日誌搜尋：先用關鍵字在各機台 dmesg/SEL 撈相關行，再交給
    deepseek（262k 長上下文）壓成『哪些機台異常 → 常見模式 → 建議』。"""
    q = (req.query or "").strip()
    if not q:
        return {"ok": False, "error": "請輸入要找的關鍵字/異常"}
    kw = [w for w in re.split(r"[\s,，、/;；]+", q) if len(w) >= 2]
    if not kw:
        kw = [q]
    names = [str(x) for x in (req.machines or [])] or \
            [k for k in machines if _machine_allowed(k) and machines[k].get("os_ip")]
    if not names:
        return {"ok": False, "error": "沒有可查詢的機台"}

    # 1) 收集（每台併發 8 秒內；串行即可，機台少）
    blocks = []
    for n in sorted(names):
        blocks.append(_gather_machine_logs(n, kw, max(50, min(int(req.tail or 300), 800))))
    blob = "\n".join(blocks)
    if len(blob) > 220000:
        blob = blob[:220000] + "\n...(擷取上限)"

    # 2) deepseek 長上下文分析
    sysp = ("你是伺服器機房維運分析師。給你跨機台的 dmesg/SEL 日誌（已按關鍵字過濾）。\n"
            "請用繁體中文簡潔回覆：\n"
            "1) 結論：整體是否有持續異常（先回答）\n"
            "2) 各機台重點：只列真正命中異常的機台與模式\n"
            "3) 最可能的根因與下一步（1~2 行）\n"
            "沒有證據的不要臆測。")
    usr = f"關鍵字：{q}\n\n{blob}\n請分析："
    try:
        import requests as _req
        r = _req.post(DEEPSEEK_URL + "/v1/chat/completions", json={
            "model": DEEPSEEK_MODEL, "messages": [
                {"role": "system", "content": sysp},
                {"role": "user", "content": usr}],
            "temperature": 0.2, "max_tokens": 900}, timeout=180)
        r.raise_for_status()
        txt = (r.json()["choices"][0]["message"].get("content") or "").strip()
    except Exception as e:
        return {"ok": False, "error": f"分析失敗: {e}"}
    return {"ok": True, "query": q, "machines": sorted(names),
            "matched_lines": sum(b.count("\n") for b in blocks),
            "analysis": txt, "sample": blob[:1500]}


# # ---- 機器 Agent（單機）：LLM 只做「提案」，控制動作一律由前端人工確認後才執行 ----
# # 關鍵設計：LLM 的 tool 白名單內「會變更狀態的動作」只有 propose_action，
# # 它不會真的執行，只會回傳一份提案物件；前端顯示確認 UI，使用者按下執行才呼叫
# # /api/machine/{name}/agent-execute 去跑真正的 reboot / power / aux。
# # 唯二的唯讀工具 get_status / diagnose 才能由 agent 自行呼叫。
#
# _AGENT_MAX_STEPS = 6
# _AGENT_ACTIONS = ("reboot", "poweron", "poweroff", "aux")
# _AGENT_ACTION_LABEL = {
#     "reboot": "Reboot（OS 重新開機）",
#     "poweron": "開機（電源開啟）",
#     "poweroff": "關機（電源關閉）",
#     "aux": "AC cycle（完整斷電重上電）",
# }
#
#
# def _agent_tools(name: str) -> list:
#     """本機可用的 tool 清單（白名單）。只有唯讀工具可被 agent 直接呼叫。"""
#     return [
#         {
#             "type": "function",
#             "function": {
#                 "name": "get_status",
#                 "description": "取得此機台目前的線上狀態與健康度（唯讀）。",
#                 "parameters": {"type": "object", "properties": {}, "required": []},
#             },
#         },
#         {
#             "type": "function",
#             "function": {
#                 "name": "diagnose",
#                 "description": "收集此機台的診斷資訊（OS 日誌 / GPU / BMC SEL）並回傳摘要（唯讀，較慢，約 10-30 秒）。",
#                 "parameters": {"type": "object", "properties": {}, "required": []},
#             },
#         },
#         {
#             "type": "function",
#             "function": {
#                 "name": "propose_action",
#                 "description": (
#                     "當使用者要求對這台機器做會改變狀態的操作（重開機 / 開關機 / AC cycle）時，"
#                     "呼叫這個 tool 提出『提案』。此 tool 不會真的執行，只會回傳提案。"
#                     "可選的 action：" + ", ".join(f"{k}={v}" for k, v in _AGENT_ACTION_LABEL.items())
#                 ),
#                 "parameters": {
#                     "type": "object",
#                     "properties": {
#                         "action": {"type": "string", "enum": list(_AGENT_ACTIONS)},
#                         "reason": {"type": "string", "description": "以繁中簡短說明為何要執行此操作"},
#                     },
#                     "required": ["action", "reason"],
#                 },
#             },
#         },
#     ]
#
#
# def _agent_system(name: str) -> str:
#     m = machines.get(name, {})
#     h = _health_cache.get(name, ("unknown", 0))[0]
#     alive = _status_cache.get(("os", name))
#     fleet = "\n".join(
#         f"- {k} | level={machines[k].get('level')} | project={machines[k].get('project')} | "
#         f"os_ip={machines[k].get('os_ip')} | bmc_ip={machines[k].get('bmc_ip') or '-'} "
#         f"| os_alive={_status_cache.get(('os', k))} | health={_health_cache.get(k, ('unknown', 0))[0]}"
#         for k in sorted(machines, key=lambda x: machines[x].get("order", 0))
#     )
#     return (
#         "You are the AI Agent for a single machine in a Wistron GPU server management system. "
#         "Answer in Traditional Chinese (zh-TW), concise and practical.\n"
#         f"You are now focused on machine: \nname={name}\n"
#         f"os_ip={m.get('os_ip')}\nbmc_ip={m.get('bmc_ip') or '-'}\n"
#         f"os_alive={alive}\nhealth={h}\n\n"
#         "CURRENT FLEET (context, do not act on others):\n" + fleet + "\n\n"
#         "RULES:\n"
#         "- You can only affect THIS machine (" + name + "). Never propose actions on other machines.\n"
#         "- Use get_status / diagnose to gather info. Never invent data.\n"
#         "- When the user asks to reboot / power on / power off / AC-cycle this machine, call "
#         "propose_action with the matching action and a brief Traditional Chinese reason. "
#         "propose_action does NOT execute anything; it just proposes. Stop after proposing.\n"
#         "- Be explicit: after proposing, tell the user it needs their confirmation before execution.\n"
#         "- If the request is ambiguous (machine names, action), ask for clarification rather than guessing.\n"
#     )
#
#
# def _agent_get_status(name: str) -> str:
#     h = _health_cache.get(name, ("unknown", 0))[0]
#     alive = _status_cache.get(("os", name))
#     return (f"machine={name} os_alive={alive} health={h}\n"
#             f"os_ip={machines.get(name, {}).get('os_ip')} "
#             f"bmc_ip={machines.get(name, {}).get('bmc_ip') or '-'}")
#
#
# def _agent_diagnose(name: str) -> str:
#     m = machines.get(name)
#     if not m:
#         return "機台不存在"
#     rec = _collect_diag(m)
#     if rec.get("note"):
#         return rec["note"]
#     out = rec.get("collect", {})
#     return "OS:\n" + (out.get("os") or "(無)") + "\n\nBMC SEL:\n" + (out.get("bmc") or "(無)")
#
#
# def _agent_parse_tool_call(tc: dict):
#     """把 LLM tool_call 轉成 (name, args)。回傳 None 表示格式無法解析。"""
#     fn = tc.get("function") or {}
#     name = fn.get("name")
#     if not name:
#         return None
#     args = fn.get("arguments")
#     if isinstance(args, str):
#         import json as _json
#         try:
#             args = _json.loads(args)
#         except Exception:
#             args = {}
#     if not isinstance(args, dict):
#         args = {}
#     return name, args
#
#
# class AgentReq(BaseModel):
#     messages: list          # [{role, content}...]，前端維護的整段對話
#
#
# class AgentExecuteReq(BaseModel):
#     action: str
#
#
# @app.post("/api/machine/{name}/agent")
# def machine_agent_chat(name: str, body: AgentReq):
#     """單機 Agent 對話。LLM 只能做提案與唯讀查詢；控制動作用 propose_action 提出，
#     由前端確認後呼叫 /agent-execute 執行。"""
#     _refresh_status()
#     if name not in machines:
#         raise HTTPException(404, f"機台不存在: {name}")
#     msgs = list(body.messages or [])
#     # 去掉可能傳進來的 system，改用我們自己的
#     msgs = [m for m in msgs if m.get("role") != "system"]
#     ollama_msgs = [{"role": "system", "content": _agent_system(name)}] + msgs
#     payload = {
#         "model": OLLAMA_MODEL,
#         "messages": ollama_msgs,
#         "tools": _agent_tools(name),
#         "stream": False,
#         "options": {"temperature": 0.3, "num_predict": 800},
#     }
#     import requests
#     try:
#         for _ in range(_AGENT_MAX_STEPS):
#             r = requests.post(OLLAMA_URL + "/api/chat", json=payload, timeout=180)
#             r.raise_for_status()
#             msg = r.json().get("message") or {}
#             content = (msg.get("content") or "").strip()
#             tool_calls = msg.get("tool_calls") or []
#
#             # 沒有 tool call → 這是最終回答
#             if not tool_calls:
#                 if content:
#                     return {"ok": True, "reply": content}
#                 return {"ok": False, "error": "ollama 回傳空白"}
#
#             # 逐個處理 tool calls（只允許白名單）
#             tool_results = []
#             proposal = None
#             for tc in tool_calls:
#                 parsed = _agent_parse_tool_call(tc)
#                 if not parsed:
#                     tool_results.append({
#                         "role": "tool", "content": "工具呼叫格式無法解析，請改用純文字回答。"
#                     })
#                     continue
#                 tname, targs = parsed
#                 if tname == "propose_action":
#                     action = (targs.get("action") or "").strip()
#                     reason = (targs.get("reason") or "").strip()
#                     if action not in _AGENT_ACTIONS:
#                         tool_results.append({
#                             "role": "tool",
#                             "content": f"不支援的 action「{action}」。可用的只有：{', '.join(_AGENT_ACTIONS)}",
#                         })
#                         continue
#                     # 只允許對「目前這台」提案：action 白名單 + 由前端做最終確認
#                     proposal = {"action": action, "reason": reason, "machine": name}
#                     break   # 提出提案就停止，不繼續跑
#                 elif tname == "get_status":
#                     tool_results.append({"role": "tool", "content": _agent_get_status(name)})
#                 elif tname == "diagnose":
#                     tool_results.append({"role": "tool", "content": _agent_diagnose(name)})
#                 else:
#                     tool_results.append({
#                         "role": "tool", "content": f"未知工具「{tname}」，被拒絕。"
#                     })
#
#             if proposal is not None:
#                 return {"ok": True, "proposal": proposal}
#
#             # 把 tool 結果接回對話，繼續下一輪
#             payload = {
#                 "model": OLLAMA_MODEL,
#                 "messages": ollama_msgs + [{"role": "assistant", "content": content,
#                                             "tool_calls": [tc for tc in tool_calls]}]
#                                 + tool_results,
#                 "tools": _agent_tools(name),
#                 "stream": False,
#                 "options": {"temperature": 0.3, "num_predict": 800},
#             }
#         return {"ok": False, "error": "agent 步驟過多，已停止"}
#     except Exception as e:
#         return {"ok": False, "error": f"ollama 呼叫失敗: {e}"}
#
#
# @app.post("/api/machine/{name}/agent-execute")
# def machine_agent_execute(name: str, body: AgentExecuteReq):
#     """前端確認提案後，執行真正的控制動作（與既有按鈕同權限）。"""
#     if name not in machines:
#         raise HTTPException(404, f"機台不存在: {name}")
#     m = machines[name]
#     action = (body.action or "").strip()
#     if action == "reboot":
#         ok, info = _reboot_machine(m)
#         return {"ok": ok, "action": "reboot", "info": info}
#     if action == "aux":
#         ok, info = run_control_cmd(m, "aux")
#         return {"ok": ok, "action": "aux", "info": info}
#     if action in ("poweron", "poweroff"):
#         ok, info = run_control_cmd(m, action)
#         _, status = ipmi_power(m, "status")
#         return {"ok": ok, "action": ("on" if action == "poweron" else "off"),
#                 "info": info, "power_status": (status or "").strip()}
#     raise HTTPException(400, f"不支援的動作: {action}")
#
#
# ---- 系統診斷（收集 OS/BMC 問題 → 串本機 AI 自動分析）----
class DiagReq(BaseModel):
    include_bmc: bool = True


def _collect_diag(m):
    """收集診斷輸入：OS 側（dmesg/journalctl/nvidia-smi/df/free/uptime）+ 本機 ipmitool（SEL/sensor）。
    一律優先透過 SSH 進 OS 執行（可正確處理 -C 17 這類 OOB cipher），OS 不可連才用 OOB。"""
    if m.get("passive"):
        return {"collect": {}, "note": "此為無 OS/BMC 的純機櫃元件，無法收集診斷資料。"}
    out = {}
    # OS 側：用 SSH 一次收集 + 順帶在 OS 內跑本機 ipmitool（SEL）
    os_cmd = (
        "echo '======= UPTIME ======='; uptime; "
        "echo '======= OS ======='; cat /etc/os-release 2>/dev/null | head -2; "
        "echo '======= MEM ======='; free -h; "
        "echo '======= DISK ======='; df -h | grep -Ev '^tmpfs|^udev|loop'; "
        "echo '======= LOAD/TOP ======='; ps -eo pcpu,pmem,comm --sort=-pcpu | head -12; "
        "echo '======= DMESG-ERR ======='; dmesg -T 2>/dev/null | grep -iE 'error|fail|warn|panic|oops|mce|nvme|pcie|temperature|thermal' | tail -30; "
        "echo '======= JOURNAL-ERR ======='; journalctl -p err -n 30 --no-pager 2>/dev/null | tail -30; "
        "echo '======= GPU ======='; (nvidia-smi --query-gpu=index,name,utilization.gpu,temperature.gpu,memory.used,memory.total,power.draw --format=csv,noheader 2>/dev/null || (command -v rocm-smi >/dev/null 2>&1 && { rocm-smi --showuse 2>/dev/null; rocm-smi --showtemp 2>/dev/null; rocm-smi --showmemuse vram 2>/dev/null; rocm-smi --showpower 2>/dev/null; })) | head -20"
    )
    osout, rc, err = ssh_run(m.get("os_ip"), m.get("os_user",""), m.get("os_pass",""),
                             m.get("os_port",22), os_cmd, timeout=30)
    out["os"] = osout or (err or ("OS 連線失敗或收集失敗"))
    # IPMI SEL（event log）：優先 OS 內 -I open，其次 OOB。回傳收集方式供前端顯示。
    sel_out, sel_rc, sel_err = ssh_ipmi(m, ["sel", "elist"], timeout=25)
    bmc_mode = "os_local" if (sel_rc == 0 and sel_out) else "oob"
    out["bmc"] = sel_out or (sel_err or "IPMI SEL 讀取失敗")
    out["bmc_mode"] = bmc_mode
    return {"collect": out}


@app.post("/api/machine/{name}/diagnose")
def machine_diagnose(name: str, body: DiagReq = None):
    """收集單機診斷資料並串本機 AI 分析，回傳問題摘要與處理建議。
    流程：收集 dmesg/journalctl/GPU/BMC event log → 呼叫本機 AI 分析。"""
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    m = machines[name]
    body = body or DiagReq()
    diag = _collect_diag(m)
    collect = diag.get("collect", {})
    if diag.get("note"):
        return {"ok": True, "note": diag["note"], "report": None}
    os_snip = (collect.get("os") or "")[:4000]
    bmc_snip = (collect.get("bmc") or "")[:2000] if body.include_bmc else ""
    sys_prompt = (
        "你是伺服器軟體/硬體工程師的 AI 診斷助手。使用者會提供一台伺服器的系統診斷原始輸出"
        "（OS 的 dmesg/journalctl/CPU/記憶體/磁碟/GPU，以及 BMC 的 IPMI SEL event log）。\n"
        "請用繁體中文，條列式輸出：\n"
        "1) **健康摘要**：簡短說明目前看起來正常/異常。\n"
        "2) **發現的問題**：依嚴重度列出（Critical/Hight/Medium/Low），每條給『證據（從輸出引述）』與『可能成因』。\n"
        "3) **建議處理**：給可執行的檢查與處理步驟（指令/順序/注意事項），務必務實、精確。\n"
        "4) **是否需要立即處理**：Yes/No + 一句話。\n"
        "限制：只根據提供的輸出分析，不要編造不存在的數據；若資料不足請明確說無法判斷。"
    )
    user_prompt = "OS/BMC 診斷輸出如下：\n===== OS =====\n" + os_snip + \
                  ("\n===== BMC SEL =====\n" + bmc_snip if bmc_snip else "")
    report = None
    try:
        for attempt in range(2):
            try:
                report = _llm_chat(sys_prompt, user_prompt, temperature=0.3,
                                   max_tokens=4096, timeout=300)
            except Exception:
                report = None
            if report:
                break
            time.sleep(2)
        if not report:
            return {"ok": False,
                    "error": "AI 未產生分析結果。請確認本機 vLLM（qwen3-coder）可用。",
                    "collect": collect}
    except Exception as e:
        return {"ok": False, "error": f"AI 分析失敗: {e}", "collect": collect}
    return {"ok": True, "report": report,
            "collected_at": datetime.datetime.now().isoformat(timespec="seconds"),
            "collect": collect}


# ---- System Telemetry（CPU/DIMM/SSD/NIC/GPU）----
_telemetry_thread = None


@app.on_event("startup")
def _start_telemetry():
    return  # Independent authorized service: python run.py observe; never per Web worker.


@app.get("/api/machine/{name}/telemetry")
def machine_telemetry(name: str, minutes: int = 60, kind: str = "all", node_id: str = ""):
    """回傳某台機台的 System Telemetry 歷史（時間範圍由 minutes 控制）。
    kind: all=OS+GPU, os=僅 OS, gpu=僅 GPU。
    """
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    telemetry_core.init_db()
    target=machines[name]
    key=name
    if target.get('os') is not None:
        entries=[e for e in target['os'] if (e.get('node_id')==node_id if node_id else e.get('slot')==target.get('active_os'))]
        if len(entries)!=1 or not entries[0].get('node_id'):
            raise HTTPException(409,'Select an existing canonical node for telemetry')
        key=entries[0]['node_id']
    elif node_id:
        raise HTTPException(404,'Node does not belong to this chassis')
    result = {"machine": name, "window_min": int(minutes), "node_id":key if key!=name else None,
              "history_source":"canonical-node" if key!=name else "legacy-machine-unattributed"}
    result['observation']=globals().get('_observation_status',lambda key:{'state':'NOT_CONFIGURED'})(key)
    if kind in ("all", "os"):
        result["os"] = telemetry_core.get_os_series(key, int(minutes))
    if kind in ("all", "gpu"):
        result["gpu"] = telemetry_core.get_gpu_series(key, int(minutes))
    return result

@app.get("/api/ai/gpu-alerts")
def ai_gpu_alerts():
    """GPU 熱度快訊：回傳目前 active 的 GPU 高載／高溫 AI 造句告警。"""
    return {"alerts": [a for a in telemetry_core.get_active_gpu_alerts() if _machine_allowed(a.get("machine"))]}


@app.get("/api/rack/{project}/telemetry")
def rack_telemetry(project: str, minutes: int = 60):
    """整櫃（Rack Level）Telemetry：依「元件類型」彙總指定專案的機台。
    回傳各類型（server/switch/powershelf/pdu/cdu/…）各自的指標定義、
    每台最新值與歷史聚合，供前端依類型區塊呈現。
    """
    telemetry_core.init_db()
    proj = project
    # 只撈「在此專案 Rack（L11 機櫃）平面圖上」的元件（level=="rack"）：排除 L10 單機（level=="system"）如 proj_k-app-1
    # 專案名大小寫不敏感（proj_k/proj_k 視為同一專案）
    want_proj = (proj or "").casefold()
    members = [m for m in machines.values() if telemetry_core.is_rack_member(m, proj)]
    # 排除 blanking 擋板（passive 且無監控指標），不列入監控類型
    components = sorted([
        {"name": m.get("name", ""), "kind": telemetry_core.kind_of(m)}
        for m in members if telemetry_core.kind_of(m) != "blanking"
    ], key=lambda x: x["name"])
    # 每種類型的台數（供佔位提示）
    from collections import Counter
    kinds_count = dict(Counter(c["kind"] for c in components))
    # 指定呈現順序：server 一定最上面靠左、switch 靠右，其後 powershelf/pdu/cdu/storage/network 依序往下。
    _RACK_KIND_ORDER = ["server", "switch", "nvlink", "powershelf", "pdu", "cdu", "storage", "network"]
    ordered_kinds = sorted(kinds_count.keys(), key=lambda k: _RACK_KIND_ORDER.index(k) if k in _RACK_KIND_ORDER else len(_RACK_KIND_ORDER))
    kinds_count = {k: kinds_count[k] for k in ordered_kinds}
    data = telemetry_core.get_rack_series(proj, int(minutes))
    # 即使目前無採樣資料，也回傳「該專案擁有的類型+指標定義」讓前端畫出對應區塊
    for kind in kinds_count:
        if kind not in data:
            data[kind] = {
                "defs": {k: {"label": v.get("label", k), "unit": v.get("unit", ""), "color": v.get("color", "#2563eb")}
                         for k, v in telemetry_core.RACK_METRIC_DEF.get(kind, {}).items()},
                "machines": [], "history": {},
            }
    return {
        "project": proj,
        "window_min": int(minutes),
        "kinds": list(kinds_count),
        "kinds_count": kinds_count,
        "components": components,
        "data": data,
    }


@app.get("/api/rack/{project}/telemetry/analyze")
def rack_telemetry_analyze(project: str, minutes: int = 60):
    """整櫃（Rack Level）Telemetry AI：依各類型的最新指標摘要叫本機 AI 做簡短分析，
    回傳一段繁體中文說明（2~3 句），供 front-end 頂部的 🤖 Telemetry AI 列顯示。
    """
    telemetry_core.init_db()
    proj = project
    data = telemetry_core.get_rack_series(proj, int(minutes))
    if not data:
        return {"ok": False, "error": "此專案尚無 telemetry 資料，無法分析"}

    # 依各類型最新值組成精簡摘要
    summaries = []
    order = ["server", "switch", "nvlink", "powershelf", "pdu", "cdu", "storage", "network"]
    has_any = False
    for kind in sorted(data.keys(), key=lambda k: order.index(k) if k in order else len(order)):
        m = data[kind]
        machines = m.get("machines") or []
        hist = m.get("history") or {}
        if not machines:
            continue
        # 每一台的各指標最新值
        mach_lines = []
        for mm in machines:
            cells = []
            for metric, hm in hist.items():
                v = mm.get(metric)
                if v is not None:
                    cells.append(f"{hm.get('label', metric)} {v:g}{hm.get('unit','')}")
            if cells:
                mach_lines.append(f"{mm.get('name')}({'; '.join(cells)})")
        # 每一指標的整櫃聚合最新值
        agg_lines = []
        for metric, hm in hist.items():
            vals = [x for x in (hm.get("values") or []) if x is not None]
            if not vals:
                continue
            agg_lines.append(f"{hm.get('label', metric)} {vals[-1]:g}{hm.get('unit','')}")
        summaries.append(f"【{kind}】共{len(machines)}台：{('；'.join(mach_lines)) or ('—')}；整櫃{('; '.join(agg_lines)) or ('—')}")
        has_any = True
    if not has_any:
        return {"ok": False, "error": "此專案尚無 telemetry 資料，無法分析"}
    summary = "\n".join(summaries)

    sys_prompt = (
        "你是 AI/GPU 機房的資深工程師，專責管理整櫃（Rack）的伺服器與週邊（switch/power shelf/PDU/CDU）。\n"
        "使用者會給你『整櫃各類型元件的監控指標摘要』（每台最新值與整櫃聚合值）。\n"
        "請用繁體中文，回覆**非常簡短**的一段話（2~3 句內，勿超過 3 句），語氣平實：\n"
        "1) 先一句：整體『正常』還是『有異常警訊』。\n"
        "2) 若有異常（過熱 / 高功耗 / 高負載 / 水壓異常等），簡短點出最需注意的 1~2 個元件與方向；若皆正常則不需列。\n"
        "3) 不要列點、不要給指令、不要重複列出所有數值。"
    )
    user_prompt = "以下為整櫃各類型元件的監控摘要：\n" + summary + "\n請給簡短分析："
    try:
        txt = _llm_chat(sys_prompt, user_prompt, temperature=0.3, max_tokens=300)
        if not txt:
            return {"ok": False, "error": "AI 未產生內容"}
    except Exception as e:
        return {"ok": False, "error": f"AI 分析失敗: {e}"}
    return {"ok": True, "summary": summary, "analysis": txt, "minutes": int(minutes), "project": proj}



def _tel_latest(r):
    """取 series 最後幾筆，回傳趨勢文字（最新值 + 方向）。"""
    if not r:
        return None
    vals = [x for x in r if x is not None]
    if not vals:
        return None
    last = vals[-1]
    if len(vals) >= 2:
        prev = vals[-2]
        try:
            delta = last - prev
            if delta > 0.0001: return f"{last:.1f} (升)" if isinstance(last,(int,float)) else str(last)
            if delta < -0.0001: return f"{last:.1f} (降)" if isinstance(last,(int,float)) else str(last)
        except Exception:
            pass
    return f"{last:.1f}" if isinstance(last,(int,float)) else str(last)


@app.get("/api/machine/{name}/telemetry/analyze")
def machine_telemetry_analyze(name: str, minutes: int = 60, node_id: str = ""):
    """針對單機 Telemetry 數據，叫本機 AI 做『簡短』分析（幾句話說明是否正常）。
    避免大量文字：指令要求精簡，適合放在 telemetry 頁頂部的提示列。"""
    if name not in machines:
        raise HTTPException(404, f"機台不存在: {name}")
    telemetry_core.init_db()
    observed = machine_telemetry(name, int(minutes), node_id=node_id)
    osd, gpu = observed["os"], observed["gpu"]
    os_arr = osd.get("os") or []
    if not os_arr:
        return {"ok": False, "error": "此範圍尚無 telemetry 資料，無法分析"}

    # ---- 組成簡短指標摘要（含趨勢會診） ----
    def last_key(k):
        vals = [r[k] for r in os_arr if r.get(k) is not None]
        return vals[-1] if vals else None
    def trend_key(k):
        vals = [r[k] for r in os_arr if r.get(k) is not None]
        return _tel_latest(vals)
    def trend_desc(vals):
        """把時間序列壓成趨勢描述：第一半平均 vs 後半平均 → 上升/持平/下降。"""
        if not vals:
            return ""
        half = max(1, len(vals) // 2)
        a = sum(vals[:half]) / half
        b = sum(vals[half:]) / (len(vals) - half)
        d = b - a
        if d > max(5, abs(a) * 0.3):
            return "上升"
        if d < -max(5, abs(a) * 0.3):
            return "下降"
        return "持平"

    cpu_vals = [r.get("cpu_used") for r in os_arr if r.get("cpu_used") is not None]
    load1_vals = [r.get("load1") for r in os_arr if r.get("load1") is not None]
    memp_vals = [r.get("mem_used_pct") for r in os_arr if r.get("mem_used_pct") is not None]
    cpu = _tel_latest(cpu_vals); load1 = _tel_latest(load1_vals)
    load5 = _tel_latest([r.get("load5") for r in os_arr if r.get("load5") is not None])
    memp = last_key("mem_used_pct"); memu = last_key("mem_used_gb"); memt = last_key("mem_total_gb")

    trend_parts = [
        f"CPU使用率{trend_desc(cpu_vals)}",
        f"Load{trend_desc(load1_vals)}",
    ]
    if memp_vals:
        trend_parts.append(f"記憶體{trend_desc(memp_vals)}")

    disk = ""
    disks = osd.get("disk") or []
    if disks:
        dm = disks[0]
        pcts = [p for p in dm.get("pct", []) if p is not None]
        if pcts:
            mnt = (dm.get("mount") or "").strip() or "儲存空間"
            disk = f"磁碟 {mnt} {pcts[-1]:.0f}%"

    # GPU：取所有牌卡的最高 util/溫度與尖峰次數（不只 GPU0）
    gser = gpu.get("series") or []
    gpu_line = ""
    gpu_trend_note = ""
    if gser:
        all_util = [u for s in gser for u in s.get("util", []) if u is not None]
        all_temp = [t for s in gser for t in s.get("temp", []) if t is not None]
        all_pow = [p for s in gser for p in s.get("power", []) if p is not None]
        if all_util:
            peak = max(all_util)
            spikes = sum(1 for u in all_util if u >= 80)
            gpu_line = f"GPU 峰值util {peak:.0f}%（≥80% 出現 {spikes} 次）"
        if all_temp:
            gpu_line += (f"，峰值temp {max(all_temp):.0f}°C" if gpu_line else f"GPU 峰值temp {max(all_temp):.0f}°C")
        if all_pow:
            gpu_line += (f"，峰值power {max(all_pow):.0f}W" if gpu_line else f"GPU 峰值power {max(all_pow):.0f}W")
        # GPU 使用率趨勢：每張取半窗比較，多數上升才標
        up = 0; tot = 0
        for s in gser:
            u = [x for x in s.get("util", []) if x is not None]
            if len(u) >= 4:
                tot += 1
                if trend_desc(u) == "上升":
                    up += 1
        if tot and up / tot >= 0.6:
            gpu_trend_note = "，GPU 多數正在上升"

    mem_txt = f"{memp:.1f}%" if isinstance(memp, (int, float)) else "未知"
    memu_txt = f"{memu:.1f}" if isinstance(memu, (int, float)) else "未知"
    memt_txt = f"{memt:.1f}" if isinstance(memt, (int, float)) else "?"
    summary = (f"CPU使用率最新 {cpu}%，Load 1m={load1} / 5m={load5}；"
               f"記憶體使用率 {mem_txt}（已用 {memu_txt}/{memt_txt}GB）；{disk or '無磁碟資料'}；{gpu_line or '無GPU資料'}。"
               f"趨勢：{'、'.join(trend_parts)}{gpu_trend_note}。")

    sys_prompt = (
        "你是伺服器 AI/GPU 機房的資深工程師。使用者會給你一台伺服器『監控指標摘要』。\n"
        "請用繁體中文，回覆**非常簡短**的一段話（2~3 句內，勿超過 3 句），語氣平實：\n"
        "1) 先一句：整體『正常』還是『有異常警訊』。\n"
        "2) 若有異常或趨勢在上升，簡短點出最需『會診』的 1 個指標、之後 30~60 分鐘該留意什麼；若一切持平正常則不需列。\n"
        "3) 不要列點、不要給指令、不要重複列出所有數值。"
    )
    user_prompt = "以下為該機台最近數分鐘的監控摘要（含趨勢）：\n" + summary + "\n請給簡短分析："
    try:
        txt = _llm_chat(sys_prompt, user_prompt, temperature=0.3, max_tokens=320)
        if not txt:
            return {"ok": False, "error": "AI 未產生內容"}
    except Exception as e:
        return {"ok": False, "error": f"AI 分析失敗: {e}"}
    return {"ok": True, "summary": summary, "analysis": txt, "minutes": int(minutes)}


# ---- 靜態前端 ----
# no-cache：確保瀏覽器永遠拿到最新 JS/CSS，避免舊版卡住（改版後不用手動清快取）
class _NoCacheStaticFiles(StaticFiles):
    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)

    def file_response(self, *a, **kw):
        resp = super().file_response(*a, **kw)
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return resp


app.mount("/static", _NoCacheStaticFiles(directory=os.path.join(os.path.dirname(__file__),"static")), name="static")


@app.get("/")
def index():
    resp = FileResponse(os.path.join(os.path.dirname(__file__),"static/index.html"))
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return resp
