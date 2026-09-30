"""
KVM Bridge — 後端把每台 BMC 的 KVM (RFB over WebSocket) 雙向代理給前端。

支援 AMI OneTree 與標準 OpenBMC bmcweb：
  * AMI OneTree   : POST /login  -> XSRF-TOKEN cookie 當 WS subprotocol
  * 標準 OpenBMC  : Redfish Session -> X-Auth-Token 當 WS subprotocol
RFB 解碼/渲染由前端 noVNC 負責；本模組只做「登入 + 雙向轉發」，
讓 BMC 帳密不落入瀏覽器。
"""
import asyncio
import json
import os
import ssl
import time

import websockets


def _data_dir():
    d = os.environ.get("PA_DATA_DIR")
    if d:
        os.makedirs(d, exist_ok=True)
        return d
    return os.path.dirname(os.path.abspath(__file__))


DATA_FILE = os.path.join(_data_dir(), "data.json")


def _load_machine(name):
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            d = json.load(f)
    except Exception:
        return None
    ms = d.get("machines", d)
    if isinstance(ms, dict):
        return ms.get(name)
    m = next((x for x in ms if isinstance(x, dict) and x.get("name") == name), None)
    return m


def _ssl_ctx():
    c = ssl.create_default_context()
    c.check_hostname = False
    c.verify_mode = ssl.CERT_NONE
    return c


SPX_API_SESSION = "/api/session"
SPX_KVM_PATH = "/kvm"
SPX_WS_SUBPROTOCOLS = ["binary", "base64"]
ONETREE_KVM_PATH = "/kvm/0"


def _spx_login(bmc, user, pw):
    """AMI MegaRAC SP-X 登入：回 ("spx", csrf, cookie_dict)。

    ⚠️ 關鍵：/api/session 只吃 **application/x-www-form-urlencoded**（jQuery 表單格式）。
       用 JSON body 會直接被 lighttpd 回 403（已實測驗證）。
    Web 登入 = POST /api/session data={username,password} → JSON 回 {CSRFToken,user_id,privilege,...}
    前端把 CSRFToken 存成 cookie `garc`（實際是 `__Host-garc`），
    KVM WS(/kvm) 與 SOL(/sol) 靠同源 cookie + Origin 認證 → 後端要保留同一批 cookie。
    """
    import requests
    import urllib3
    urllib3.disable_warnings()
    s = requests.Session()
    try:
        # 先 GET / 建立基礎 session cookie（QSESSIONID 等）
        s.get(f"https://{bmc}/", verify=False, timeout=10)
        r = s.post(f"https://{bmc}{SPX_API_SESSION}",
                   data={"username": user, "password": pw},   # form-urlencoded，勿用 json=
                   headers={
                       "Accept": "application/json, text/javascript, */*; q=0.01",
                       "X-Requested-With": "XMLHttpRequest",
                       "Origin": f"https://{bmc}",
                       "Referer": f"https://{bmc}/",
                       "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
                   },
                   verify=False, timeout=12)
        if r.status_code != 200:
            return None, None, None
        js = r.json()
        if not isinstance(js, dict):
            return None, None, None
        csrf = (js.get("CSRFToken") or "").strip()
        if not csrf:
            return None, None, None

        ck = s.cookies.get_dict()
        # 組出瀏覽器會攜帶的 cookie 集合（/kvm 認證靠這些名字；garc 值 = CSRFToken）
        cookies = {
            "__Host-garc": csrf,
            "garc": csrf,
            "__Host-user_id": str(js.get("user_id", "")),
            "user_id": str(js.get("user_id", "")),
            "__Host-privilege": str(js.get("privilege", "7")),
            "privilege": str(js.get("privilege", "7")),
        }
        # 保留 server 設的 session cookie（QSESSIONID 等）
        for k, v in ck.items():
            cookies.setdefault(k, v)
        return "spx", csrf, cookies
    except Exception:
        pass
    return None, None, None


def _detect_bmc(bmc, user, pw):
    """依序嘗試 SP-X / OneTree / OpenBMC 登入，回 (kind, tok, cookies)；全敗回 (None,None,None)。

    SP-X 最優先：其 /api/session 只要回應 200 + CSRFToken 即為 SP-X。
    """
    for fn in (_spx_login, _ami_login, _openbmc_login):
        try:
            kind, tok, cookies = fn(bmc, user, pw)
            if tok:
                return kind, tok, cookies
        except Exception:
            continue
    return None, None, None


def _ami_login(bmc, user, pw):
    """AMI OneTree 登入：回 (XSRF_TOKEN, cookie_dict)。"""
    import requests
    import urllib3
    urllib3.disable_warnings()
    s = requests.Session()
    try:
        s.get(f"https://{bmc}/", verify=False, timeout=10)
        r = s.post(f"https://{bmc}/login", json={"data": [user, pw]},
                   verify=False, timeout=12)
        ck = s.cookies.get_dict()
        xsrf = ck.get("XSRF-TOKEN")
        if r.status_code == 200 and xsrf:
            return "ami", xsrf, ck
    except Exception:
        pass
    return None, None, None


def _openbmc_login(bmc, user, pw):
    """標準 OpenBMC bmcweb：回 (token, cookie)。"""
    import requests
    import urllib3
    urllib3.disable_warnings()
    try:
        r = requests.post(
            f"https://{bmc}/redfish/v1/SessionService/Sessions",
            json={"UserName": user, "Password": pw},
            headers={"Content-Type": "application/json"},
            verify=False, timeout=12)
        tok = r.headers.get("X-Auth-Token")
        if r.status_code in (200, 201) and tok:
            return "openbmc", tok, {}
    except Exception:
        pass
    return None, None, None


async def _connect_kvm(bmc, user, pw):
    """對 BMC 建立 KVM WebSocket 連線，回 (ws, note)；失敗回 (None, err)。

    依 BMC 型別分 adapter：
      * SP-X    : form 登入 /api/session -> CSRFToken -> cookie(__Host-garc 等)
                  連 wss://{bmc}/kvm，subprotocol ["binary","base64"]，需帶 Origin。
      * OneTree : POST /login -> XSRF-TOKEN cookie 當 subprotocol，wss://{bmc}/kvm/0。
      * OpenBMC : Redfish Session -> X-Auth-Token 當 subprotocol。
    """
    kind, tok, cookies = await asyncio.to_thread(_detect_bmc, bmc, user, pw)
    if not tok:
        return None, "BMC 登入失敗（SP-X / OneTree / OpenBMC 認證都試過）"

    if kind == "spx":
        # SP-X：form 登入拿 CSRFToken；KVM WS 靠 cookie + Origin 認證，subprotocol binary/base64。
        cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items() if v)
        try:
            ws = await websockets.connect(
                f"wss://{bmc}/kvm",
                ssl=_ssl_ctx(),
                subprotocols=["binary", "base64"],
                additional_headers={"Cookie": cookie_str, "Origin": f"https://{bmc}"},
                ping_interval=None,
                open_timeout=20,
                max_size=None,
            )
        except Exception as e:
            return None, f"SP-X KVM 連線失敗：{e}"
        return ws, "spx OK"

    # OneTree / OpenBMC：token 當 subprotocol，/kvm/0
    url = f"wss://{bmc}/kvm/0"
    extra = {}
    if cookies:
        extra["Cookie"] = "; ".join(f"{k}={v}" for k, v in cookies.items())
    try:
        ws = await websockets.connect(
            url,
            ssl=_ssl_ctx(),
            subprotocols=[tok],
            additional_headers=extra,
            ping_interval=None,
            open_timeout=20,
            max_size=None,
        )
    except Exception as e:
        return None, str(e)
    return ws, f"{kind} OK"


async def kvm_proxy(websocket, name):
    """把前端 /ws/kvm/{name} 雙向代理到該 BMC 的 /kvm/0 RFB stream。"""
    print(f"[KVM] proxy enter name={name}", flush=True)
    await websocket.accept()
    m = _load_machine(name)
    if not m or not m.get("bmc_ip"):
        await websocket.send_json({"type": "error", "msg": "找不到機台或無 BMC IP"})
        await websocket.close()
        return
    u, p = _bmc_kvm_creds(m)
    ws, note = await _connect_kvm(m["bmc_ip"], u, p)
    if ws is None:
        await websocket.send_json({"type": "error", "msg": f"KVM 連線失敗：{note}"})
        await websocket.close()
        return
    try:
        # 注意：成功時不回 JSON status——noVNC 的 RFB 需要第一個 bytes 就是 RFB 握手，
        # 任何前置訊息（JSON/text）都會破壞握手。直接開始轉發 BMC 的原始 RFB 資料流。
        async def c2u():
            try:
                while True:
                    msg = await websocket.receive()
                    if msg["type"] == "websocket.disconnect":
                        break
                    t = msg.get("text")
                    if t is not None:
                        await ws.send(t)
                    elif msg.get("bytes"):
                        await ws.send(msg.get("bytes"))
            except Exception:
                pass
            finally:
                try:
                    await ws.close()
                except Exception:
                    pass

        async def u2c():
            try:
                async for data in ws:
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

        await asyncio.gather(c2u(), u2c())
    except Exception:
        try:
            await websocket.close()
        except Exception:
            pass


# ================= basecode 自動偵測（供 /api/kvm/basecode 用） =================
# basecode 名稱 → 人類可讀協定標籤；kind 為 None 表示連不上/登入失敗。
_BASE_LABEL = {
    "spx":     {"label": "MegaRAC SP-X", "proto": "IVTP",   "rfb": False},
    "ami":     {"label": "AMI OneTree",  "proto": "RFB",    "rfb": True},
    "openbmc": {"label": "OpenBMC",      "proto": "RFB",    "rfb": True},
}
# TTL 快取：{name: (ts, kind)}，避免每次點 KVM 廣播都重打各 BMC
_BASE_CACHE = {}
_BASE_TTL = 180  # 秒


def _bmc_kvm_creds(m):
    """SP-X 的 KVM Web 用 bmc_kvm_user/bmc_kvm_pass；未設則退回 bmc_user/bmc_pass。"""
    m = m or {}
    u = m.get("bmc_kvm_user") or m.get("bmc_user") or "admin"
    p = m.get("bmc_kvm_pass") or m.get("bmc_pass") or ""
    return u, p


def basecode_label(kind):
    """kind → (label, proto, is_rfb)；未知 kind 給預設值。"""
    return _BASE_LABEL.get(kind) or {"label": kind or "未知", "proto": "?", "rfb": False}


def _detect_basecode_one(name):
    """同步偵測單台 BMC 的 basecode；回 kind ('spx'/'ami'/'openbmc') 或 None。"""
    try:
        now = time.time()
        ent = _BASE_CACHE.get(name)
        if ent and (now - ent[0]) < _BASE_TTL:
            return ent[1]
    except Exception:
        pass
    m = _load_machine(name)
    if not m or not m.get("bmc_ip"):
        return None
    try:
        u, p = _bmc_kvm_creds(m)
        kind, tok, _cookies = _detect_bmc(m["bmc_ip"], u, p)
    except Exception:
        kind, tok = None, None
    result = kind if tok else None
    try:
        _BASE_CACHE[name] = (time.time(), result)
    except Exception:
        pass
    return result


def detect_basecode_sync(names):
    """同步偵測一批機台 basecode（供 API 呼叫）。names: list[str]
    回 {name: {kind, label, proto, rfb, bmc_ip, online}}。"""
    if isinstance(names, str):
        names = [names]
    out = {}
    for n in names:
        try:
            kind = _detect_basecode_one(n)
            m = _load_machine(n) or {}
            info = basecode_label(kind)
            out[n] = {
                "kind": kind,
                "label": info["label"],
                "proto": info["proto"],
                "rfb": info["rfb"],
                "bmc_ip": m.get("bmc_ip"),
                "online": bool(kind),   # 能偵測出 basecode = BMC 可達且登入成功
            }
        except Exception as e:
            out[n] = {"kind": None, "label": "錯誤", "proto": "?", "rfb": False,
                      "bmc_ip": None, "online": False, "error": str(e)}
    return out


async def detect_basecode_async(names):
    """非同步並行偵測一批機台 basecode。回傳同 detect_basecode_sync 結構。"""
    if isinstance(names, str):
        names = [names]
    results = await asyncio.gather(*[asyncio.to_thread(_detect_basecode_one, n)
                                     for n in names])
    out = {}
    for n, kind in zip(names, results):
        m = _load_machine(n) or {}
        info = basecode_label(kind)
        out[n] = {
            "kind": kind,
            "label": info["label"],
            "proto": info["proto"],
            "rfb": info["rfb"],
            "bmc_ip": m.get("bmc_ip"),
            "online": bool(kind),
        }
    return out
