# Dump rows 2003-2202 (item 2001-2200) to /tmp/rows2003_2202.json for the batch11 report generator.
import openpyxl, json
p="data/REVISED_commands_merged_with_raw.xlsx"
wb=openpyxl.load_workbook(p, read_only=True, data_only=True)
ws=wb["Functionality"]
HDR=["Code","Sub Function","Test Set","Items","Procedure","Criteria",
     "Bundle","Branch","Script","Attended Time","Machine Time","Latest Updated",
     "ai_can_execute","ai_packages_needed","ai_commands","ai_logs_output","risk","remark"]
rows=[]
for i,row in enumerate(ws.iter_rows(values_only=True, min_row=2), start=2):
    if not (2003 <= i <= 2202): continue
    rec={"_row": i}
    for k,name in enumerate(HDR):
        rec[name] = row[k] if k < len(row) else None
    rows.append(rec)
wb.close()
json.dump(rows, open('/tmp/rows2003_2202.json','w'), ensure_ascii=False, indent=1)
print("wrote", len(rows), "rows")
