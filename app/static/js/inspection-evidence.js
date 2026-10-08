/* Read-only, bounded evidence viewer. Native dialog owns focus/inert background. */
(() => {
  let current;
  function close(){if(!current)return;const {dialog,abort,restore,issueId}=current;current=null;abort.abort();dialog.close();dialog.remove();if(restore?.isConnected)restore.focus();else if(issueId){const card=document.querySelector('[data-issue-id="'+CSS.escape(issueId)+'"]');card?.querySelector('[data-evidence-open]')?.focus();}}
function formatEvidence(text){
    // Raw evidence can be one giant single-line JSON blob (e.g. the Redfish
    // transcript: [{path,code,body},...]). Pretty-print valid JSON so it is
    // readable and vertically scrollable instead of one endless horizontal
    // line. Non-JSON (or JSON truncated mid-record) is returned unchanged; CSS
    // handles wrapping so nothing ever runs off horizontally.
    const trimmed=String(text||'').trim();
    if(!trimmed||(trimmed[0]!=='['&&trimmed[0]!=='{'))return text;
    try{return JSON.stringify(JSON.parse(trimmed),null,2);}catch{/* fall through */}
    if(trimmed[0]==='['){
      // Tolerate a 256 KB cut inside the array: pretty-print each complete
      // top-level object and drop the trailing partial one.
      const parts=trimmed.slice(1).split(/\},\s*\{/);
      const pretty=[];
      for(const part of parts){
        const chunk=part.replace(/^\{?/,'{').replace(/\}?$/,'}');
        try{pretty.push(JSON.stringify(JSON.parse(chunk),null,2));}catch{break;}
      }
      if(pretty.length)return pretty.join(',\n');
    }
    return text;
  }
  async function open(base,id,label=''){
    close();const dialog=document.createElement('dialog');dialog.className='pa-evidence-modal';dialog.setAttribute('aria-label','原始證據');dialog.setAttribute('aria-modal','true');
    dialog.innerHTML='<header><div><h2>原始證據</h2><p data-context></p></div><button class="btn" data-close>關閉</button></header><div class="pe-tools"><label>搜尋本次載入內容 <input type="search" placeholder="輸入關鍵字" disabled></label><button class="btn" data-next disabled>下一筆</button><span data-match role="status"></span></div><p data-status role="status" aria-live="polite">載入中…</p><pre tabindex="0" aria-label="唯讀原始證據"></pre><footer><span data-source>唯讀 · 正在載入預覽</span><button class="btn" data-copy disabled>複製載入預覽</button><a class="btn" data-download>下載完整證據</a></footer>';
    const ctx={dialog,abort:new AbortController(),restore:document.activeElement,issueId:document.activeElement?.closest('[data-issue-id]')?.dataset.issueId,text:'',position:-1,loadState:'loading'};current=ctx;
    document.body.append(dialog);dialog.querySelector('[data-context]').textContent=label;dialog.showModal();dialog.querySelector('[data-close]').focus();
    dialog.querySelector('[data-close]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
    dialog.onkeydown=e=>{if(e.key!=='Tab')return;const elements=[...dialog.querySelectorAll('button,a[href],input,[tabindex="0"]')];const first=elements[0],last=elements.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}};
    dialog.querySelector('[data-download]').href=base+'/evidence/'+encodeURIComponent(id)+'?raw=true';
    dialog.querySelector('[data-copy]').onclick=async()=>{if(ctx.loadState!=='loaded')return;try{await navigator.clipboard.writeText(ctx.text);dialog.querySelector('[data-status]').textContent='已複製本次載入的預覽內容。';dialog.querySelector('[data-status]').dataset.state='success';}catch(e){dialog.querySelector('[data-status]').textContent='剪貼簿寫入失敗；預覽仍保留，請手動選取或下載。';dialog.querySelector('[data-status]').dataset.state='error';}};
    const search=()=>{const input=dialog.querySelector('input'),query=input.value.toLocaleLowerCase(),pre=dialog.querySelector('pre'),match=dialog.querySelector('[data-match]');if(!query){ctx.position=-1;match.textContent='';getSelection()?.removeAllRanges();return;}let index=ctx.text.toLocaleLowerCase().indexOf(query,ctx.position+1);if(index<0)index=ctx.text.toLocaleLowerCase().indexOf(query);ctx.position=index;match.textContent=index<0?'找不到符合內容':'已定位符合內容';if(index>=0&&pre.firstChild){const range=document.createRange();range.setStart(pre.firstChild,index);range.setEnd(pre.firstChild,index+query.length);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);const rect=range.getBoundingClientRect();pre.scrollTop+=rect.top-pre.getBoundingClientRect().top-pre.clientHeight/3;}};
    dialog.querySelector('input').oninput=()=>{ctx.position=-1;search();};dialog.querySelector('[data-next]').onclick=search;
    try{const response=await fetch(base+'/evidence/'+encodeURIComponent(id)+'/view',{signal:ctx.abort.signal});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||data.error||('證據暫時無法取得（HTTP '+response.status+'）。'));if(current!==ctx)return;ctx.text=formatEvidence(data.text??'');ctx.loadState=ctx.text?'loaded':'empty';dialog.querySelector('pre').textContent=ctx.text;const status=dialog.querySelector('[data-status]');status.dataset.state=ctx.loadState;status.textContent=ctx.loadState==='empty'?'文件為空 · 載入完成 · 唯讀':data.truncated?'預覽已載入：目前顯示前 256 KB；完整內容可下載。':'完整內容已載入 · 唯讀';dialog.querySelector('[data-source]').textContent=[data.source||'來源未提供',data.collected_at?new Date(data.collected_at*1000).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})+' UTC+8':'採集時間未提供',data.truncated?'預覽已截斷':'已載入全文','唯讀'].join(' · ');const hasText=ctx.loadState==='loaded';dialog.querySelector('[data-copy]').disabled=!hasText;dialog.querySelector('input').disabled=!hasText;dialog.querySelector('[data-next]').disabled=!hasText;}catch(e){if(e.name!=='AbortError'&&current===ctx){ctx.loadState='error';const status=dialog.querySelector('[data-status]');status.dataset.state='error';status.textContent=e.message;dialog.querySelector('[data-source]').textContent='預覽未載入 · 原因已保留';}}
  }
  window.InspectionEvidence={open,close};
})();
