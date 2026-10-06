#!/usr/bin/env bash
# EQ3300 hardware configuration. All selected checks run; nonzero exit means FAIL.
# Maintain EQ3300's expected quantities here, not in the cycle wizard.
set -uo pipefail
export LC_ALL=C
CPU_MIN=2
DIMM_EXPECTED=32
NVMe_MIN=2
# Mellanox NIC count is brand-agnostic: every ConnectX*/BlueField* function counts,
# so future cards (CX9, BF4, ...) need no script change. GPU-as-NIC (NVLink) rows
# are GB100 devices and are never matched by the ^(BlueField|ConnectX) pattern.
NIC_MIN=16
# GPU count is measured with `nvidia-smi -L`; EQ3300 carries 8.
GPU_MIN=8
USB_MIN=1
BMC_MIN=1
MEMORY_MIN_RATIO="${MEMORY_MIN_RATIO:-0.90}"
# PROFILE_PARAMETERS
FAILURES=0
fail() {
    printf 'ISSUE|%s|%s|%s\n' "$1" "$2" "$3"
    FAILURES=$((FAILURES + 1))
}
minimum() {
    local component="$1" actual="$2" expected="$3" code="${4:-DEVICE_MISSING}"
    expected_count "$component" "$actual" "$expected" minimum "$code"
}
expected_count() {
    local component="$1" actual="$2" expected="$3" mode="$4" code="$5"
    local enabled_key="PROFILE_${component}_ENABLED" mode_key="PROFILE_${component}_MODE"
    if [[ "${!enabled_key:-1}" == 0 ]]; then
        printf 'CHECK|%s|state=disabled|actual=%s\n' "$component" "$actual"
        return
    fi
    mode="${!mode_key:-$mode}"
    printf 'CHECK|%s|actual=%s|%s=%s\n' "$component" "$actual" "$mode" "$expected"
    if [[ "$mode" == exact ]] && ((actual != expected)); then
        fail "$code" "$component" "Expected exactly $expected; detected $actual"
    elif [[ "$mode" == minimum ]] && ((actual < expected)); then
        fail "$code" "$component" "Expected at least $expected; detected $actual"
    fi
}
collect() {
    local variable="$1" component="$2"
    shift 2
    local value rc
    if [[ -n "${VALIDATION_SNAPSHOT_DIR:-}" ]]; then
        # Offline checker mode: every source is supplied by the shared collector.
        # Missing input is a collection failure; never fall back to local hardware.
        value=$(cat -- "$VALIDATION_SNAPSHOT_DIR/$component.txt" 2>&1); rc=$?
        if [[ -r "$VALIDATION_SNAPSHOT_DIR/$component.rc" ]]; then
            read -r rc < "$VALIDATION_SNAPSHOT_DIR/$component.rc"
        else rc=125; fi
    else
        value=$("$@" 2>&1); rc=$?
    fi
    printf -v "$variable" '%s' "$value"
    printf '\n[Evidence] %s\n%s\n' "$component" "$value"
    if ((rc != 0)); then fail COLLECTION_FAILED "$component" "Command exited $rc"; fi
    return "$rc"
}

# One ``lspci -Dvv -nn`` call answers everything the checks need: full BDF and
# class ids for the inventory, LnkCap/LnkSta for link validation, and the VPD
# ``[SN] Serial number`` used to count BlueField cards. Capturing it once keeps
# hardware.txt to a single copy instead of three near-identical ones.
pci_capture() {
    local rc
    if [[ -n "${VALIDATION_SNAPSHOT_DIR:-}" ]]; then
        PCI_VERBOSE=$(cat -- "$VALIDATION_SNAPSHOT_DIR/pci.txt" 2>&1); rc=$?
        if [[ -r "$VALIDATION_SNAPSHOT_DIR/pci.rc" ]]; then read -r rc < "$VALIDATION_SNAPSHOT_DIR/pci.rc"; else rc=125; fi
    elif [[ -n "${VALIDATION_PCI_INPUT:-}" ]]; then
        PCI_VERBOSE=$(cat -- "$VALIDATION_PCI_INPUT" 2>&1); rc=$?
    else
        PCI_VERBOSE=$(lspci -Dvv -nn 2>&1); rc=$?
    fi
    PCI=$(printf '%s\n' "$PCI_VERBOSE" | grep -E '^[[:xdigit:]]{4}:[[:xdigit:]]{2}:[[:xdigit:]]{2}\.[0-7] ')
    printf '\n[Evidence] PCI-inventory\n%s\n' "$PCI"
    printf '\n[Evidence] PCIe-links\n%s\n' "$PCI_VERBOSE"
    return "$rc"
}
cpu_check() {
    local data qty
    collect data CPU dmidecode -t processor || return
    qty=$(printf '%s\n' "$data" | awk '/^[[:space:]]*Status:.*Populated/ && !/Unpopulated/ {n++} END {print n+0}')
    minimum CPU "$qty" "$CPU_MIN"
    local enabled topology sockets total online threads row_errors missing_socket
    enabled=$(printf '%s\n' "$data" | awk '/Status:.*Populated/ && /Enabled/ && !/Unpopulated/ {n++} END {print n+0}')
    if ((enabled != qty)); then fail CPU_DISABLED CPU "Only $enabled of $qty populated CPUs are enabled"; fi
    threads=$(printf '%s\n' "$data" | awk '/^[[:space:]]*Thread Count:/ {n+=$3} END {print n+0}')
    collect topology CPU-online lscpu --all -p=CPU,SOCKET,ONLINE || return
    # Reject a malformed lscpu row instead of silently undercounting CPUs:
    # rows must have exactly three clean fields and a unique CPU id.
    read -r sockets total online row_errors missing_socket <<< "$(printf '%s\n' "$topology" | awk -F, '
      /^[[:space:]]*#/ || /^[[:space:]]*$/ {next}
      {for (i=1;i<=NF;i++) gsub(/^[[:space:]]+|[[:space:]]+$/, "", $i)
       if (NF!=3 || $1 !~ /^[0-9]+$/) {bad++; next}
       if (seen[$1]++) {bad++; next}
       n++; if ($3=="Y") on++; else if ($3!="N") bad++
       if ($2 ~ /^[0-9]+$/) s[$2]=1; else missing++}
      END {for (v in s) ns++; print ns+0, n+0, on+0, bad+0, missing+0}')"
    printf 'CHECK|CPU_ONLINE|sockets=%s|logical=%s|online=%s|smbios_threads=%s|row_errors=%s|missing_socket=%s\n' "$sockets" "$total" "$online" "$threads" "$row_errors" "$missing_socket"
    if ((row_errors > 0 || missing_socket > 0 || sockets != enabled || total == 0 || online != total || (threads > 0 && threads != total))); then
        fail CPU_TOPOLOGY CPU "SMBIOS enabled=$enabled threads=$threads; lscpu sockets=$sockets logical=$total online=$online row_errors=$row_errors missing_socket=$missing_socket"
    fi
}
dimm_check() {
    local data qty
    collect data DIMM dmidecode -t memory || return
    qty=$(printf '%s\n' "$data" | awk '/^[[:space:]]*Size:[[:space:]]+[0-9]+[[:space:]]+(MB|GB|TB)/ {if ($2+0>0) n++} END {print n+0}')
    expected_count DIMM "$qty" "$DIMM_EXPECTED" exact DIMM_COUNT
    local installed meminfo visible
    installed=$(printf '%s\n' "$data" | awk '/^[[:space:]]*Size:[[:space:]]+[0-9]+[[:space:]]+(MB|GB|TB)/ {
      factor=($3=="TB" ? 1073741824 : ($3=="GB" ? 1048576 : 1024)); n+=$2*factor} END {printf "%.0f", n}')
    collect meminfo OS-memory cat /proc/meminfo || return
    visible=$(printf '%s\n' "$meminfo" | awk '/^MemTotal:[[:space:]]+[0-9]+[[:space:]]+kB/ {print $2}')
    printf 'CHECK|MEMORY_VISIBLE|installed_kib=%s|visible_kib=%s|minimum_ratio=%s\n' "$installed" "$visible" "$MEMORY_MIN_RATIO"
    if ! awk -v installed="$installed" -v visible="$visible" -v ratio="$MEMORY_MIN_RATIO" 'BEGIN {
      exit !(ratio ~ /^(0(\.[0-9]+)?|1(\.0+)?)$/ && ratio>0 && installed>0 && visible ~ /^[0-9]+$/ && visible>=installed*ratio && visible<=installed)}'; then
        fail MEMORY_VISIBLE DIMM "OS MemTotal does not match installed capacity within the configured ratio"
    fi
}
nvme_check() {
    local data qty
    collect data NVMe nvme list || return
    qty=$(printf '%s\n' "$data" | awk '$1 ~ /^\/dev\/nvme[0-9]+n[0-9]+$/ {v=$1; sub(/n[0-9]+$/, "", v); a[v]=1} END {for (v in a) n++; print n+0}')
    minimum NVMe "$qty" "$NVMe_MIN"
}
nic_check() {
    local data nic mst_valid=true last_skip_bdf=""
    collect data MST mst status -v || mst_valid=false
    # Count Mellanox NIC functions from the mst device table, keyed by DEVICE_TYPE.
    # Every ConnectX*/BlueField* row is one NIC function, regardless of model, so a
    # new card type is counted automatically. GB100 rows are GPUs (incl. their NVLink
    # controllers) and are deliberately excluded, so they never inflate the NIC count.
    nic=$(printf '%s\n' "$data" | awk 'tolower($1) ~ /^(connectx|bluefield)/ {n++} END {print n+0}')
    if ((nic == 0)) && printf '%s\n' "$data" | grep -q 'MST PCI module is not loaded'; then
        fail MST_MODULE MST "MST kernel module is not loaded; Mellanox NIC count is unavailable (run: mst start)"
    fi
    if "$mst_valid"; then
        minimum NIC "$nic" "$NIC_MIN"
        # Per-slot NIC inventory on top of the count. EQ3300 has no fixed slot
        # map, so every mst row that carries a PCI BDF is classified on its own:
        #   PRESENT  - DEVICE_TYPE is a NIC family (ConnectX*/BlueField*)
        #   SKIP     - GB100: a GPU (incl. its NVLink controller), not a NIC
        #   DEGRADED - any other type (e.g. NA): a NIC position whose device did
        #              not come up as a NIC. Reported by BDF with the raw mst row
        #              so the report names the port instead of only "one fewer".
        # The engine stores this in the PRE baseline, so a NIC that later
        # disappears entirely is caught as NIC_MISSING by BDF.
        while IFS='|' read -r kind bdf extra rest; do
            case "$kind" in
                PRESENT)
                    printf 'CHECK|NIC_SLOT|slot=%s|state=PRESENT|mst_device=%s\n' "$bdf" "$extra"
                    ;;
                SKIP)
                    # GB100 exposes a *_pciconf and a *_pci_cr row on the same
                    # BDF; report the GPU once, not twice.
                    if [[ "$bdf" != "$last_skip_bdf" ]]; then
                        printf 'CHECK|NIC_NON_CARD|slot=%s|type=GB100\n' "$bdf"
                        last_skip_bdf="$bdf"
                    fi
                    ;;
                DEGRADED)
                    printf 'CHECK|NIC_SLOT|slot=%s|state=DEGRADED|mst_device=%s\n' "$bdf" "$extra"
                    printf 'CHECK|NIC_MST_ROW|slot=%s|row=%s\n' "$bdf" "$rest"
                    fail NIC_DEGRADED NIC "slot $bdf -> Mellanox NIC (MST device ${extra##*/}) present but DEVICE_TYPE is not a NIC family (expected ConnectX*/BlueField*); card in place but not functional (degraded slot $bdf). mst status row: $rest"
                    ;;
            esac
        done < <(printf '%s\n' "$data" | awk '
            function bdfof(   i) { for (i = 1; i <= NF; i++) if ($i ~ /^[0-9a-fA-F]{2}:[0-9a-fA-F]{2}\.[0-7]$/) return tolower($i); return "" }
            function devof(   i) { for (i = 1; i <= NF; i++) if ($i ~ /^\/dev\/mst\//) return $i; return "" }
            function scrub(row) { gsub(/\t/, " ", row); gsub(/  +/, " ", row); sub(/^ +/, "", row); sub(/ +$/, "", row); return row }
            {
                t = tolower($1)
                b = bdfof()
                if (t ~ /^gb100/) { print "SKIP|" b "|" scrub($0); next }
                if (b == "") next
                if (t ~ /^(connectx|bluefield)/) { print "PRESENT|" b "|" devof(); next }
                print "DEGRADED|" b "|" devof() "|" scrub($0)
            }')
    fi
}
gpu_check() {
    local data qty
    collect data GPU nvidia-smi -L || return
    qty=$(printf '%s\n' "$data" | grep -cE '^GPU [0-9]+:')
    minimum GPU "$qty" "$GPU_MIN"
}
pci_count() {
    local component="$1" pattern="$2" expected="$3" qty
    [[ "$PCI_VALID" == true ]] || return
    qty=$(printf '%s\n' "$PCI" | grep -Eic "$pattern" || :)
    minimum "$component" "$qty" "$expected"
}
link_check() {
    local data line bdf="" name="" endpoint=false integrated=false seen=false denied=false pcie=false
    data="$PCI_VERBOSE"
    # Flush at every function boundary, including the last function.
    while IFS= read -r line; do
        if [[ "$line" == __END__ || "$line" =~ ^[[:xdigit:]]{4}:[[:xdigit:]]{2}:[[:xdigit:]]{2}\.[0-7] ]]; then
            if [[ -n "$bdf" ]]; then
                if [[ "$denied" == true || ( "$endpoint" == true && "$seen" != true ) || ( "$pcie" == true && "$seen" != true ) ]]; then
                    printf 'CHECK|PCIE_LINK|bdf=%s|state=unreadable\n' "$bdf"
                    fail PCIE_LINK_UNAVAILABLE "$bdf" "$name: required link status was not readable"
                elif [[ "$endpoint" != true && "$seen" != true ]]; then
                    printf 'CHECK|PCIE_LINK|bdf=%s|state=unsupported\n' "$bdf"
                fi
            fi
            [[ "$line" == __END__ ]] && break
            bdf=${line%% *}; name=${line#* }; endpoint=false; integrated=false; seen=false; denied=false; pcie=false
            continue
        fi
        [[ "$line" == *'<access denied>'* ]] && denied=true
        if [[ "$line" =~ Express[[:space:]]+(\(v[0-9]+\)[[:space:]]+)?Root[[:space:]]+Complex[[:space:]]+(Integrated[[:space:]]+Endpoint|Event[[:space:]]+Collector)(,|$) ]]; then
            integrated=true
        elif [[ "$line" =~ Express[[:space:]]+(\(v[0-9]+\)[[:space:]]+)?(Legacy[[:space:]]+)?Endpoint(,|$) ]]; then
            endpoint=true
        fi
        # LnkCap with no Express capability header is still an unreadable PCIe link.
        [[ "$line" == *LnkCap:* ]] && pcie=true
        [[ "$line" == *LnkSta:* ]] || continue
        seen=true
        [[ "$endpoint" == true || "$integrated" == true ]] || continue
        printf 'CHECK|PCIE_LINK|bdf=%s|state=evaluated|lnksta=%s\n' "$bdf" "$line"
        if printf '%s\n' "$line" | grep -qiE 'down[[:space:]-]*grad|degrad'; then
            printf 'CHECK|PCIE_DOWNGRADE|bdf=%s|lnksta=%s\n' "$bdf" "$line"
            fail PCIE_DOWNGRADE "$bdf" "${name}: $line"
        elif ! printf '%s\n' "$line" | grep -qE 'Speed[[:space:]]+[0-9]+(\.[0-9]+)?GT/s.*Width[[:space:]]+x[1-9][0-9]*([^0-9]|$)'; then
            fail PCIE_LINK_UNAVAILABLE "$bdf" "${name}: $line"
        fi
    done <<< "$data
__END__"
    local expected actual
    expected=$(printf '%s\n' "$PCI" | awk '/^[[:xdigit:]]{4}:[[:xdigit:]]{2}:[[:xdigit:]]{2}\.[0-7]/ {print tolower($1)}' | sort -u)
    actual=$(printf '%s\n' "$data" | awk '/^[[:xdigit:]]{4}:[[:xdigit:]]{2}:[[:xdigit:]]{2}\.[0-7]/ {print tolower($1)}' | sort -u)
    if [[ "$expected" != "$actual" ]]; then fail PCIE_INVENTORY_UNSTABLE PCIe "Inventory differs between enumeration and link collection"; fi
}
firmware() {
    local data
    # BMC firmware is collected through the authenticated OOB channel by
    # cycle_engine.py. The OS-side ipmitool mc info path requires /dev/ipmi0,
    # which is absent on this platform and would create a false FAIL.
    collect data BIOS-firmware dmidecode -t bios
}
mode="${1:-all}"
case "$mode" in all|-S|-N|-B|-F) ;; *) echo 'Usage: eq3300_config.sh [-S|-N|-B|-F]'; exit 2;; esac
PCI_VALID=true
if [[ "$mode" != -F ]]; then pci_capture || PCI_VALID=false; fi
if [[ "$mode" != -F && "$PCI_VALID" == true ]]; then
    duplicates=$(printf '%s\n' "$PCI" | awk '/^[[:xdigit:]]{4}:[[:xdigit:]]{2}:[[:xdigit:]]{2}\.[0-7]/ {v=tolower($1); if (++a[v]==2) print v}')
    if [[ -n "$duplicates" ]]; then fail DUPLICATE_BDF PCIe "Duplicate full BDF: ${duplicates//$'\n'/, }"; fi
fi
case "$mode" in
    all) cpu_check; dimm_check; nvme_check; nic_check; gpu_check
         pci_count USB 'USB controller' "$USB_MIN"
         pci_count BMC 'AST1150' "$BMC_MIN"
         link_check; firmware ;;
    -S) dimm_check; nvme_check; nic_check; gpu_check
        pci_count USB 'USB controller' "$USB_MIN"
        pci_count BMC 'AST1150' "$BMC_MIN"
        link_check ;;
    -N) nvme_check; link_check ;;
    -B) link_check ;;
    -F) firmware ;;
esac
if ((FAILURES > 0)); then
    printf '\n[Fail] %s issue(s)\nRESULT|FAIL\n' "$FAILURES"
    exit 1
fi
printf '\n[Pass] All selected checks passed\nRESULT|PASS\n'
