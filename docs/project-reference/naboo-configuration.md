# Historical Naboo configuration reference

Moved from the global User Guide at 4e21a03. These historical planning values were not verified against hardware in this copy review. They are project-specific, not default platform requirements.

```html
<p>以目前描述的 Vera 為例：一台 Server 有四個 Host 節點、四張 BF4，各自一對一；RJ45-1 服務 Host 管理網路，RJ45-2 服務 DPU 管理網路。因此 32 台共 128 個 Host 節點，伺服器實體管理線是 64 條，不是 128 或 512 條。</p>
<section class="ug-sec" id="ug-naboo"><h2>13. Naboo 範例與新專案配置順序</h2>
<p>目前 Naboo 規劃包含 32 台四節點 Server、2 台 Switch、3 台 Power Shelf 與 1 台 CDU，共 38 台設備、128 個 Host 節點、69 條管理接線。這是此專案的配置範例，不是其他專案的固定規格。</p>
<table class="ug-table"><tr><th>交換器</th><th>埠規劃</th></tr><tr><td>Switch-2201-1</td><td>1～32：依序接 32 台 Server 的 Host 管理；33～35：三台 Power Shelf；36：CDU；48：交換器互連。</td></tr><tr><td>Switch-2201-2</td><td>1～32：依序接 32 台 Server 的 DPU 管理；48：交換器互連。</td></tr></table>
<p>依此範例，第一台尚餘 37～47、第二台尚餘 33～47；現場若改接，請更新端點。已確認狀態代表人工紀錄，不是軟體自動證明接線正確。</p>
<p>新專案建議依序完成：設備類型 → 各台 OS Slots → 實際管理 IP → U 高度及位置 → 拓樸匯入 → 節點與埠核對 → 批次接線 → 儲存 → 檢查 IP → Ping Rack。之後新增 CDU 或 Power Shelf，選剩餘埠配對即可，不必為每個專案改程式。</p>
</section>
```
