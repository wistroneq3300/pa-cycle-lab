from pathlib import Path
root=Path(__file__).resolve().parents[1]
path=root/'app/main.py';text=path.read_text(encoding='utf-8')
start=text.index('# 開發用：允許本機檔案直接開')
end=text.index('# ---- 儲存',start)
text=text[:start]+'# Same-origin API. Authentication and control boundaries live in integration.web.\n\n'+text[end:]
text=text.replace('def ping_check(ip, timeout=3):','def ping_check(ip, timeout=3):\n    if os.environ.get("CYCLE_MODE", "synthetic") == "synthetic":\n        return False')
text=text.replace('return {"ok": True, "machine": m}', 'return {"ok": True, "machine": {k: ("****" if v else "") if k in {"os_pass", "bmc_pass"} else v for k, v in m.items()}}')
text=text.replace('        projects[new_name] = {\n            "name": new_name,','        projects[new_name] = {\n            **projects[name],\n            "name": new_name,')
path.write_text(text,encoding='utf-8')
