import openpyxl, re, json
wb=openpyxl.load_workbook("data/REVISED_commands_merged_with_raw.xlsx", read_only=True)
COLS=["Code","Test Set","Sub Function","Items","Procedure","Criteria","ai_can_execute","ai_commands","ai_logs_output","risk","ai_packages_needed"]

def rows_of(sn):
    ws=wb[sn]; it=ws.iter_rows(values_only=True); hdr=next(it)
    col={str(h).strip():i for i,h in enumerate(hdr) if h is not None}
    out=[]
    for exrow,r in enumerate(it, start=2):
        d={h:(r[col[h]] if h in col and r[col[h]] is not None else "") for h in COLS}
        d["excel_row"]=exrow
        for k in list(d):
            if k!="excel_row": d[k]=str(d[k]).strip()
        if d.get("Code"): out.append(d)
    return out

FAMS={
    "SMBIOS-read":   re.compile(r"dmidecode|smbios|type \d+", re.I),
    "fio/stress":    re.compile(r"fio\b|stress-ng|stressapptest|dd of=|dd if=|ib_write_bw|iperf", re.I),
    "BMC-flash":     re.compile(r"UpdateService|firmware|flash|BMC FW|recovery", re.I),
    "LED/fan":       re.compile(r"led|fan duty|psel|chassis status|locate", re.I),
    "ipmitool-OOB":  re.compile(r"-I lanplus|ipmitool", re.I),
    "ssh-DUT":       re.compile(r"sshpass|ssh .+\$DUT_IP", re.I),
}
def fams_of(d):
    txt=" ".join([d.get("Items",""),d.get("Procedure",""),d.get("ai_commands",""),d.get("Test Set","")])
    return [k for k,rx in FAMS.items() if rx.search(txt)]

def stratified(rows, n):
    by={}
    for st in ("YES","PARTIAL","NO"):
        by[st]=[r for r in rows if r["ai_can_execute"]==st]
    total=len(rows)
    if total==0: return []
    present=[st for st in ("YES","PARTIAL","NO") if by[st]]
    alloc={st:max(1,round(n*len(by[st])/total)) for st in present}
    # converge to exactly n: shrink big ones, then grow big ones (cap at pool size)
    guard=0
    while sum(alloc.values())!=n and guard<1000:
        guard+=1
        if sum(alloc.values())>n:
            st=max(alloc,key=lambda s:alloc[s])
            if alloc[st]>1: alloc[st]-=1
            else:
                # can't shrink below 1, drop smallest present state
                st=max(alloc,key=lambda s:alloc[s]); del alloc[st]
                if not present: break
        else:
            st=max(by,key=lambda s:alloc.get(s,0))
            room=len(by[st])-alloc.get(st,0)
            if room<=0: continue
            alloc[st]=alloc.get(st,0)+1
    present=[st for st in ("YES","PARTIAL","NO") if by[st]]
    picked=[]
    for st in ("YES","PARTIAL","NO"):
        if by.get(st) and st in alloc:
            step=max(1,len(by[st])//alloc[st])
            picked += [by[st][i] for i in range(0,len(by[st]),step)][:alloc[st]]
    return picked[:n]

allpilot={}
for sn in ["Functionality","Compatibility","Reliability","Stability","Performance","(No Main Function)"]:
    rows=rows_of(sn)
    sel=stratified(rows,10)
    allpilot[sn]=sel
    famseen=set()
    for d in sel:
        for f in fams_of(d): famseen.add(f)
    print("== %s (%d rows) -> %d picked; families covered: %s" % (sn, len(rows), len(sel), ",".join(sorted(famseen))))
    for d in sel:
        cmd=d["ai_commands"].replace("\n"," ")[:80]
        print("   %5d | %-8s | %-30s | %-28s | %s" % (d["excel_row"], d["ai_can_execute"], (d["Test Set"] or "")[:30], (d["Code"] or "")[:28], cmd))
json.dump(allpilot, open("/tmp/pilot_rows.json","w"), ensure_ascii=False, indent=1)
print("\nwrote /tmp/pilot_rows.json")
