"""PA Manager 6969 — Vera Cycle validation specification generator (self-contained).

This module renders the bilingual (zh-TW / en) validation specification for the
6969 engine. It intentionally imports NOTHING from the engine: it is a pure
document generator so it can never perturb the live cycle engine. Every item and
issue code below is traced to the 6969 engine sources:

  * engine/vera_cycle/validation_collectors.py   (OPERATIONS — the command set)
  * engine/vera_cycle/validation_rules.py        (sensor/pci/nic/usb/net/sel/redfish rules)
  * engine/vera_cycle/validation_identity.py     (OS/BMC identity)
  * engine/vera_cycle/validation_events.py       (dmesg / log event normalisation)
  * engine/vera_cycle/cycle_dmesg.py             (DMESG_* families)
  * engine/vera_cycle/cycle_engine.py            (PRE/capture/loop/redfish/clean-start)
  * engine/vera_cycle/{eq3300,naboo,neutrino}_config.sh (project hardware interface)

Run:  python -m cycle_specification_6969 --out ../../CYCLE_VALIDATION_SPECIFICATION.html
"""
from __future__ import annotations

import argparse
import html
from datetime import datetime, timezone
from pathlib import Path

LANGS = ("zh-TW", "en")
BASE = Path(__file__).resolve().parent


# --------------------------------------------------------------------------- #
# i18n helpers
# --------------------------------------------------------------------------- #
def t(zh: str, en: str) -> dict[str, str]:
    return {"zh-TW": zh, "en": en}


PRE = t("前置驗證", "PRE-CHECK")
PRE_POST = t("前置驗證與後置驗證", "PRE-CHECK / POST-CHECK")
POST = t("後置驗證", "POST-CHECK")
CYCLE = t("Cycle 執行", "CYCLE EXECUTION")
ALL_PHASES = t("前置、Cycle 與後置驗證", "PRE-CHECK, CYCLE EXECUTION and POST-CHECK")


def item(number, key, name, phase, source, purpose, collection, logic,
         passed, warned, failed, retry, comparison, evidence, issue_code,
         notes=None, *, kind="validation") -> dict:
    if notes == "collection":
        kind, notes = notes, None
    notes = notes or t("N/A", "N/A")
    return dict(number=number, key=key, name=name, phase=phase, source=source,
                purpose=purpose, collection=collection, logic=logic, passed=passed,
                warned=warned, failed=failed, retry=retry, comparison=comparison,
                evidence=evidence, issue_code=issue_code, notes=notes, kind=kind)


# --------------------------------------------------------------------------- #
# VALIDATION ITEMS — grounded in the 6969 engine's actual behaviour
# --------------------------------------------------------------------------- #
ITEMS = [
    item(
        "01", "endpoint-identity", t("Endpoint Identity Verification", "Endpoint Identity Verification"), PRE_POST,
        t("OPERATIONS['identity']：SSH 執行 `printf 'HOSTNAME='; hostname; printf 'BOOT_ID='; cat /proc/sys/kernel/random/boot_id`。", "OPERATIONS['identity']: SSH `printf 'HOSTNAME='; hostname; printf 'BOOT_ID='; cat /proc/sys/kernel/random/boot_id`."),
        t("確認每個選定 endpoint 就是 inventory 指定的目標，並用 OS boot ID 保護不可誤操作的主機。", "Confirm every selected endpoint is the inventory target and use the OS boot ID to guard against acting on the wrong host."),
        t("以 Paramiko SSH 對 selected roles 執行指令；PRE 保存 identity evidence，loop 的 transient poll 僅進入 record metadata，不逐次落檔。", "Run the command through Paramiko SSH for each selected role; PRE retains identity evidence while loop polls stay in record metadata."),
        t("hostname 去除尾端句點後不分大小寫比對 expected hostname；OS boot ID 必須符合 UUID 形狀。", "The hostname matches the expected hostname case-insensitively after trimming a trailing dot; the OS boot ID must match the UUID shape."),
        t("所有 checked endpoint 的 identity 通過且 boot ID 有效。", "All checked endpoint identities pass and the boot ID is valid."),
        t("N/A。", "N/A."),
        t("SSH/identity 不可用、hostname 不符、boot ID 無效，或在已核准 scope 中發生非預期 boot 轉換；目標會被 block 或停止。", "SSH/identity unavailable, hostname mismatch, invalid boot ID, or an unexpected boot transition inside the approved scope; the target is blocked or stopped."),
        t("Recovery 期間僅對 transient connection failure 重試至 boot deadline；identity mismatch 不以重試掩蓋。", "During recovery only transient connection failures retry until the boot deadline; an identity mismatch is never masked by retries."),
        t("PRE identity 建立 immutable reference；每次 action 前後與 POST 後重新驗證。", "PRE identity establishes the immutable reference; identity is rechecked before and after actions and after POST."),
        t("record 的 `identities`（hostname、boot_id）與 PRE identity evidence。", "`identities` (hostname, boot_id) in the record plus PRE identity evidence."),
        t("PRE_BLOCKED; IDENTITY_UNSAFE; NODE_UNAVAILABLE", "PRE_BLOCKED; IDENTITY_UNSAFE; NODE_UNAVAILABLE"),
        t("inventory 缺少 IP、缺少 expected hostname、或 endpoint 重複，會在送出任何遠端指令前 block target。", "Missing inventory IPs, missing expected hostnames, or duplicate endpoints block a target before any remote command is sent."),
    ),
    item(
        "02", "asset-identity", t("Asset Identity (UUID / Serial)", "Asset Identity (UUID / Serial)"), PRE_POST,
        t("OPERATIONS['asset_identity']：`cat /sys/class/dmi/id/product_uuid` 與 `product_serial`（sudo）。", "OPERATIONS['asset_identity']: `cat /sys/class/dmi/id/product_uuid` and `product_serial` (sudo)."),
        t("把實體資產（系統 UUID、機台序號）綁進 record，讓報表可回溯到實機。", "Bind the physical asset (system UUID, node serial) into the record so a report traces back to a real machine."),
        t("以 sudo 讀取 DMI product_uuid / product_serial；作為固定資產指紋保存。", "Read DMI product_uuid / product_serial with sudo; stored as the fixed asset fingerprint."),
        t("兩個值都成功讀取即視為有效資產識別。", "Both values read successfully constitute a valid asset identity."),
        t("N/A。", "N/A."),
        t("無法讀取 DMI 欄位時依 engine 的收集失敗路徑回報。", "When DMI fields cannot be read, the engine reports through its collection-failure path."),
        t("N/A；asset identity 不會被重試掩蓋。", "N/A; asset identity is not hidden by retries."),
        t("資產識別不參與 PRE↔POST 差異比較，只作為固定指紋。", "Asset identity does not participate in PRE↔POST diffing; it is a fixed fingerprint."),
        t("record 中的資產指紋欄位。", "Asset fingerprint fields in the record."),
        t("COLLECTION_FAILED", "COLLECTION_FAILED"),
        t("這是 6969 engine 具備、且已納入硬體輸入的資產層驗證。", "An asset-level check present in the 6969 engine and included in hardware inputs."),
    ),
    item(
        "03", "connectivity-auth", t("OS / BMC / Redfish Connectivity and Authentication", "OS / BMC / Redfish Connectivity and Authentication"), PRE_POST,
        t("OS/BMC 的 SSH identity 指令、`ipmitool -I lanplus`（OOB）、以及 authenticated Redfish session。", "SSH identity commands for OS/BMC, `ipmitool -I lanplus` (OOB), and an authenticated Redfish session."),
        t("確認驗證所需的 OS、BMC 與 Redfish endpoint 可達且 authentication context 正確。", "Confirm the OS, BMC, and Redfish endpoints required by validation are reachable with the correct authentication context."),
        t("確認驗證所需的 OS、BMC 與 Redfish endpoint 可達且 authentication context 正確。", "Confirm the OS, BMC, and Redfish endpoints required by validation are reachable with the correct authentication context."),
        t("每個 transport 保留 exit code、state、duration 與必要 output excerpt；credential 不進 argv、不寫入 evidence。", "Each transport retains exit code, state, duration, and the necessary output excerpt; credentials never enter argv or evidence."),
        t("identity 指令、IPMI 操作或 Redfish collection 在實作路徑上成功返回且資料可解析。", "The identity command, IPMI operation, or Redfish collection returns successfully on its implemented path and the result is parseable."),
        t("N/A。", "N/A."),
        t("transport 指令失敗、註冊 gate 未通過、或 session/authentication 失敗時，對應 check 標記 FAIL 或 UNAVAILABLE。", "When a transport command fails, a registration gate is not met, or the session/authentication fails, the corresponding check is FAIL or UNAVAILABLE."),
        t("僅對實作提供的 recovery polling 重試 transient connection；Redfish login 每次 capture 重建 session。", "Only the implemented recovery polling retries transient connections; Redfish login rebuilds the session on every capture."),
        t("PRE connectivity 建立執行基礎；POST 重新確認 endpoint 可達性，不以單次成功推論整個 campaign。", "PRE connectivity establishes the execution basis; POST rechecks reachability and does not infer permanent reachability from one success."),
        t("command records、transport evidence、Redfish evidence。", "Command records, transport evidence, Redfish evidence."),
        t("COLLECTION_FAILED; BMC_UNAVAILABLE; REDFISH_UNAVAILABLE; IPMI_REPORTED_ERROR", "COLLECTION_FAILED; BMC_UNAVAILABLE; REDFISH_UNAVAILABLE; IPMI_REPORTED_ERROR"),
    ),
    item(
        "04", "root-dependencies", t("Root / Dependency Readiness", "Root / Dependency Readiness"), PRE,
        t("`id -u`（sudo）與 `dependencies()` 的 OS 相依檢查。", "`id -u` (sudo) and the OS dependency probe in `dependencies()`."),
        t("確認具備 root 權限與後續驗證所需的相依工具，缺一即可能阻止受控檢查。", "Confirm root privileges and the dependencies later checks need; a missing one may block controlled checks."),
        t("確認具備 root 權限與後續驗證所需的相依工具，缺一即無法完成受控檢查。", "Confirm root privileges and the dependencies needed by later checks; a missing one blocks controlled checks."),
        t("先檢查 `id -u` 是否為 0，再逐項檢查相依項目。", "Check whether `id -u` is 0, then probe each dependency."),
        t("uid 為 0 且所有必要相依存在。", "uid is 0 and all required dependencies are present."),
        t("相依項目部分可用時依 engine 判定回報。", "Partially available dependencies are reported as the engine decides."),
        t("root 不可用或必要相依缺失即為 FAIL，可能阻止後續受控檢查。", "Unavailable root or a missing required dependency is FAIL and can block later controlled checks."),
        t("N/A；此為 PRE 階段的一次性判定。", "N/A; a one-shot PRE judgement."),
        t("root/相依狀態在 PRE 建立，作為後續可否執行受控指令的前提。", "Root/dependency state is established at PRE as the precondition for controlled commands."),
        t("`root_uid` command record 與相依檢查結果。", "The `root_uid` command record and dependency probe results."),
        t("ROOT_UNAVAILABLE; DEPENDENCY_MISSING; DEPENDENCY_CHECK", "ROOT_UNAVAILABLE; DEPENDENCY_MISSING; DEPENDENCY_CHECK"),
    ),
    item(
        "05", "clean-start", t("Clean-start Preparation", "Clean-start Preparation"), PRE,
        t("在 PRE baseline 之前清空 dmesg、IPMI SEL 與 BMC Redfish logs（`_prepare_clean_state`）。", "Clear dmesg, IPMI SEL, and BMC Redfish logs before the PRE baseline (`_prepare_clean_state`)."),
        t("讓 baseline（以及之後每個 loop delta）只反映本次 campaign。", "Make the baseline — and every later loop delta — reflect only this campaign."),
        t("每個 log 先探測再清；讀不到的 log 絕不盲目清除。", "Each log is probed before clearing; a log that cannot be read is never wiped blind."),
        t("可讀的 log 成功清除，baseline 乾淨。", "Readable logs clear successfully and the baseline is clean."),
        t("探測失敗時跳過清理並標記，而非清空。", "On a probe failure the wipe is skipped and flagged rather than performed."),
        t("清理動作失敗時回報對應清除失敗碼。", "A failed clear reports the corresponding clear-failure code."),
        t("N/A；clean-start 是 campaign 準備，不列入顯示時長。", "N/A; clean-start is campaign preparation and is not counted in displayed duration."),
        t("clear 動作發生在 baseline 之前，之後的 loop delta 只反映本次 campaign。", "The clear happens before the baseline so later loop deltas reflect only this campaign."),
        t("clear 動作的 command record 與 evidence。", "Command records and evidence for the clear actions."),
        t("CLEAR_SKIPPED; REDFISH_CLEAR_FAILED; SEL_FORMAT_ERROR", "CLEAR_SKIPPED; REDFISH_CLEAR_FAILED; SEL_FORMAT_ERROR"),
        t("依 operator 決定，不保留清除前的 backlog。", "By operator decision the pre-clear backlog is not retained."),
    ),
    item(
        "06", "pci-inventory", t("PCIe Inventory", "PCIe Inventory"), PRE_POST,
        t("OPERATIONS['pci']：`lspci -Dvv -nn`（sudo）。解析為 full-BDF inventory。", "OPERATIONS['pci']: `lspci -Dvv -nn` (sudo), parsed into a full-BDF inventory."),
        t("建立 PCI 裝置清單作為 drift 比較基準，並偵測裝置增減或識別碼變動。", "Build the PCI device list as the drift baseline and detect added/removed devices or changed identifiers."),
        t("parse_pci 解析全 BDF 清單；parse_pci_verbose 取得詳細；merge_pci_devices 合併；pci_issues 與 baseline 比對。", "parse_pci parses the full BDF list; parse_pci_verbose gets detail; merge_pci_devices merges; pci_issues diffs against baseline."),
        t("可解析出有效的全 BDF 清單，且與 baseline 無 drift。", "A valid full-BDF list parses and there is no drift against baseline."),
        t("裝置識別碼在同 BDF 上變動時標記。", "A changed device identifier on the same BDF is flagged."),
        t("無法解析任何全 BDF 裝置即 PCI_EMPTY；BDF 上識別碼變動即 PCI_DRIFT。", "No parseable full-BDF device is PCI_EMPTY; a changed identifier on a BDF is PCI_DRIFT."),
        t("N/A。", "N/A."),
        t("PRE 建 pci baseline；POST 與 baseline 比對產生 drift findings。", "PRE builds the PCI baseline; POST diffs against it to produce drift findings."),
        t("`lspci` command record、pci inventory JSON、PRE↔POST drift findings。", "`lspci` command record, PCI inventory JSON, PRE↔POST drift findings."),
        t("PCI_EMPTY; PCI_DRIFT", "PCI_EMPTY; PCI_DRIFT"),
        t("PCI baseline 不可用時會阻止該 target 進入受控比較。", "When the PCI baseline is unavailable the target is blocked from controlled comparison."),
    ),
    item(
        "07", "pci-link", t("PCIe Verbose / Link Validation", "PCIe Verbose / Link Validation"), PRE_POST,
        t("`lspci -Dvv -nn` 的 LnkSta 區塊，以及 config 腳本回報的 `CHECK|PCIE_LINK` / `ISSUE|PCIE_*`。", "The LnkSta blocks in `lspci -Dvv -nn`, plus `CHECK|PCIE_LINK` / `ISSUE|PCIE_*` from config scripts."),
        t("偵測 PCIe 連結降速/降寬或連結不可用。", "Detect PCIe link downgrade / width reduction or an unavailable link."),
        t("config_issues 優先採用結構化訊號（ISSUE|PCIE_* 或 CHECK|PCIE_LINK）；無結構化訊號時才逐 device block 解析 verbose dump。", "config_issues prefers structured signals (ISSUE|PCIE_* or CHECK|PCIE_LINK); only without them does it parse the verbose dump block by block."),
        t("所有 Express Endpoint 的 LnkSta 正常。", "All Express Endpoint LnkSta are healthy."),
        t("LnkSta 出現 Downgraded 時標記降級。", "A Downgraded LnkSta is flagged as a downgrade."),
        t("Speed unknown 或 Width x0 即 PCIE_LINK_UNAVAILABLE；降級即 PCIE_DOWNGRADE。", "Speed unknown or Width x0 is PCIE_LINK_UNAVAILABLE; a downgrade is PCIE_DOWNGRADE."),
        t("N/A；此為 PRE↔POST 狀態比較，不重送 cycle action。", "N/A; a PRE↔POST state comparison that does not resend the cycle action."),
        t("PRE 與 POST 各擷取一次並比較連結狀態。", "Link state is captured at PRE and POST and compared."),
        t("verbose lspci evidence 與結構化 ISSUE/CHECK findings。", "Verbose lspci evidence and structured ISSUE/CHECK findings."),
        t("PCIE_DOWNGRADE; PCIE_LINK_UNAVAILABLE; PCIE_INVENTORY_UNSTABLE", "PCIE_DOWNGRADE; PCIE_LINK_UNAVAILABLE; PCIE_INVENTORY_UNSTABLE"),
        t("在 BDF 層級 keyed，故報表能指名到具體裝置。", "Keyed at BDF level so a report can name the exact device."),
    ),
    item(
        "08", "nic-slot", t("NIC Slot State Comparison", "NIC Slot State Comparison"), PRE_POST,
        t("config 腳本的 `CHECK|NIC_SLOT|slot=<bdf>|state=<PRESENT|DEGRADED|MISSING>` 行，以及 `mst status -v`。", "The `CHECK|NIC_SLOT|slot=<bdf>|state=<PRESENT|DEGRADED|MISSING>` lines from config scripts, plus `mst status -v`."),
        t("比較 PRE↔POST 的 NIC slot 狀態，偵測消失、降級或非 Vera 卡。", "Compare PRE↔POST NIC slot state to detect disappearance, degradation, or a non-Vera card."),
        t("nic_slot_issues 解析 slot 狀態並與 baseline 比對；MST 相關列一併檢查。", "nic_slot_issues parses slot state and diffs against baseline; MST rows are checked too."),
        t("slot 狀態與 PRE 相同，或由 degraded/missing 回復為 PRESENT。", "Slot state matches PRE, or recovers from degraded/missing to PRESENT."),
        t("POST 變為 DEGRADED 或非 Vera 卡時標記。", "A POST transition to DEGRADED or a non-Vera card is flagged."),
        t("POST 由 PRESENT/DEGRADED 變為 MISSING 即 NIC_MISSING；變為 DEGRADED 即 NIC_DEGRADED；非卡即 NIC_NON_CARD；MST 列異常即 NIC_MST_ROW。", "POST to MISSING is NIC_MISSING; to DEGRADED is NIC_DEGRADED; a non-card is NIC_NON_CARD; a bad MST row is NIC_MST_ROW."),
        t("N/A；PRE↔POST 狀態比較，不重送 cycle action。", "N/A; PRE↔POST comparison that does not resend the cycle action."),
        t("PRE↔POST 逐 slot 比較。", "Slot-by-slot PRE↔POST comparison."),
        t("NIC slot 狀態、MST status evidence。", "NIC slot state and MST status evidence."),
        t("NIC_MISSING; NIC_DEGRADED; NIC_NON_CARD; NIC_MST_ROW; MST_MISSING", "NIC_MISSING; NIC_DEGRADED; NIC_NON_CARD; NIC_MST_ROW; MST_MISSING"),
        t("同時涵蓋 script 自報的 `ISSUE|...`，會進入同一 record health。", "Also covers a script-reported `ISSUE|...`, which enters the same record health."),
    ),
    item(
        "09", "usb", t("USB Collection", "USB Collection"), PRE_POST,
        t("USB 裝置收集並與 baseline 比對（usb_issues）。", "USB device collection compared against baseline (usb_issues)."),
        t("偵測 PRE↔POST 之間 USB 裝置的出現、消失或拓撲變動。", "Detect USB devices appearing, disappearing, or changing topology between PRE and POST."),
        t("偵測 PRE↔POST 之間 USB 裝置的出現、消失或拓撲變動。", "Detect USB devices appearing, disappearing, or changing topology between PRE and POST."),
        t("擷取 USB 清單，與 PRE baseline 逐項比對。", "Capture the USB list and diff item-by-item against the PRE baseline."),
        t("USB 集合與 PRE 相同。", "The USB set matches PRE."),
        t("N/A。", "N/A."),
        t("USB 集合出現差異即 USB_DRIFT。", "A difference in the USB set is USB_DRIFT."),
        t("N/A；狀態比較，不重送。", "N/A; a state comparison that does not resend."),
        t("PRE 建 baseline，POST 比對。", "PRE builds the baseline, POST diffs."),
        t("USB 清單與 drift findings。", "USB list and drift findings."),
        t("USB_DRIFT", "USB_DRIFT"),
    ),
    item(
        "10", "network", t("Network Collection", "Network Collection"), PRE_POST,
        t("OPERATIONS['network']：`ip address show`，輔以 link state 解析。", "OPERATIONS['network']: `ip address show`, with link-state parsing."),
        t("偵測網路介面的位址或連線狀態在 PRE↔POST 之間的變動。", "Detect address or link-state changes on network interfaces between PRE and POST."),
        t("parse_network / parse_network_state 解析；network_issues 比對 baseline；network_link_issues 檢查連線狀態。", "parse_network / parse_network_state parse; network_issues diffs baseline; network_link_issues inspects link state."),
        t("介面位址集合與連線狀態皆與 PRE 一致。", "Interface address sets and link state match PRE."),
        t("連結狀態異常時標記。", "An abnormal link state is flagged."),
        t("位址集合變動即 NET_DRIFT；連線關閉即 NET_LINK_DOWN；缺位址即 NET_NO_ADDRESS。", "An address-set change is NET_DRIFT; a down link is NET_LINK_DOWN; a missing address is NET_NO_ADDRESS."),
        t("N/A；狀態比較，不重送。", "N/A; a state comparison that does not resend."),
        t("PRE 建 network baseline，POST 比對位址與 link。", "PRE builds the network baseline; POST diffs address and link."),
        t("`ip address show` command record 與淨變 findings。", "`ip address show` command record and delta findings."),
        t("NET_DRIFT; NET_LINK_DOWN; NET_NO_ADDRESS", "NET_DRIFT; NET_LINK_DOWN; NET_NO_ADDRESS"),
        t("這是 6969 engine 專屬的網路層驗證。", "A network-layer check specific to the 6969 engine."),
    ),
    item(
        "11", "memory", t("Memory Collection", "Memory Collection"), PRE_POST,
        t("OPERATIONS['DIMM']（`dmidecode -t memory`）與 OPERATIONS['OS-memory']（`/proc/meminfo`），搭配 `MEMORY_MIN_RATIO`。", "OPERATIONS['DIMM'] (`dmidecode -t memory`) and OPERATIONS['OS-memory'] (`/proc/meminfo`), with `MEMORY_MIN_RATIO`."),
        t("確認 DIMM 拓撲與 OS 可見記憶體比例符合門檻。", "Confirm DIMM topology and the OS-visible memory ratio meet the threshold."),
        t("確認 DIMM 拓撲與 OS 可見記憶體比例符合門檻。", "Confirm DIMM topology and the OS-visible memory ratio meet the threshold."),
        t("讀取 DMIM/OS memory；可見比例低於門檻時回報。", "Read DIMM/OS memory; report when the visible ratio is below threshold."),
        t("DIMM 拓撲與 PRE 一致且可見記憶體比例達標。", "DIMM topology matches PRE and the visible ratio meets the threshold."),
        t("可見比例低於門檻時標記。", "A visible ratio below threshold is flagged."),
        t("可見記憶體比例未達 MEMORY_MIN_RATIO 即回報。", "A visible ratio below MEMORY_MIN_RATIO is reported."),
        t("N/A。", "N/A."),
        t("PRE↔POST 比對 DIMM 拓撲；可見比例為獨立門檻判定。", "PRE↔POST compares DIMM topology; the visible ratio is an independent threshold judgement."),
        t("dmidecode / meminfo command records 與 findings。", "dmidecode / meminfo command records and findings."),
        t("MEMORY_MIN_RATIO; MEMORY_VISIBLE; CONFIG_FAILED", "MEMORY_MIN_RATIO; MEMORY_VISIBLE; CONFIG_FAILED"),
    ),
    item(
        "12", "nvme", t("NVMe Collection", "NVMe Collection"), PRE_POST,
        t("OPERATIONS['NVMe']：`nvme list`（sudo）。", "OPERATIONS['NVMe']: `nvme list` (sudo)."),
        t("記錄 NVMe 裝置清單與健康資訊，作為變更偵測基準。", "Record the NVMe device list and health information as a change-detection baseline."),
        t("記錄 NVMe 裝置清單與健康資訊。", "Record the NVMe device list and health information."),
        t("擷取 NVMe 清單，與 baseline 比較。", "Capture the NVMe list and compare against baseline."),
        t("NVMe 清單與 PRE 一致。", "The NVMe list matches PRE."),
        t("N/A。", "N/A."),
        t("清單差異或指令失敗時依 engine 收集路徑回報。", "A list difference or command failure is reported through the engine's collection path."),
        t("N/A。", "N/A."),
        t("PRE↔POST 清單比較。", "PRE↔POST list comparison."),
        t("`nvme list` command record。", "`nvme list` command record."),
        t("COLLECTION_FAILED; CONFIG_FAILED", "COLLECTION_FAILED; CONFIG_FAILED"),
    ),
    item(
        "13", "mst", t("MST / Storage Fabric", "MST / Storage Fabric"), PRE_POST,
        t("OPERATIONS['MST']：`mst status -v`（sudo），並搭配 NIC slot 的 MST 列檢查。", "OPERATIONS['MST']: `mst status -v` (sudo), with the NIC slot MST-row checks."),
        t("確認 MST 模組與 fabric 拓撲完整，避免 NIC 掛載異常。", "Confirm the MST module and fabric topology are intact so NIC attachment is not abnormal."),
        t("確認 MST 模組與 fabric 拓撲完整，避免 NIC 掛載異常。", "Confirm the MST module and fabric topology are intact so NIC attachment is not abnormal."),
        t("解析 MST 狀態；缺少模組或列異常時回報。", "Parse MST status; report a missing module or an abnormal row."),
        t("MST 狀態完整且與 PRE 一致。", "MST status is intact and matches PRE."),
        t("MST 列異常時標記。", "An abnormal MST row is flagged."),
        t("MST 模組缺失即 MST_MISSING；列異常即 NIC_MST_ROW。", "A missing MST module is MST_MISSING; an abnormal row is NIC_MST_ROW."),
        t("N/A。", "N/A."),
        t("PRE↔POST 的 MST 狀態比較。", "PRE↔POST MST status comparison."),
        t("`mst status -v` command record。", "`mst status -v` command record."),
        t("MST_MISSING; NIC_MST_ROW", "MST_MISSING; NIC_MST_ROW"),
    ),
    item(
        "14", "cpu", t("CPU / CPU-online Validation", "CPU / CPU-online Validation"), PRE_POST,
        t("OPERATIONS['CPU']（`dmidecode -t processor`）與 OPERATIONS['CPU-online']（`lscpu --all -p=CPU,SOCKET,ONLINE`）。", "OPERATIONS['CPU'] (`dmidecode -t processor`) and OPERATIONS['CPU-online'] (`lscpu --all -p=CPU,SOCKET,ONLINE`)."),
        t("確認 CPU 數量/拓撲與上線的 CPU 核心集合符合預期。", "Confirm CPU count/topology and the set of online CPU cores match expectation."),
        t("確認 CPU 數量/拓撲與上線的 CPU 核心集合符合預期。", "Confirm CPU count/topology and the set of online CPU cores match expectation."),
        t("解析 CPU 拓撲與 online 集合；與預期比對。", "Parse CPU topology and the online set; diff against expectation."),
        t("拓撲與 online 集合符合預期。", "Topology and online set match expectation."),
        t("online 集合異常時依 engine 判定標記。", "An abnormal online set is flagged as the engine decides."),
        t("online CPU 缺失或與預期不符即回報（CHECK|CPU_ONLINE 訊號）。", "A missing or unexpected online CPU is reported (CHECK|CPU_ONLINE signal)."),
        t("N/A。", "N/A."),
        t("PRE↔POST 的 CPU online 集合比較。", "PRE↔POST comparison of the CPU online set."),
        t("dmidecode / lscpu command records。", "dmidecode / lscpu command records."),
        t("CONFIG_FAILED; CPU offline findings", "CONFIG_FAILED; CPU offline findings"),
    ),
    item(
        "15", "gpu", t("GPU Collection (nvidia-smi)", "GPU Collection (nvidia-smi)"), PRE_POST,
        t("OPERATIONS['GPU']：`nvidia-smi -L`，以及 OPERATIONS['gpu']：`nvidia-smi --query-gpu=uuid,name,driver_version,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits`。", "OPERATIONS['GPU']: `nvidia-smi -L`, and OPERATIONS['gpu']: `nvidia-smi --query-gpu=uuid,name,driver_version,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits`."),
        t("記錄 GPU 清單、驅動版本與即時使用率/記憶體，作為 GPU 健康與容量基準。", "Record the GPU list, driver version, and live utilization/memory as the GPU health and capacity baseline."),
        t("以 nvidia-smi 擷取 GPU 清單與量化指標。", "Capture the GPU list and quantitative metrics via nvidia-smi."),
        t("GPU 清單與驅動版本與 PRE 一致。", "The GPU list and driver version match PRE."),
        t("使用率/記憶體異常時可作為觀察指標。", "Abnormal utilization/memory serves as an observation metric."),
        t("GPU 清單或驅動變動時依 engine 收集路徑回報。", "A GPU list or driver change is reported through the engine's collection path."),
        t("N/A。", "N/A."),
        t("PRE↔POST 的 GPU 清單/驅動比較。", "PRE↔POST GPU list/driver comparison."),
        t("`nvidia-smi` command records。", "`nvidia-smi` command records."),
        t("DMESG_GPU; COLLECTION_FAILED", "DMESG_GPU; COLLECTION_FAILED"),
        t("這是 6969 engine 具備的 GPU 層收集能力。", "A GPU-layer collection capability present in the 6969 engine."),
    ),
    item(
        "16", "firmware", t("Firmware / BIOS Collection", "Firmware / BIOS Collection"), PRE_POST,
        t("OPERATIONS['firmware'] / OPERATIONS['BIOS-firmware']：`dmidecode -t bios`（sudo）。", "OPERATIONS['firmware'] / OPERATIONS['BIOS-firmware']: `dmidecode -t bios` (sudo)."),
        t("記錄 BIOS/系統韌體版本，作為變更偵測基準。", "Record the BIOS/system firmware version as a change-detection baseline."),
        t("記錄 BIOS/系統韌體版本，作為變更偵測基準。", "Record the BIOS/system firmware version as a change-detection baseline."),
        t("擷取 BIOS 版本資訊，與 baseline 比對。", "Capture BIOS version info and diff against baseline."),
        t("BIOS 版本與 PRE 一致。", "The BIOS version matches PRE."),
        t("N/A。", "N/A."),
        t("版本變動時依 engine 判定回報。", "A version change is reported as the engine decides."),
        t("N/A。", "N/A."),
        t("PRE↔POST 的韌體版本比較。", "PRE↔POST firmware version comparison."),
        t("`dmidecode -t bios` command record。", "`dmidecode -t bios` command record."),
        t("CONFIG_FAILED; COLLECTION_FAILED", "CONFIG_FAILED; COLLECTION_FAILED"),
    ),
    item(
        "17", "system-info", t("System Information / Drivers / Tools", "System Information / Drivers / Tools"), PRE_POST,
        t("OPERATIONS['system']（`uname -a; cat /etc/os-release; lscpu`）、OPERATIONS['drivers']（`/proc/modules`）、OPERATIONS['tools']（工具版本）。", "OPERATIONS['system'] (`uname -a; cat /etc/os-release; lscpu`), OPERATIONS['drivers'] (`/proc/modules`), OPERATIONS['tools'] (tool versions)."),
        t("記錄系統/OS/驅動/工具環境，確保驗證在已知環境下執行。", "Record the system/OS/driver/tool environment so validation runs in a known environment."),
        t("擷取核心版本、OS 版本、已載入模組與關鍵工具版本。", "Capture kernel version, OS version, loaded modules, and key tool versions."),
        t("環境資訊成功擷取。", "Environment info is captured successfully."),
        t("N/A。", "N/A."),
        t("擷取失敗時依 engine 收集路徑回報。", "A capture failure is reported through the engine's collection path."),
        t("N/A。", "N/A."),
        t("環境資訊作為 context，供 PRE↔POST 差異參考。", "Environment info is context for PRE↔POST diffing."),
        t("system / drivers / tools command records。", "system / drivers / tools command records."),
        t("COLLECTION_FAILED", "COLLECTION_FAILED"),
        t("helpers 與 tools 版本一併記錄，便於重現。", "Helpers and tool versions are recorded for reproducibility."),
    ),
    item(
        "18", "sensors", t("Sensor Validation", "Sensor Validation"), PRE_POST,
        t("OPERATIONS['sensor']：OOB `sensor list`；由 sensor_issues / compare_sensors 解析。", "OPERATIONS['sensor']: OOB `sensor list`; parsed by sensor_issues / compare_sensors."),
        t("偵測感測器讀值與狀態異常，並確認 PRE↔POST 沒有非預期回復或惡化。", "Detect abnormal sensor readings/state and confirm no unexpected recovery or worsening across PRE↔POST."),
        t("訓練:解析每一列感測器；狀態分類為 critical / noncritical / unreadable / unrecognized / malformed；再與 baseline 比較缺少與回復。", "Training: parse each sensor row; classify state as critical / noncritical / unreadable / unrecognized / malformed; then diff missing and recovered against baseline."),
        t("所有感測器狀態正常（非 critical/unreadable）。", "All sensors are in a normal state (not critical/unreadable)."),
        t("非關鍵異常標為 WARN。", "A non-critical abnormality is WARN."),
        t("critical 狀態即 SENSOR_CRITICAL；無法讀取即 SENSOR_UNREADABLE；無法辨識即 SENSOR_UNRECOGNIZED；格式錯誤即 SENSOR_MALFORMED；名稱含非法字元即 SENSOR_NAME_MALFORMED；重複即 SENSOR_DUPLICATE；空集合即 SENSOR_EMPTY。", "A critical state is SENSOR_CRITICAL; unreadable is SENSOR_UNREADABLE; unrecognized is SENSOR_UNRECOGNIZED; malformed is SENSOR_MALFORMED; an illegal name is SENSOR_NAME_MALFORMED; a duplicate is SENSOR_DUPLICATE; an empty set is SENSOR_EMPTY."),
        t("以 wait_sensor_retry 對 transient sensor 讀取失敗重試後再判定。", "wait_sensor_retry retries transient sensor read failures before judgement."),
        t("PRE↔POST 比較缺少感測器（SENSOR_MISSING）與回復感測器（SENSOR_RECOVERED）。", "PRE↔POST compares SENSOR_MISSING and SENSOR_RECOVERED."),
        t("`sensor list` command record 與逐列 findings。", "`sensor list` command record and per-row findings."),
        t("SENSOR_CRITICAL; SENSOR_NONCRITICAL; SENSOR_UNREADABLE; SENSOR_UNRECOGNIZED; SENSOR_MALFORMED; SENSOR_NAME_MALFORMED; SENSOR_DUPLICATE; SENSOR_EMPTY; SENSOR_MISSING; SENSOR_RECOVERED; SENSOR_CONFIRM_FAILED", "SENSOR_CRITICAL; SENSOR_NONCRITICAL; SENSOR_UNREADABLE; SENSOR_UNRECOGNIZED; SENSOR_MALFORMED; SENSOR_NAME_MALFORMED; SENSOR_DUPLICATE; SENSOR_EMPTY; SENSOR_MISSING; SENSOR_RECOVERED; SENSOR_CONFIRM_FAILED"),
        t("不可讀必須以 SENSOR_UNREADABLE 呈現，不能當成 known-good 通過。", "Unreadable must surface as SENSOR_UNREADABLE and must not pass as known-good."),
    ),
    item(
        "19", "dmesg", t("dmesg / Kernel Event Validation", "dmesg / Kernel Event Validation"), PRE_POST,
        t("OPERATIONS['kernel_snapshot']：`dmesg`（sudo）；由 cycle_dmesg 的 PATTERNS 分類。", "OPERATIONS['kernel_snapshot']: `dmesg` (sudo); classified by cycle_dmesg PATTERNS."),
        t("擷取並分類核心硬體錯誤事件，偵測 campaign 期間新增的 kernel 事件。", "Capture and classify kernel hardware-error events, detecting new kernel events during the campaign."),
        t("擷取並分類核心硬體錯誤事件，偵測 campaign 期間新增的 kernel 事件。", "Capture and classify kernel hardware-error events, detecting new kernel events during the campaign."),
        t("dmesg_issues 逐行比對 PATTERNS；dmesg 先清再於 campaign 中擷取，使 delta 只反映本次。", "dmesg_issues matches PATTERNS line by line; dmesg is cleared first and captured during the campaign so the delta reflects only this run."),
        t("無新增的 kernel 硬體錯誤事件。", "No new kernel hardware-error events."),
        t("N/A。", "N/A."),
        t("符合 pattern 的事件即依 family 產生對應碼（KERNEL/ARM/MCE/EDAC/PCIE/NVME/NIC/GPU）。", "A pattern match produces the family code (KERNEL/ARM/MCE/EDAC/PCIE/NVME/NIC/GPU)."),
        t("N/A；以 clear-then-capture 的方式避免歷史事件干擾。", "N/A; clear-then-capture avoids historical interference."),
        t("PRE↔POST 的 kernel event delta。", "PRE↔POST kernel-event delta."),
        t("dmesg command record、分類後的事件 evidence。", "dmesg command record and classified event evidence."),
        t("DMESG_KERNEL; DMESG_ARM; DMESG_MCE; DMESG_EDAC; DMESG_PCIE; DMESG_NVME; DMESG_NIC; DMESG_GPU", "DMESG_KERNEL; DMESG_ARM; DMESG_MCE; DMESG_EDAC; DMESG_PCIE; DMESG_NVME; DMESG_NIC; DMESG_GPU"),
    ),
    item(
        "20", "ipmi-sel", t("IPMI SEL", "IPMI SEL"), PRE_POST,
        t("OPERATIONS['sel'] / OPERATIONS['sel_info']：OOB `sel list` / `sel info`。", "OPERATIONS['sel'] / OPERATIONS['sel_info']: OOB `sel list` / `sel info`."),
        t("擷取 BMC 系統事件日誌並計算 PRE↔POST 的 delta。", "Capture the BMC system event log and compute the PRE↔POST delta."),
        t("擷取 BMC 系統事件日誌並計算 PRE↔POST 的 delta。", "Capture the BMC system event log and compute the PRE↔POST delta."),
        t("sel_records 解析；sel_delta 比較前後；格式異常即回報。", "sel_records parses; sel_delta diffs; a format anomaly is reported."),
        t("SEL 格式正確且無新增事件。", "The SEL format is valid and there are no new events."),
        t("N/A。", "N/A."),
        t("SEL 解析失敗即 SEL_FORMAT_ERROR；新增事件即 SEL_EVENT。", "A parse failure is SEL_FORMAT_ERROR; a new event is SEL_EVENT."),
        t("N/A。", "N/A."),
        t("PRE↔POST 的 SEL delta。", "PRE↔POST SEL delta."),
        t("`sel list` command record 與事件 findings。", "`sel list` command record and event findings."),
        t("SEL_FORMAT_ERROR; SEL_EVENT; IPMI_REPORTED_ERROR", "SEL_FORMAT_ERROR; SEL_EVENT; IPMI_REPORTED_ERROR"),
    ),
    item(
        "21", "redfish", t("Redfish EventLog / SEL", "Redfish EventLog / SEL"), PRE_POST,
        t("Redfish session 擷取（EventLog、SEL、Journal、HostLogger 依優先序最多 500 筆）。", "Redfish session capture (EventLog, SEL, Journal, HostLogger, up to 500 entries by priority)."),
        t("擷取 BMC Redfish 日誌服務並計算 PRE↔POST 的 delta。", "Capture BMC Redfish log services and compute the PRE↔POST delta."),
        t("擷取 BMC Redfish 日誌服務並計算 PRE↔POST 的 delta。", "Capture BMC Redfish log services and compute the PRE↔POST delta."),
        t("_redfish_fetch_collection 逐 service 擷取；_redfish_severity_issues 轉為 findings；_redfish_loop_delta 計算 loop 期間差異。", "_redfish_fetch_collection fetches per service; _redfish_severity_issues converts to findings; _redfish_loop_delta computes loop deltas."),
        t("Redfish 服務可讀、session 建立成功、且無新增 critical 事件。", "The Redfish service is readable, the session is established, and there are no new critical events."),
        t("N/A。", "N/A."),
        t("critical 事件即 REDFISH_CRITICAL；collection 失敗即 REDFISH_COLLECTION_FAILED；服務不可用即 REDFISH_UNAVAILABLE；logout 失敗即 REDFISH_LOGOUT_FAILED；清除失敗即 REDFISH_CLEAR_FAILED。", "A critical event is REDFISH_CRITICAL; a collection failure is REDFISH_COLLECTION_FAILED; an unavailable service is REDFISH_UNAVAILABLE; a failed logout is REDFISH_LOGOUT_FAILED; a failed clear is REDFISH_CLEAR_FAILED."),
        t("每次 capture 重建 Redfish session；login/logout 各自記錄結果。", "Each capture rebuilds the Redfish session; login/logout results are recorded."),
        t("PRE↔POST 的 Redfish event delta。", "PRE↔POST Redfish event delta."),
        t("Redfish evidence（entries 路徑、verdict、counts）。", "Redfish evidence (entries path, verdict, counts)."),
        t("REDFISH_CRITICAL; REDFISH_EVENT; REDFISH_COLLECTION_FAILED; REDFISH_UNAVAILABLE; REDFISH_LOGOUT_FAILED; REDFISH_CLEAR_FAILED", "REDFISH_CRITICAL; REDFISH_EVENT; REDFISH_COLLECTION_FAILED; REDFISH_UNAVAILABLE; REDFISH_LOGOUT_FAILED; REDFISH_CLEAR_FAILED"),
    ),
    item(
        "22", "bmc-identity-firmware", t("BMC Identity and Firmware", "BMC Identity and Firmware"), PRE_POST,
        t("OPERATIONS['bmc_identity']（`mc guid`）與 OPERATIONS['bmc_firmware']（`mc info`），含 LAN channel 位址/ MAC 解析。", "OPERATIONS['bmc_identity'] (`mc guid`) and OPERATIONS['bmc_firmware'] (`mc info`), including LAN channel address/MAC parsing."),
        t("確認 BMC 身分（GUID、MAC/IP）與韌體版本，並可與 inventory 綁定。", "Confirm BMC identity (GUID, MAC/IP) and firmware version, bindable to the inventory."),
        t("確認 BMC 身分（GUID、MAC/IP）與韌體版本，並可與 inventory 綁定。", "Confirm BMC identity (GUID, MAC/IP) and firmware version, bindable to the inventory."),
        t("收集 OS/BMC MAC 與 IP 並比對 expected；LAN channels 逐一查詢。", "Collect OS/BMC MAC and IP and compare against expected; LAN channels are queried one by one."),
        t("BMC GUID/韌體/位址一致且與 inventory 綁定相符。", "BMC GUID/firmware/address are consistent and match the inventory binding."),
        t("N/A。", "N/A."),
        t("BMC 不可達即 BMC_UNAVAILABLE；身分不符時回報。", "An unreachable BMC is BMC_UNAVAILABLE; an identity mismatch is reported."),
        t("N/A。", "N/A."),
        t("PRE↔POST 的 BMC 身分/韌體比較。", "PRE↔POST BMC identity/firmware comparison."),
        t("mc guid / mc info command records 與 LAN channel evidence。", "mc guid / mc info command records and LAN channel evidence."),
        t("BMC_UNAVAILABLE; COLLECTION_FAILED", "BMC_UNAVAILABLE; COLLECTION_FAILED"),
    ),
    item(
        "23", "power", t("Chassis / Host Power", "Chassis / Host Power"), PRE_POST,
        t("OPERATIONS['power']（OOB `power status`）與 OPERATIONS['host_power']（`/usr/bin/powerctrl.sh power_status`）。", "OPERATIONS['power'] (OOB `power status`) and OPERATIONS['host_power'] (`/usr/bin/powerctrl.sh power_status`)."),
        t("確認機箱與主機電源狀態可供 cycle 執行，並偵測 PRE↔POST 的變化。", "Confirm chassis and host power state allow cycle execution and detect PRE↔POST changes."),
        t("分別擷取 OOB 與 host 電源狀態。", "Capture OOB and host power state separately."),
        t("電源狀態符合執行期待（host running）。", "Power state matches execution expectation (host running)."),
        t("N/A。", "N/A."),
        t("主機未運行即 HOST_NOT_RUNNING；電源未開即 POWER_NOT_ON。", "A non-running host is HOST_NOT_RUNNING; power off is POWER_NOT_ON."),
        t("Recovery 期間依實作輪詢電源/開機狀態至 deadline。", "During recovery, power/boot state is polled until the deadline."),
        t("PRE↔POST 的電源狀態比較。", "PRE↔POST power state comparison."),
        t("power status / powerctrl command records。", "power status / powerctrl command records."),
        t("HOST_NOT_RUNNING; POWER_NOT_ON; BMC_UNAVAILABLE", "HOST_NOT_RUNNING; POWER_NOT_ON; BMC_UNAVAILABLE"),
        t("這是 6969 engine 具備的 host_power 專屬檢查。", "A host_power check specific to the 6969 engine."),
    ),
    item(
        "24", "hardware-config", t("Hardware Script / Config Validation", "Hardware Script / Config Validation"), PRE_POST,
        t("經驗證的專案硬體腳本（`{eq3300,naboo,neutrino}_config.sh`），回報 `CHECK|` 與 `ISSUE|` 行。", "The verified project hardware script (`{eq3300,naboo,neutrino}_config.sh`) reporting `CHECK|` and `ISSUE|` lines."),
        t("執行專案特定的硬體檢查並結構化回報，涵蓋 PCIe/NIC/MST/記憶體/CPU 等。", "Run project-specific hardware checks and report them structurally, covering PCIe/NIC/MST/memory/CPU, etc."),
        t("執行專案特定的硬體檢查並結構化回報，涵蓋 PCIe/NIC/MST/記憶體/CPU 等。", "Run project-specific hardware checks and report them structurally, covering PCIe/NIC/MST/memory/CPU, etc."),
        t("ensure_verified_script 先驗證腳本雜湊；config_issues 解析 ISSUE|/CHECK|；parse_hardware_checks 建立 checks 與 details；hardware 執行以 MEMORY_MIN_RATIO 參數化。", "ensure_verified_script verifies the script hash; config_issues parses ISSUE|/CHECK|; parse_hardware_checks builds checks and details; hardware runs parameterised with MEMORY_MIN_RATIO."),
        t("腳本雜湊驗證通過且回報 `RESULT|PASS`。", "The script hash verifies and it reports `RESULT|PASS`."),
        t("回報 WARN 層級訊號時標記。", "A WARN-level signal is flagged."),
        t("腳本未通過雜湊驗證即 SCRIPT_VALIDATION_FAILED；非零退出即 CONFIG_FAILED；未回傳最終 `RESULT|` 即 CONFIG_INCOMPLETE；執行未完成即 HARDWARE_EXECUTION_INCOMPLETE。", "A hash-verification failure is SCRIPT_VALIDATION_FAILED; a non-zero exit is CONFIG_FAILED; a missing final `RESULT|` is CONFIG_INCOMPLETE; an incomplete run is HARDWARE_EXECUTION_INCOMPLETE."),
        t("N/A；腳本為一次性執行，不以重試掩蓋失敗。", "N/A; the script runs once and failures are not masked by retries."),
        t("PRE↔POST 的硬體檢查結果比較。", "PRE↔POST hardware-check comparison."),
        t("腳本輸出、checks/details、RESULT 行。", "Script output, checks/details, RESULT line."),
        t("CONFIG_FAILED; CONFIG_INCOMPLETE; HARDWARE_EXECUTION_INCOMPLETE; SCRIPT_VALIDATION_FAILED; and project codes (PCIE_*, NIC_*, MST_*, MEMORY_*)", "CONFIG_FAILED; CONFIG_INCOMPLETE; HARDWARE_EXECUTION_INCOMPLETE; SCRIPT_VALIDATION_FAILED; and project codes (PCIE_*, NIC_*, MST_*, MEMORY_*)"),
    ),
    item(
        "25", "project-hardware", t("Project-Specific Hardware Validation Interface", "Project-Specific Hardware Validation Interface"), PRE_POST,
        t("`ISSUE|<code>|<component>|<detail>` 與 `CHECK|<name>|key=value...` 的結構化介面。", "The structured interface `ISSUE|<code>|<component>|<detail>` and `CHECK|<name>|key=value...`."),
        t("定義專案硬體腳本可回報的固定介面，讓不同專案以同一格式貢獻 findings。", "Define the fixed interface a project hardware script uses so different projects contribute findings in one format."),
        t("engine 解析 CHECK 行建立 checks，並將配套的 ISSUE 行轉為 findings，snippet 用於指回原始行。", "The engine parses CHECK lines into checks and turns paired ISSUE lines into findings, with a snippet pointing back to the source line."),
        t("所有回報的 check 通過。", "All reported checks pass."),
        t("WARN severity 的 ISSUE 以警告呈現。", "A WARN-severity ISSUE is presented as a warning."),
        t("任一 FAIL severity 的 ISSUE 即為該 component 的失敗。", "Any FAIL-severity ISSUE fails that component."),
        t("N/A。", "N/A."),
        t("PRE↔POST 逐 check 比對。", "PRE↔POST per-check comparison."),
        t("結構化 ISSUE/CHECK 行與對應 snippet。", "Structured ISSUE/CHECK lines and their snippets."),
        t("Project codes: PCIE_*; NIC_*; MST_*; MEMORY_*; DEVICE_MISSING; DEVICE_TYPE; PCIE_INVENTORY_UNSTABLE", "Project codes: PCIE_*; NIC_*; MST_*; MEMORY_*; DEVICE_MISSING; DEVICE_TYPE; PCIE_INVENTORY_UNSTABLE"),
        t("這是專案硬體檢查與 engine 之間唯一的貢獻介面。", "This is the sole contribution interface between project hardware checks and the engine."),
    ),
    item(
        "26", "cycle-command", t("Cycle Command Dispatch", "Cycle Command Dispatch"), CYCLE,
        t("dispatch / dispatch 於 loop 中送出的受控 cycle 指令，含 SEL clear 等。", "The controlled cycle commands dispatched in the loop, including SEL clear."),
        t("以可稽核的方式送出 cycle 指令，並記錄其結果與確認狀態。", "Dispatch cycle commands in an auditable way and record their result and confirmation state."),
        t("以可稽核的方式送出 cycle 指令，並記錄其結果與確認狀態。", "Dispatch cycle commands in an auditable way and record their result and confirmation state."),
        t("每次 dispatch 記錄 state（SENT / RESPONSE_LOST / NOT_ISSUED）與 action record。", "Each dispatch records its state (SENT / RESPONSE_LOST / NOT_ISSUED) and an action record."),
        t("指令被送出並確認。", "The command is sent and confirmed."),
        t("N/A。", "N/A."),
        t("未送出或指令失敗即 CYCLE_COMMAND_FAILED；回應遺失即 RESPONSE_LOST；之後僅能由 evidence reconcile 或成為 COMMAND_UNCONFIRMED；成功 reconcile 即 COMMAND_RECONCILED。", "Not issued or failed is CYCLE_COMMAND_FAILED; a lost response is RESPONSE_LOST, which can only later be reconciled by evidence or become COMMAND_UNCONFIRMED; a successful reconcile is COMMAND_RECONCILED."),
        t("回應遺失時不盲目重送；改以 evidence reconcile 確認實際結果。", "A lost response is not blindly re-sent; evidence reconcile confirms the actual result."),
        t("以 action record 與 loop delta 比較 PRE↔POST 的命令效果。", "PRE↔POST command effect is compared via the action record and loop delta."),
        t("action records、dispatch state。", "Action records, dispatch state."),
        t("CYCLE_COMMAND_FAILED; RESPONSE_LOST; COMMAND_UNCONFIRMED; COMMAND_RECONCILED", "CYCLE_COMMAND_FAILED; RESPONSE_LOST; COMMAND_UNCONFIRMED; COMMAND_RECONCILED"),
    ),
    item(
        "27", "boot-transition", t("Boot ID Transition", "Boot ID Transition"), POST,
        t("wait_boot 於指令後比對 new boot ID 與 expected。", "wait_boot compares the new boot ID against expected after a command."),
        t("確認需要重開機的 cycle 指令確實造成 boot，且新的 boot 在 deadline 內完成。", "Confirm a reboot-requiring cycle command actually boots and the new boot completes before the deadline."),
        t("輪詢至 boot deadline，比對 boot ID 是否更新。", "Poll until the boot deadline and compare whether the boot ID changed."),
        t("新的 boot ID 出現且為 UUID 形狀。", "A new boot ID appears with the UUID shape."),
        t("N/A。", "N/A."),
        t("未在 deadline 內觀察到新 boot 即 BOOT_TIMEOUT。", "Not observing a new boot before the deadline is BOOT_TIMEOUT."),
        t("依實作輪詢至 deadline。", "Polls until the deadline as implemented."),
        t("PRE 的 expected boot 與 POST 的新 boot 比較。", "PRE expected boot vs POST new boot."),
        t("wait_boot 的輪詢記錄與 boot ID。", "wait_boot polling records and boot IDs."),
        t("BOOT_TIMEOUT", "BOOT_TIMEOUT"),
        t("6969 engine 以 boot ID 轉換判定，不另設 UNEXPECTED_BOOT_TRANSITION 代碼。", "The 6969 engine judges by boot-ID transition and does not define a separate UNEXPECTED_BOOT_TRANSITION code."),
    ),
    item(
        "28", "endpoint-recovery", t("Endpoint Recovery", "Endpoint Recovery"), POST,
        t("recovery 期間對 endpoint 的連線輪詢與狀態判定。", "Connection polling and state judgement for endpoints during recovery."),
        t("在 cycle 動作造成預期中斷後，確認 endpoint 回到可控狀態。", "After a cycle action causes an expected interruption, confirm the endpoint returns to a controllable state."),
        t("在 cycle 動作造成預期中斷後，確認 endpoint 回到可控狀態。", "After a cycle action causes an expected interruption, confirm the endpoint returns to a controllable state."),
        t("對 transient connection failure 重試至 deadline；記錄每次輪詢狀態。", "Retry transient connection failures until the deadline; record each poll state."),
        t("endpoint 在 deadline 內恢復可控。", "The endpoint recovers to controllable before the deadline."),
        t("N/A。", "N/A."),
        t("無法恢復時依狀態回報 IDENTITY_UNSAFE 或 NODE_UNAVAILABLE。", "On non-recovery, report IDENTITY_UNSAFE or NODE_UNAVAILABLE as appropriate."),
        t("僅對 transient failure 重試；identity mismatch 不以重試掩蓋。", "Retry only transient failures; an identity mismatch is never masked by retries."),
        t("PRE 可控 → POST 恢復可控的比較。", "PRE controllable → POST recovered-controllable comparison."),
        t("recovery metadata 與輪詢記錄。", "Recovery metadata and polling records."),
        t("NODE_UNAVAILABLE; IDENTITY_UNSAFE; HOST_NOT_RUNNING", "NODE_UNAVAILABLE; IDENTITY_UNSAFE; HOST_NOT_RUNNING"),
    ),
    item(
        "29", "evidence", t("Evidence Generation", "Evidence Generation"), ALL_PHASES,
        t("每個檢查在 stage/folder 下寫出的 command record 與 evidence 檔。", "Each check writes command records and evidence files under stage/folder."),
        t("確保每個判定都有可回溯的證據，且證據持久化可靠。", "Ensure every judgement has traceable evidence and that evidence persistence is reliable."),
        t("確保每個判定都有可回溯的證據，且證據持久化可靠。", "Ensure every judgement has traceable evidence and that evidence persistence is reliable."),
        t("evidence 由 stage/folder 管理；EvidencePersistenceError 會被提升而非忽略。", "Evidence is managed via stage/folder; EvidencePersistenceError is raised rather than ignored."),
        t("所有判定都有對應 evidence。", "Every judgement has corresponding evidence."),
        t("N/A。", "N/A."),
        t("evidence 無法持久化時提升為 EvidencePersistenceError，中止而非靜默通過。", "When evidence cannot persist, it raises EvidencePersistenceError and halts rather than passing silently."),
        t("N/A。", "N/A."),
        t("evidence 與派生 comparison 的來源。", "Evidence and the source of derived comparisons."),
        t("stage/folder 下的 command records 與 evidence 檔。", "Command records and evidence files under stage/folder."),
        t("COLLECTION_FAILED", "COLLECTION_FAILED"),
    ),
    item(
        "30", "report-integrity", t("Report / Integrity", "Report / Integrity"), POST,
        t("cycle_report 產出的 campaign report 與 health 匯總。", "The campaign report and health aggregation produced by cycle_report."),
        t("匯總所有檢查為單一 report，並以健康狀態呈現整體結果。", "Aggregate all checks into one report and present the overall result as a health status."),
        t("匯總所有檢查為單一 report，並以健康狀態呈現整體結果。", "Aggregate all checks into one report and present the overall result as a health status."),
        t("aggregate_issues / health / records_health 匯總；report_writer_lock 保護寫入。", "aggregate_issues / health / records_health aggregate; report_writer_lock guards writing."),
        t("report 完整反映所有 record 且 health 正確。", "The report fully reflects all records and health is correct."),
        t("N/A。", "N/A."),
        t("report 產生失敗時依 engine 路徑回報。", "A report-generation failure is reported through the engine path."),
        t("N/A。", "N/A."),
        t("report 為整體 PRE↔POST 的總結。", "The report summarises the whole PRE↔POST."),
        t("campaign report 與 health 匯總。", "Campaign report and health aggregation."),
        t("CYCLE_REVIEW_REPORT", "CYCLE_REVIEW_REPORT"),
    ),
]

SECTIONS = [
    ("01", "overview", t("總覽", "Overview"), t("本規範說明 PA Manager 6969 的 Vera Cycle 驗證在實際執行時會檢查什麼。每一項都對應到 6969 engine 的實際程式路徑，不存在未實作的宣告。", "This specification describes what the PA Manager 6969 Vera Cycle validation actually checks at runtime. Every item maps to a real 6969 engine code path with no unimplemented claims.")),
    ("02", "matrix", t("驗證矩陣", "Validation Matrix"), t("以 PRE / Cycle / POST 階段檢視每個驗證項目的來源、判定與證據。", "Review each validation item's source, judgement, and evidence across PRE / Cycle / POST.")),
    ("03", "pre-check", t("PRE-CHECK", "PRE-CHECK"), t("PRE 以 identity、asset identity、readiness、clean-start 與 baseline capture 建立 immutable reference。硬體/感測器 finding 會顯示給 operator；只有 inventory/identity safety block 才會阻止 target 進入 approved scope。", "PRE establishes the immutable reference through identity, asset identity, readiness, clean-start, and baseline capture. Hardware and sensor findings are shown to the operator; only inventory and identity-safety blocks prevent a target from entering the approved scope.")),
    ("04", "cycle-execution", t("Cycle 執行", "Cycle Execution"), t("Cycle 階段送出受控指令並追蹤其結果與確認狀態。", "The cycle stage dispatches controlled commands and tracks their result and confirmation state.")),
    ("05", "post-check", t("POST-CHECK", "POST-CHECK"), t("POST 重新擷取所有可比較狀態，計算與 PRE 的 delta，並產生 evidence 與 report。", "POST re-captures every comparable state, computes the delta against PRE, and generates evidence and the report.")),
    ("06", "semantics", t("語意與狀態", "Semantics and Status"), t("定義 PASS / WARN / FAIL 與 known / new 的呈現語意。", "Defines the PASS / WARN / FAIL and known / new presentation semantics.")),
]

FLOW = [
    ("01", "pre-check", t("PRE-CHECK", "PRE-CHECK"), t("建立 baseline", "Build baseline")),
    ("02", "cycle-execution", t("CYCLE", "CYCLE"), t("送出受控指令", "Dispatch commands")),
    ("03", "post-check", t("POST-CHECK", "POST-CHECK"), t("計算 delta", "Compute delta")),
    ("04", "semantics", t("REPORT", "REPORT"), t("匯總與健康", "Aggregate & health")),
]

# group items under sections for the detail listing
GROUPS = {
    "pre-check": ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13",
                  "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25"],
    "cycle-execution": ["26"],
    "post-check": ["27", "28", "29", "30"],
}


# --------------------------------------------------------------------------- #
# rendering
# --------------------------------------------------------------------------- #
def _esc(v: object) -> str:
    return html.escape(str(v), quote=True)


def _pair(value: dict, cls: str = "") -> str:
    c = f' class="{cls}"' if cls else ""
    return (f'<span class="lang lang-zh-TW"{c}>{_esc(value["zh-TW"])}</span>'
            f'<span class="lang lang-en"{c}>{_esc(value["en"])}</span>')


def _pair_block(value: dict, cls: str = "lang-block") -> str:
    return (f'<span class="{cls} lang-zh-TW">{_esc(value["zh-TW"])}</span>'
            f'<span class="{cls} lang-en">{_esc(value["en"])}</span>')


def _code_pair(value: dict) -> str:
    return (f'<code class="lang lang-zh-TW">{_esc(value["zh-TW"])}</code>'
            f'<code class="lang lang-en">{_esc(value["en"])}</code>')


def _field(label: dict, value: dict, code: bool = False) -> str:
    v = _code_pair(value) if code else _pair_block(value)
    return f'<div class="sop-field"><dt>{_pair(label)}</dt><dd>{v}</dd></div>'


def _item_detail(spec: dict) -> str:
    f = [
        _field(t("驗證目的", "Purpose"), spec["purpose"]),
        _field(t("執行階段", "Phase"), spec["phase"]),
        _field(t("指令或資料來源", "Command or Data Source"), spec["source"], code=True),
        _field(t("資料收集方式", "Collection Method"), spec["collection"]),
        _field(t("判定邏輯", "Validation Logic"), spec["logic"]),
        _field(t("通過條件", "PASS Criteria"), spec["passed"]),
        _field(t("警告條件", "WARN Criteria"), spec["warned"]),
        _field(t("失敗條件", "FAIL Criteria"), spec["failed"]),
        _field(t("重試與確認機制", "Retry / Confirmation Logic"), spec["retry"]),
        _field(t("前後比較方式", "PRE ↔ POST Comparison"), spec["comparison"]),
        _field(t("驗證證據", "Evidence"), spec["evidence"]),
        _field(t("相關 Issue Code", "Issue Code"), spec["issue_code"], code=True),
        _field(t("備註", "Notes"), spec["notes"]),
    ]
    return (f'<article class="validation-item" id="item-{spec["key"]}">'
            f'<div class="item-heading"><div><span class="item-number">{spec["number"]}</span>'
            f'<h3>{_pair(spec["name"])}</h3></div>'
            f'<span class="item-kind">{_pair(t("Validation Item", "Validation Item"))}</span></div>'
            f'<dl class="sop-fields">{"".join(f)}</dl></article>')


def _matrix_row(spec: dict) -> str:
    return (
        '<details class="matrix-entry"><summary class="matrix-row">'
        f'<span class="matrix-cell phase">{_pair(spec["phase"])}</span>'
        f'<span class="matrix-cell item">{_pair(spec["name"])}<small>{spec["number"]}</small></span>'
        f'<span class="matrix-cell source">{_pair(spec["source"])}</span>'
        f'<span class="matrix-cell logic">{_pair(spec["logic"])}</span>'
        f'<span class="matrix-cell criteria">{_pair(spec["passed"])}</span>'
        f'<span class="matrix-cell criteria warn-cell">{_pair(spec["warned"])}</span>'
        f'<span class="matrix-cell criteria fail-cell">{_pair(spec["failed"])}</span>'
        f'<span class="matrix-cell evidence">{_pair(spec["issue_code"])}</span>'
        '</summary><div class="matrix-detail">'
        f'<a class="detail-link" href="#item-{spec["key"]}">'
        f'{_pair(t("開啟固定 SOP 詳細欄位", "Open the fixed SOP fields"))}</a>'
        '</div></details>'
    )


def _flow_html() -> str:
    parts = []
    for i, (num, sid, title, sub) in enumerate(FLOW):
        parts.append(
            f'<a class="flow-stage" href="#{sid}"><span class="flow-index">{num}</span>'
            f'<strong>{_pair(title)}</strong><small>{_pair(sub)}</small></a>'
        )
        if i < len(FLOW) - 1:
            parts.append('<span class="flow-arrow">&rarr;</span>')
    return f'<nav class="flow-list" aria-label="flow">{"".join(parts)}</nav>'


def _toc() -> str:
    links = "".join(
        f'<a href="#{sid}"><span>{num}</span><span>{_pair(title)}</span></a>'
        for num, sid, title, _ in SECTIONS
    )
    return (f'<nav class="toc"><div class="toc-title">{_pair(t("目錄", "Contents"))}</div>'
            f'{links}<a class="top-link" href="#top"><span>&uarr;</span>'
            f'<span>{_pair(t("回到頂端", "Back to top"))}</span></a></nav>')


def _section_header(number, title, intro, section_id) -> str:
    return (f'<div class="section-heading"><span class="section-number">{number}</span>'
            f'<h2>{_pair(title)}</h2></div>'
            f'<p class="section-intro">{_pair_block(intro)}</p>')


def _item_group(keys) -> str:
    by_num = {s["number"]: s for s in ITEMS}
    return "".join(_item_detail(by_num[k]) for k in keys)


def _overview() -> str:
    by_num = {s["number"]: s for s in ITEMS}
    return (
        '<div class="overview-grid">'
        '<article class="overview-lead"><h3>' + _pair(t("本規範的來源", "Provenance of this specification")) + '</h3>'
        '<p>' + _pair_block(t(
            "本文件由 `cycle_specification_6969.py` 產生，內容逐項對應 PA Manager 6969 engine 的實際程式路徑"
            "（validation_collectors.py、validation_rules.py、validation_identity.py、validation_events.py、"
            "cycle_dmesg.py、cycle_engine.py 與專案 config 腳本）。它只描述 engine 真正會做的事。",
            "This document is generated by `cycle_specification_6969.py`; every item maps to a real PA Manager 6969 "
            "engine code path (validation_collectors.py, validation_rules.py, validation_identity.py, validation_events.py, "
            "cycle_dmesg.py, cycle_engine.py, and the project config scripts). It describes only what the engine actually does.")) +
        '</p></article>'
        '<dl class="overview-facts">'
        f'<div><dt>{_pair(t("驗證項目", "Validation items"))}</dt><dd>{len(ITEMS)}</dd></div>'
        f'<div><dt>{_pair(t("介面", "Interface"))}</dt><dd>{_pair(t("結構化 ISSUE / CHECK", "Structured ISSUE / CHECK"))}</dd></div>'
        f'<div><dt>{_pair(t("核心收集指令", "Core collections"))}</dt><dd>24</dd></div>'
        f'<div><dt>{_pair(t("語言", "Languages"))}</dt><dd>zh-TW / en</dd></div>'
        '</dl></div>'
        + _flow_html()
    )


def _semantic_tables() -> str:
    rows = [
        (t("PASS", "PASS"), t("通過", "Pass"), t("檢查符合預期，無新 finding。", "The check meets expectation with no new finding.")),
        (t("WARN", "WARN"), t("警告", "Warn"), t("非關鍵異常，需 operator 注意但不阻止。", "A non-critical abnormality that needs operator attention but does not block.")),
        (t("FAIL", "FAIL"), t("失敗", "Fail"), t("關鍵異常或無法取得必要資料。", "A critical abnormality or failure to obtain required data.")),
        (t("KNOWN", "KNOWN"), t("已知", "Known"), t("已被標記為已知並抑制的同類問題。", "An issue marked known and suppressed as a recurring kind.")),
        (t("NEW", "NEW"), t("新問題", "New"), t("本次新出現、未被標記的 finding。", "A finding that newly appears and is not marked.")),
    ]
    body = "".join(
        f'<tr><td><span class="badge {k["en"].lower()}">{_pair(k)}</span></td><td>{_pair(lbl)}</td><td>{_pair_block(desc)}</td></tr>'
        for k, lbl, desc in rows
    )
    return ('<div class="contract-panel"><h3>' + _pair(t("狀態語意", "Status semantics")) + '</h3>'
            '<table><thead><tr><th>' + _pair(t("狀態", "Status")) + '</th><th>'
            + _pair(t("名稱", "Label")) + '</th><th>' + _pair(t("說明", "Description"))
            + '</th></tr></thead><tbody>' + body + '</tbody></table></div>')


def render_specification(generated_time: str | None = None) -> str:
    gen = generated_time or datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M %Z")
    by_num = {s["number"]: s for s in ITEMS}
    matrix = "".join(_matrix_row(by_num[s["number"]]) for s in ITEMS)
    detail = "".join(_item_group(GROUPS[sid]) for _, sid, _, _ in SECTIONS if sid in GROUPS)
    parts = []
    parts.append('<!doctype html><html lang="zh-TW" data-lang="zh-TW"><head><meta charset="utf-8">'
                 '<meta name="viewport" content="width=device-width, initial-scale=1">'
                 '<meta name="referrer" content="no-referrer">')
    parts.append('<title>PA Manager 6969 Vera Cycle 驗證規範 | PA Manager 6969 Vera Cycle Validation Specification</title>')
    parts.append(f"<style>{_CSS}</style></head><body id=\"top\">")
    parts.append('<header class="masthead"><div class="masthead-inner">'
                 '<div class="brand-lockup"><div class="brand-mark">' + _LOGO + '</div>'
                 '<div class="brand-rule"></div><div class="brand-meta">'
                 '<span>PA Manager 6969</span><small>Vera Cycle Validation</small></div></div>'
                 '<div class="title-lockup"><div class="utility">'
                 '<span class="document-type">Validation Specification</span>'
                 '<span class="language-switch">'
                 '<button type="button" data-lang="zh-TW" aria-pressed="true">中文</button>'
                 '<button type="button" data-lang="en" aria-pressed="false">English</button></span>'
                 '<button type="button" class="print-control" onclick="window.print()">'
                 + _pair(t("列印 / PDF", "Print / PDF")) + '</button></div>'
                 f'<h1>{_pair(t("Vera Cycle 驗證規範", "Vera Cycle Validation Specification"))}</h1>'
                 f'<p>{_pair(t("PA Manager 6969 · 我們在跑 cycle 時實際驗證的項目", "PA Manager 6969 · What we actually validate when running a cycle"))}</p>'
                 '</div></div></header>')
    parts.append('<div class="page-shell"><aside>' + _toc() + '</aside><main>')
    for num, sid, title, intro in SECTIONS:
        parts.append(f'<section class="doc-section" id="{sid}">{_section_header(num, title, intro, sid)}')
        if sid == "overview":
            parts.append(_overview())
        elif sid == "matrix":
            parts.append('<div class="matrix-wrap"><div class="matrix-head">'
                         f'<div>{_pair(t("階段", "Phase"))}</div><div>{_pair(t("項目", "Item"))}</div>'
                         f'<div>{_pair(t("來源", "Source"))}</div><div>{_pair(t("判定邏輯", "Logic"))}</div>'
                         f'<div>{_pair(t("通過", "PASS"))}</div><div>{_pair(t("警告", "WARN"))}</div>'
                         f'<div>{_pair(t("失敗", "FAIL"))}</div><div>{_pair(t("Issue Code", "Issue Code"))}</div>'
                         '</div>' + matrix + '</div>')
        elif sid in GROUPS:
            parts.append(_item_group(GROUPS[sid]))
        elif sid == "semantics":
            parts.append(_semantic_tables())
        parts.append('</section>')
    parts.append('</main></div>')
    parts.append(f'<footer><div class="page-shell" style="display:block;padding:0 30px 30px">'
                 f'<p>{_pair(t("產生時間", "Generated"))}: {_esc(gen)}</p>'
                 f'<p>{_pair(t("來源", "Source"))}: cycle_specification_6969.py</p></footer>')
    parts.append(f"<script>{_JS}</script></body></html>")
    return "".join(parts)


def write_specification(out: str | Path, generated_time: str | None = None) -> Path:
    path = Path(out)
    path.write_text(render_specification(generated_time), encoding="utf-8")
    return path


_LOGO = (
    '<svg viewBox="0 0 178 40" role="img" aria-label="Wistron">'
    '<rect width="178" height="40" rx="4" fill="#123b59"/>'
    '<text x="12" y="26" font-family="Segoe UI,Arial" font-size="18" font-weight="700" fill="#fff">Wistron</text>'
    '<circle cx="156" cy="20" r="7" fill="#9acd66"/></svg>'
)

_CSS = r'''
:root{color-scheme:light;--navy:#123b59;--blue:#005f91;--blue-2:#016c8c;--mint:#9acd66;--ink:#152b3d;--muted:#506476;--line:#d4e0e7;--paper:#fff;--canvas:#eef3f6;--soft:#f5f8fa;--soft-blue:#eaf3f7;--pass:#285f43;--pass-bg:#e5f2e9;--warn:#795300;--warn-bg:#fff4d4;--fail:#9b2c2c;--fail-bg:#fff0ee;--known:#39546e;--known-bg:#e7eef6;--new:#8c382f;--new-bg:#fff0ec;--radius:5px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--canvas);color:var(--ink);font:14px/1.6 "Segoe UI",Arial,sans-serif;font-variant-numeric:tabular-nums}body:before{content:"";display:block;height:5px;background:linear-gradient(90deg,var(--blue) 0 74%,var(--mint) 74% 100%)}a{color:var(--blue);text-underline-offset:3px;overflow-wrap:anywhere}a:hover{color:var(--navy)}button{font:inherit;color:inherit;cursor:pointer}.lang-en{display:none}body[data-lang=en] .lang-zh-TW{display:none}body[data-lang=en] .lang-en{display:inline}.lang-block{display:block}body[data-lang=en] .lang-block.lang-en{display:block}::selection{background:#bfe1ea;color:var(--navy)}:focus-visible{outline:3px solid #007aa5;outline-offset:3px}code,pre{font-family:Consolas,"Liberation Mono",monospace}code{font-size:.92em;overflow-wrap:anywhere}
.masthead{background:var(--paper);border-bottom:1px solid var(--line)}.masthead-inner{max-width:1480px;margin:auto;padding:23px 30px 22px;display:flex;justify-content:space-between;gap:38px;align-items:flex-start}.brand-lockup{display:flex;align-items:center;gap:18px;min-width:268px}.brand-mark{display:block;width:178px;line-height:0}.brand-mark svg{display:block;width:100%;height:auto}.brand-rule{height:40px;width:1px;background:var(--line)}.brand-meta{display:grid;gap:2px;color:var(--navy);font-weight:650;letter-spacing:.02em}.brand-meta small{font-weight:400;color:var(--muted);font-size:12px}.title-lockup{max-width:850px;flex:1;text-align:right}.utility{display:flex;justify-content:flex-end;align-items:center;gap:15px;color:var(--muted);font-size:12px;margin-bottom:12px}.document-type{font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--blue)}.language-switch{display:flex;align-items:center;gap:7px}.language-switch button{border:0;background:transparent;color:var(--muted);padding:3px 0;text-decoration:underline;text-underline-offset:3px}.language-switch button[aria-pressed=true]{color:var(--navy);font-weight:700;text-decoration-thickness:2px}.print-control{border:1px solid var(--line);background:var(--soft);padding:5px 10px;border-radius:4px;color:var(--navy)}.print-control:hover{background:var(--soft-blue)}h1,h2,h3,p{margin-top:0}h1{font-size:30px;line-height:1.3;letter-spacing:-.025em;margin-bottom:8px;color:var(--navy)}.title-lockup p{margin:0;color:var(--muted);font-size:15px}.page-shell{max-width:1480px;margin:auto;padding:28px 30px 50px;display:grid;grid-template-columns:220px minmax(0,1fr);gap:34px}.page-shell>aside{min-width:0}.toc{position:sticky;top:18px;border:1px solid var(--line);background:var(--paper);border-radius:var(--radius);padding:14px 0;box-shadow:0 2px 12px rgba(18,59,89,.06)}.toc-title{padding:0 15px 10px;font-weight:700;color:var(--navy);border-bottom:1px solid var(--line)}.toc a{display:grid;grid-template-columns:29px 1fr;gap:5px;padding:7px 15px;color:var(--muted);text-decoration:none;font-size:12px;line-height:1.35}.toc a span:first-child{font:700 11px/1.4 Consolas,"Liberation Mono",monospace;color:var(--blue)}.toc a:hover{background:var(--soft-blue);color:var(--navy)}.toc .top-link{border-top:1px solid var(--line);margin-top:8px;padding-top:11px}.doc-section{scroll-margin-top:18px;margin:0 0 34px}.section-heading{display:flex;gap:14px;align-items:baseline;border-bottom:2px solid var(--navy);padding-bottom:10px;margin-bottom:11px}.section-number{font:700 13px/1 Consolas,"Liberation Mono",monospace;color:var(--blue)}h2{font-size:25px;line-height:1.25;letter-spacing:-.02em;color:var(--navy);margin:0}.section-intro{max-width:78ch;color:var(--muted);margin:0 0 18px}.overview-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(370px,.95fr);gap:16px;margin-bottom:16px}.overview-lead,.overview-facts,.contract-panel{border:1px solid var(--line);background:var(--paper);border-radius:var(--radius)}.overview-lead{padding:23px 25px;box-shadow:inset 0 4px 0 var(--blue)}.overview-lead h3{color:var(--navy);margin-bottom:10px;font-size:17px}.overview-lead p{max-width:64ch;margin:0;font-size:16px}.overview-facts{display:grid;grid-template-columns:1fr 1fr;gap:0;padding:7px 20px;margin:0}.overview-facts>div{padding:12px 9px;border-bottom:1px solid var(--line)}.overview-facts>div:nth-last-child(-n+2){border-bottom:0}.overview-facts dt{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.07em}.overview-facts dd{margin:3px 0 0;color:var(--navy);font-weight:650;font-size:13px}.flow-list{display:flex;align-items:stretch;gap:8px;overflow-x:auto;padding:6px 0 12px}.flow-stage{min-width:150px;flex:1;border:1px solid var(--line);box-shadow:inset 0 3px 0 var(--blue);background:var(--paper);padding:12px 13px;text-decoration:none;color:var(--navy);display:flex;flex-direction:column;gap:3px;border-radius:var(--radius);transition:background .16s,border-color .16s}.flow-stage:hover{background:var(--soft-blue);border-color:var(--blue)}.flow-index{font:700 11px/1.35 Consolas,"Liberation Mono",monospace;color:var(--blue)}.flow-stage strong{font-size:12px;line-height:1.35}.flow-stage small{color:var(--muted);line-height:1.35}.flow-arrow{align-self:center;color:var(--blue);font-size:18px}
.matrix-wrap{overflow-x:auto;border:1px solid var(--line);background:var(--paper);border-radius:var(--radius);padding:4px}.matrix-head,.matrix-row{display:grid;grid-template-columns:1.25fr 1.55fr 1.75fr 1.9fr 1.85fr 1.55fr 2.2fr 1.75fr;min-width:1370px}.matrix-head{background:var(--navy);color:#fff;font-size:11px;font-weight:700;letter-spacing:.025em}.matrix-head>div{padding:11px 10px;border-right:1px solid rgba(255,255,255,.16)}.matrix-entry{border-top:1px solid var(--line)}.matrix-entry:first-of-type{border-top:0}.matrix-row{cursor:pointer;list-style:none}.matrix-row::-webkit-details-marker{display:none}.matrix-cell{padding:12px 10px;display:block;border-right:1px solid var(--line);overflow-wrap:anywhere}.matrix-cell.phase{font-weight:650;color:var(--blue);font-size:12px}.matrix-cell.item{color:var(--navy)}.matrix-cell.item small{display:block;color:var(--muted);font:11px/1.4 Consolas,"Liberation Mono",monospace;margin-top:3px}.matrix-cell.source,.matrix-cell.evidence{font:11px/1.45 Consolas,"Liberation Mono",monospace;color:#324b5e}.matrix-cell.criteria{font-size:12px}.warn-cell{color:var(--warn)}.fail-cell{color:var(--fail)}.matrix-entry[open] .matrix-row{background:var(--soft-blue)}.matrix-detail{padding:7px 14px 10px 18px;border-top:1px dashed var(--line);background:#fbfdfe;text-align:right}.detail-link{font-size:12px;font-weight:650}.validation-item{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);margin:0 0 15px;padding:19px 21px;break-inside:avoid;scroll-margin-top:18px}.item-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:12px}.item-heading>div{display:flex;gap:10px;align-items:baseline}.item-number{font:700 12px/1.3 Consolas,"Liberation Mono",monospace;color:var(--blue)}.item-heading h3{font-size:18px;line-height:1.35;color:var(--navy);margin:0}.item-kind{font-size:11px;color:var(--muted);border:1px solid var(--line);padding:4px 8px;border-radius:3px;white-space:nowrap}.sop-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px;margin:0}.sop-field{padding:10px 0 11px;border-bottom:1px solid #e6edf1}.sop-field:nth-last-child(-n+2){border-bottom:0}.sop-field dt{color:var(--blue);font-size:11px;font-weight:700;letter-spacing:.045em;text-transform:uppercase}.sop-field dd{margin:4px 0 0;color:#233e50}.sop-field dd code{display:block;white-space:pre-wrap;color:var(--navy);background:var(--soft);padding:7px 9px;border:1px solid var(--line);border-radius:3px}.contract-panel{padding:19px 20px;margin-top:16px}.contract-panel h3{font-size:14px;letter-spacing:.08em;color:var(--navy);margin-bottom:12px}.contract-panel table{width:100%;border-collapse:collapse;text-align:left}.contract-panel th{font-size:11px;text-transform:uppercase;color:var(--muted);background:var(--soft);letter-spacing:.04em}.contract-panel th,.contract-panel td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}.contract-panel tr:last-child td{border-bottom:0}.badge{display:inline-block;border-radius:4px;padding:2px 7px;font-size:11px;line-height:1.6;font-weight:750;letter-spacing:.035em;white-space:nowrap}.badge.pass{background:var(--pass-bg);color:var(--pass)}.badge.warn{background:var(--warn-bg);color:var(--warn)}.badge.fail{background:var(--fail-bg);color:var(--fail)}.badge.known{background:var(--known-bg);color:var(--known)}.badge.new{background:var(--new-bg);color:var(--new)}footer{border-top:1px solid var(--line);padding-top:20px;color:var(--muted);font-size:12px}footer p{margin:5px 0}
@media(max-width:1100px){.masthead-inner{display:block}.title-lockup{text-align:left;max-width:none;margin-top:23px}.utility{justify-content:flex-start}.page-shell{grid-template-columns:190px minmax(0,1fr);gap:22px}.overview-grid{grid-template-columns:1fr}}
@media(max-width:720px){body{font-size:13px}.masthead-inner{padding:18px 16px}.page-shell{display:block;padding:17px 16px 35px}.page-shell>aside{margin-bottom:18px}.toc{position:static}.toc a{display:inline-flex;gap:6px;margin:2px 0;padding:6px 10px}.toc-title{padding-bottom:10px}.toc .top-link{display:flex;margin-top:6px}.utility{flex-wrap:wrap;gap:10px}.sop-fields{grid-template-columns:1fr}.final-links{display:block}.overview-grid{grid-template-columns:1fr}}
@media print{@page{size:A4 portrait;margin:14mm 13mm}body{background:#fff;color:#111;font-size:9.2pt;line-height:1.4}body:before,.utility,.toc,aside,.print-control,.language-switch{display:none!important}.masthead{border-bottom:1.5pt solid #123b59}.masthead-inner{display:flex;padding:0 0 8mm}.page-shell{display:block;padding:7mm 0 0}.doc-section{margin-bottom:8mm}.doc-section~.doc-section{break-before:page}.overview-lead,.overview-facts,.validation-item,.contract-panel{border:0;border-radius:0;box-shadow:none}.overview-lead{box-shadow:inset 0 2pt 0 #005f91}}
'''

_JS = r'''
(function(){
  var buttons=document.querySelectorAll('.language-switch button');
  function set(l){document.body.setAttribute('data-lang',l);buttons.forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.lang===l));});try{localStorage.setItem('paspec-lang',l);}catch(e){}}
  buttons.forEach(function(b){b.addEventListener('click',function(){set(b.dataset.lang);});});
  try{var saved=localStorage.getItem('paspec-lang');if(saved){set(saved);}}catch(e){}
})();
'''


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the PA Manager 6969 Vera Cycle validation specification.")
    parser.add_argument("--out", default=str(BASE.parents[2] / "CYCLE_VALIDATION_SPECIFICATION.html"),
                        help="output HTML path")
    parser.add_argument("--time", default=None, help="override the generated timestamp")
    args = parser.parse_args()
    path = write_specification(args.out, args.time)
    print(f"wrote {path} ({path.stat().st_size} bytes, {len(ITEMS)} items)")


if __name__ == "__main__":
    main()
