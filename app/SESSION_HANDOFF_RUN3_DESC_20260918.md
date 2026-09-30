# Session Handoff - Run-3: per-item desc differentiation for legit shared families (2026-09-18)

## What
operator GO 下一 run -> 把 60 個合法共享 row(記憶體/儲存/LED/FIO-mix/margin/GDS…)在 ai_commands 開頭補上各
自 Items 的名稱描述,讓每行一眼可辨。僅 col15 文字,命令本文(共享族、正確)不動。

## Applied (51 + 15 correction)
- 36 rows: memory dmidecode/power-on, storage info/slot, ROCm, RAS ver, SSD-FIO, M.2-FIO, networking
  jumbo/ethernet, margin XGMI/PCIe/Retimer, GDS 註記, FIO-mix ratio tag。
- 13 LED rows + M.2 r76/382:首版未格式化(字面 %s)→ 已改正為各自 <dev> <state> / item。

## Kept identical (intentional)
- NVTOP TBD x5、ErrInjection x2、UMC x2(跨 R/C 同源)、FIO-mix 同 ratio 配對 x8。

## Verify
- diff vs run2_pre = 93 cells all col15;cumul vs closing_pre = 324 (F201/R5/P5/C112/NMF1);build 3112/6;
  mojibake 0;literal %s remnants 0;remaining shared 17/7(intentional)。
- tests.json 3-way md5 58332d99576dae23e207fb7261da1b1f(repo==prod==/tmp)。

## Open
- 同前:5 TBD criteria + HW-00455-V002 merge-key(operator 已裁示放著);prose <id>/<Disk>/<PXE>(當說明保留)。
