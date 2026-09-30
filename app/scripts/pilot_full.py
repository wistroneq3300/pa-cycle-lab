import openpyxl, json
wb=openpyxl.load_workbook("data/REVISED_commands_merged_with_raw.xlsx", read_only=True)
COLS=["Code","Sub Function","Test Set","Items","Procedure","Criteria","ai_can_execute","ai_packages_needed","ai_commands","ai_logs_output","risk","remark"]
pilot=json.load(open("/tmp/pilot_rows.json"))
def full(sn):
    ws=wb[sn]; it=ws.iter_rows(values_only=True); hdr=next(it)
    col={str(h).strip():i for i,h in enumerate(hdr) if h is not None}
    out={}
    for exrow,r in enumerate(it, start=2):
        code=str(r[col["Code"]]).strip() if "Code" in col else None
        if code: out[exrow]={'Code':code,**{h:(str(r[col[h]]).strip() if h in col and r[col[h]] is not None else "") for h in COLS if h!="Code"}}
    return out
res={}
for sn,rows in pilot.items():
    f=full(sn)
    res[sn]=[ {**{k:str(v) for k,v in f[d["excel_row"]].items()}} for d in rows ]
json.dump(res, open("/tmp/pilot_full.json","w"), ensure_ascii=False, indent=1)
for sn in res: print(sn, len(res[sn]))
print("wrote /tmp/pilot_full.json")
