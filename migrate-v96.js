(()=>{
  'use strict';
  const DB_NAME='MaaNoteProdDB', DB_VERSION=7;
  const OLD_TO_NEW={
    '2026-11-02-makuhari':'release-20261102-chiba',
    '2026-11-08-kanazawa':'release-20261108-ishikawa',
    '2026-11-15-kinshicho':'release-20261115-tokyo',
    '2026-11-21-sapporo':'release-20261121-hokkaido',
    '2026-11-23-nagoya':'release-20261123-aichi',
    '2026-11-28-hiroshima':'release-20261128-hiroshima',
    '2026-12-06-hakata':'release-20261206-fukuoka',
    '2026-12-15-ikebukuro':'release-20261215-tokyo',
    '2026-12-19-kobe':'release-20261219-hyogo'
  };
  const STORES=[
    ['userEventPlans','eventId'],['settings','key'],['todos','id'],['personalSchedules','id'],['travelBookings','id'],
    ['setlists','id'],['talkMemos','id'],['commonEvents','id'],['commonOtherItems','id'],['commonMeta','key'],
    ['commonHistory','id'],['adminDrafts','id'],['migrationInfo','id'],['legacyData','id']
  ];
  const el=id=>document.getElementById(id);
  const ui={file:el('migrationFile'),fileStatus:el('fileStatus'),preview:el('previewSection'),summary:el('summaryGrid'),warnings:el('warningBox'),conflicts:el('conflicts'),removeSamples:el('removeSamples'),preferCurrent:el('preferCurrent'),importBtn:el('importBtn'),cancelBtn:el('cancelBtn'),result:el('resultSection'),resultBody:el('resultBody')};
  let db=null, parsed=null, fileText='', fingerprint='', officialEvents=[], currentPlans={}, currentTodos=[], currentTravel=[];

  function openDB(){
    const open=(version)=>new Promise((resolve,reject)=>{const r=version?indexedDB.open(DB_NAME,version):indexedDB.open(DB_NAME);r.onupgradeneeded=()=>{const d=r.result;for(const [n,k] of STORES)if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:k});};r.onblocked=()=>reject(new Error('MaaNoteが別タブで開かれています。MaaNoteを閉じてからもう一度お試しください。'));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    return open(DB_VERSION).catch(err=>{if(err&&err.name==='VersionError')return open();throw err;});
  }
  function getAll(store){return new Promise((resolve,reject)=>{const r=db.transaction(store,'readonly').objectStore(store).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});}
  function put(store,value){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
  function del(store,key){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const str=v=>v==null?'':String(v);
  const now=()=>new Date().toISOString();

  async function sha256(text){
    try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,20);}catch{let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16);}
  }
  function validFormat(data){return data&&data.format==='masaki-trip-v9.6-migration'&&Number(data.schemaVersion)===1&&Array.isArray(data.events)&&Array.isArray(data.todos)&&Array.isArray(data.talkMemos)&&Array.isArray(data.bookingImages);}
  function mapEventId(oldId,rec){
    if(OLD_TO_NEW[oldId])return OLD_TO_NEW[oldId];
    const e=rec?.event||{};const date=e.date||rec?.date||'';const venue=e.venue||rec?.venue||'';
    const hit=officialEvents.find(x=>x.date===date&&(x.venue===venue||(!venue&&x.date===date)));
    return hit?.id||null;
  }
  function eventLabel(newId){const e=officialEvents.find(x=>x.id===newId);return e?`${e.date.slice(5).replace('-','/')} ${e.prefecture} ${e.venue}`:newId;}
  function normalizeRound(v){const s=str(v).trim();if(/^(1|1部|第1部|①)$/.test(s)||s.includes('①'))return 1;if(/^(2|2部|第2部|②)$/.test(s)||s.includes('②'))return 2;if(/^(3|3部|第3部|③)$/.test(s)||s.includes('③'))return 3;return null;}
  function boughtTotal(rec={}){
    const sumPurch=p=>Object.values(p||{}).reduce((s,x)=>s+Math.max(0,num(x?.bought)),0);
    if(rec.cdManageByRound&&Array.isArray(rec.cdByRound)&&rec.cdByRound.length)return rec.cdByRound.reduce((s,r)=>s+sumPurch(r.cdPurchases||r.purchases),0);
    return sumPurch(rec.cdPurchases);
  }
  function priorityParts(rec,newEventId){
    const ev=officialEvents.find(x=>x.id===newEventId);const out={};const archived=[];
    for(const row of (Array.isArray(rec.serialEntries)?rec.serialEntries:[])){
      const n=normalizeRound(row.round), number=str(row.number).trim();
      const part=n?ev?.parts?.[n-1]:null;
      if(part&&/^\d+$/.test(number))out[part.id]={...(out[part.id]||{}),priorityNumber:Number(number)};else archived.push(row);
    }
    return {parts:out,archived};
  }
  function splitDateTime(v){
    const s=str(v).trim(); if(!s)return {date:null,time:null};
    if(s.includes('T')){const [d,t]=s.split('T');return {date:d||null,time:(t||'').slice(0,5)||null};}
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return {date:s,time:null};
    return {date:null,time:null};
  }
  function imageMap(){return new Map((parsed.bookingImages||[]).map(x=>[x.id,x]));}
  function convertTravel(oldEventId,rec,newEventId){
    const images=imageMap(); const out=[]; const usedImages=new Set();
    (Array.isArray(rec.bookings)?rec.bookings:[]).forEach((b,i)=>{
      const sd=splitDateTime(b.start), ed=splitDateTime(b.end); const type=b.type||'other';
      const imgId=b.imageId||b.id||''; const oldImg=images.get(imgId); const imgRows=[];
      if(oldImg?.dataUrl){usedImages.add(imgId);imgRows.push({id:`legacy-v96-image-${imgId}`,name:'旧アプリ予約画像',createdAt:oldImg.updatedAt||parsed.exportedAt||now(),dataUrl:oldImg.dataUrl});}
      const bid=str(b.id||`row-${i}`);
      out.push({
        id:`legacy-v96-travel-${oldEventId}-${bid}`,eventId:newEventId,type,direction:type==='hotel'?'stay':(['train','flight','bus','car'].includes(type)?(b.direction==='return'?'return':'outbound'):'none'),
        title:b.title||'',date:sd.date,startTime:sd.time,endDate:ed.date,endTime:ed.time,from:b.from||null,to:b.to||null,seat:b.seat||null,
        bookingSite:null,bookingCode:b.code||null,reservedOn:b.reservedOn||null,partySize:null,cost:b.cost==null?null:num(b.cost),
        paymentStatus:b.paymentPending?'unpaid':(b.paymentCompletedOn?'paid':'unset'),bookingStatus:b.cancelCompletedOn?'cancelled':'confirmed',paymentDue:b.paymentDue||null,
        freeCancelUntil:b.freeCancelUntil||null,url:b.url||null,notes:b.notes||null,images:imgRows,legacySource:{app:'v9.6',oldEventId,oldBookingId:bid},
        createdAt:rec.updatedAt||parsed.exportedAt||now(),updatedAt:rec.updatedAt||parsed.exportedAt||now(),revision:1,deleted:false
      });
    });
    return {rows:out,usedImages};
  }
  function convertTodo(t){return {id:`legacy-v96-todo-${t.id}`,title:t.title||'',eventId:mapEventId(t.eventId,{event:{id:t.eventId}}),dueDate:t.deadline||null,dueTime:null,memo:null,completed:!!t.completed,completedAt:t.completed? (t.updatedAt||null):null,showOnCalendar:true,createdBy:'migrated',sortOrder:Date.parse(t.createdAt||'')||Date.now(),createdAt:t.createdAt||parsed.exportedAt||now(),updatedAt:t.updatedAt||parsed.exportedAt||now(),revision:1,deleted:false,legacySource:{app:'v9.6',oldId:t.id,sourceRole:t.sourceRole||null,sourceBookingId:t.sourceBookingId||null}};}
  function exactSamplePlan(p){
    if(!p||Number(p.revision)!==1)return false;
    if(p.eventId==='release-20261108-ishikawa')return p.participationStatus==='maybe'&&p.cdQuantity==null&&Object.keys(p.parts||{}).length===0;
    if(p.eventId==='release-20261115-tokyo')return p.participationStatus==='confirmed'&&Number(p.cdQuantity)===8&&Number(p.parts?.p1?.talkTicketQuantity)===3&&Number(p.parts?.p1?.priorityNumber)===108&&Number(p.parts?.p2?.talkTicketQuantity)===4&&Number(p.parts?.p2?.priorityNumber)===53;
    return false;
  }
  function incomingPlans(){
    const rows=[];
    for(const e of parsed.events){const rec=e.data||{};const newId=mapEventId(e.id,rec);if(!newId)continue;const cd=boughtTotal(rec);const pp=priorityParts(rec,newId);rows.push({oldId:e.id,newId,plan:{eventId:newId,participationStatus:rec.attending===true?'confirmed':'unset',cdQuantity:cd>0?cd:null,parts:pp.parts},priorityArchived:pp.archived,rec});}
    return rows;
  }
  function counts(){
    const plans=incomingPlans();let travel=0,imgs=0,cdEvents=0,confirmed=0,mappedPriority=0;
    for(const p of plans){if(p.plan.participationStatus==='confirmed')confirmed++;if(p.plan.cdQuantity!=null)cdEvents++;mappedPriority+=Object.values(p.plan.parts||{}).filter(x=>x.priorityNumber!=null).length;const c=convertTravel(p.oldId,p.rec,p.newId);travel+=c.rows.length;imgs+=c.rows.reduce((s,x)=>s+(x.images?.length||0),0);}
    return {eventRecords:plans.length,confirmed,cdEvents,travel,imgs,todos:(parsed.todos||[]).length,talk:(parsed.talkMemos||[]).length,mappedPriority};
  }

  async function loadCurrent(){currentPlans=Object.fromEntries((await getAll('userEventPlans')).map(x=>[x.eventId,x]));currentTodos=await getAll('todos');currentTravel=await getAll('travelBookings');}
  function planHasUserData(p){if(!p||p.deleted)return false;return p.participationStatus!=='unset'||p.cdQuantity!=null||Object.keys(p.parts||{}).length>0;}
  function renderPreview(){
    const c=counts();ui.summary.innerHTML=[['イベント',c.eventRecords],['参加確定',c.confirmed],['CD入力あり',c.cdEvents],['旅程',c.travel],['予約画像',c.imgs],['TODO',c.todos],['旧トークメモ',c.talk],['優先番号',c.mappedPriority]].map(([l,n])=>`<div class="summary"><b>${n}</b><span>${l}</span></div>`).join('');
    const plans=incomingPlans();const unmapped=(parsed.events||[]).filter(e=>!mapEventId(e.id,e.data||{}));const archivedTalk=(parsed.talkMemos||[]).length;
    let warnings=[];if(unmapped.length)warnings.push(`${unmapped.length}件のイベントはMaaNote側イベントと対応付けできないため、旧データ保管領域だけに残します。`);if(archivedTalk)warnings.push(`旧v9.6のトークメモはイベントとの紐付け情報がないため、${archivedTalk}件を旧データ保管領域へ残します。`);warnings.push('CDは「購入確定（bought）」だけを合計し、購入予定はCD枚数へ加算しません。元の形態別データは旧データ保管領域に残します。');
    ui.warnings.innerHTML=warnings.map(x=>`<div class="warning">${esc(x)}</div>`).join('');
    const conflicts=plans.filter(x=>{const cur=currentPlans[x.newId];return planHasUserData(cur)&&!exactSamplePlan(cur);});
    ui.conflicts.innerHTML=conflicts.length?`<h3 style="font-size:15px;margin:14px 0 6px">イベント情報の競合 ${conflicts.length}件</h3>`+conflicts.map(x=>`<div class="conflict"><strong>${esc(eventLabel(x.newId))}</strong><small>MaaNote側にも個人入力があります。</small><select data-conflict-event="${esc(x.newId)}"><option value="keep" selected>MaaNoteの現在値を残す</option><option value="merge">空欄だけv9.6から補う</option><option value="old">v9.6の値を使う</option></select></div>`).join(''):'';
    ui.preview.classList.remove('hidden');
  }
  function reset(){parsed=null;fileText='';fingerprint='';ui.file.value='';ui.fileStatus.textContent='まだファイルは選択されていません。';ui.fileStatus.className='status muted';ui.preview.classList.add('hidden');ui.result.classList.add('hidden');}
  function conflictStrategy(eventId){const s=document.querySelector(`[data-conflict-event="${CSS.escape(eventId)}"]`);return s?.value||(ui.preferCurrent.checked?'keep':'old');}
  function mergePlan(current,incoming,strategy){
    if(!current||current.deleted||exactSamplePlan(current))return {...incoming};
    if(strategy==='keep')return current;
    if(strategy==='old')return {...current,...incoming,parts:incoming.parts||{}};
    const parts={...(current.parts||{})};for(const [k,v] of Object.entries(incoming.parts||{})){parts[k]={...(v||{}),...(parts[k]||{})};if(parts[k].priorityNumber==null&&v?.priorityNumber!=null)parts[k].priorityNumber=v.priorityNumber;}
    return {...current,participationStatus:current.participationStatus&&current.participationStatus!=='unset'?current.participationStatus:incoming.participationStatus,cdQuantity:current.cdQuantity!=null?current.cdQuantity:incoming.cdQuantity,parts};
  }
  async function removeStageSamples(){
    for(const id of ['todo-hotel-20261110','todo-battery-20261114','todo-friend-20261115','todo-example-done'])await del('todos',id);
    await del('personalSchedules','schedule-meet-20261115');
    for(const id of ['travel-sample-outbound-20261115','travel-sample-hotel-20261115'])await del('travelBookings',id);
    for(const id of ['release-20261115-tokyo','release-20261108-ishikawa']){const p=currentPlans[id];if(exactSamplePlan(p))await del('userEventPlans',id);}
  }
  async function doImport(){
    ui.importBtn.disabled=true;ui.importBtn.textContent='取り込み中…';
    try{
      if(ui.removeSamples.checked)await removeStageSamples();
      await loadCurrent();
      const pRows=incomingPlans();let plansWritten=0,travelWritten=0,todosWritten=0,imagesWritten=0;const archiveEvents=[];const usedImages=new Set();
      for(const x of pRows){
        const current=currentPlans[x.newId];const strategy=conflictStrategy(x.newId);const base=mergePlan(current,x.plan,strategy);
        if(base!==current||exactSamplePlan(current)||!current){const t=now();const row={eventId:x.newId,participationStatus:base.participationStatus||'unset',cdQuantity:base.cdQuantity??null,parts:base.parts||{},createdAt:current?.createdAt||t,updatedAt:t,revision:(current?.revision||0)+1,deleted:false,legacySource:{app:'v9.6',oldEventId:x.oldId}};await put('userEventPlans',row);currentPlans[x.newId]=row;plansWritten++;}
        const conv=convertTravel(x.oldId,x.rec,x.newId);conv.usedImages.forEach(v=>usedImages.add(v));
        for(const row of conv.rows){const exists=currentTravel.find(z=>z.id===row.id);if(exists&&ui.preferCurrent.checked)continue;await put('travelBookings',{...row,revision:(exists?.revision||0)+1,createdAt:exists?.createdAt||row.createdAt,updatedAt:now()});travelWritten++;imagesWritten+=(row.images||[]).length;}
        archiveEvents.push({oldEventId:x.oldId,newEventId:x.newId,notes:x.rec.notes||null,cdPurchases:x.rec.cdPurchases||{},cdManageByRound:!!x.rec.cdManageByRound,cdByRound:x.rec.cdByRound||[],purchaseRounds:x.rec.purchaseRounds||'',serialEntries:x.rec.serialEntries||[],unmappedSerialEntries:x.priorityArchived,venueDetailUrl:x.rec.venueDetailUrl||null,officialUrl:x.rec.officialUrl||null,oldUpdatedAt:x.rec.updatedAt||null});
      }
      const unmatched=(parsed.events||[]).filter(e=>!mapEventId(e.id,e.data||{}));
      const existingTodos=new Map((await getAll('todos')).map(x=>[x.id,x]));
      for(const t of (parsed.todos||[])){const row=convertTodo(t);const exists=existingTodos.get(row.id);if(exists&&ui.preferCurrent.checked)continue;await put('todos',{...row,createdAt:exists?.createdAt||row.createdAt,updatedAt:now(),revision:(exists?.revision||0)+1});todosWritten++;}
      const orphanImages=(parsed.bookingImages||[]).filter(x=>!usedImages.has(x.id));
      const archiveId=`v96-archive-${fingerprint}`;
      await put('legacyData',{id:archiveId,sourceFormat:parsed.format,sourceAppVersion:parsed.appVersion||'9.6',sourceExportedAt:parsed.exportedAt||null,sourceFingerprint:fingerprint,importedAt:now(),eventExtras:archiveEvents,unmatchedEvents:unmatched,oldTalkMemos:parsed.talkMemos||[],oldPreferences:parsed.preferences||{},orphanBookingImages:orphanImages,notes:'MaaNoteで直接表現できないv9.6データを保持する退避領域。'});
      const info={id:`v96-${fingerprint}`,sourceFingerprint:fingerprint,sourceExportedAt:parsed.exportedAt||null,importedAt:now(),sourceAppVersion:parsed.appVersion||'9.6',counts:{plansWritten,travelWritten,todosWritten,imagesWritten,archivedTalkMemos:(parsed.talkMemos||[]).length,archivedUnmatchedEvents:unmatched.length}};
      await put('migrationInfo',info);
      try{localStorage.setItem('MaaNoteProdDriveDirtyV1',new Date().toISOString())}catch(_){}
      ui.preview.classList.add('hidden');ui.result.classList.remove('hidden');ui.resultBody.innerHTML=`<div class="status success">移行が完了しました。同じファイルを再度取り込んでも、固定IDを使うため重複しにくい設計です。</div><div class="result-list"><div class="result-line"><span>イベント個人情報</span><b>${plansWritten}件</b></div><div class="result-line"><span>旅程</span><b>${travelWritten}件</b></div><div class="result-line"><span>予約画像</span><b>${imagesWritten}枚</b></div><div class="result-line"><span>TODO</span><b>${todosWritten}件</b></div><div class="result-line"><span>旧データ保管</span><b>${(parsed.talkMemos||[]).length}トークメモ</b></div></div><div class="warning">旧アプリの <b>attending=false</b> は「不参加」ではなく「未設定」として移行しています。旧トークメモや形態別CD情報など、MaaNoteに直接対応しない情報は削除せず旧データ保管領域に残しています。</div>`;
      window.scrollTo({top:0,behavior:'smooth'});
    }catch(err){console.error(err);ui.fileStatus.textContent=`取り込みに失敗しました：${err?.message||err}`;ui.fileStatus.className='status error';}
    finally{ui.importBtn.disabled=false;ui.importBtn.textContent='この内容で取り込む';}
  }

  ui.file.addEventListener('change',async()=>{
    const f=ui.file.files?.[0];if(!f)return;
    try{ui.fileStatus.textContent='読み込み中…';ui.fileStatus.className='status muted';fileText=await f.text();const data=JSON.parse(fileText);if(!validFormat(data))throw new Error('MaaNote用のv9.6移行ファイルではありません。旧アプリの移行ページから書き出したJSONを選んでください。');parsed=data;fingerprint=await sha256(fileText);await loadCurrent();ui.fileStatus.textContent=`${f.name} を読み込みました。保存前に下の内容を確認してください。`;ui.fileStatus.className='status success';renderPreview();}catch(err){parsed=null;ui.preview.classList.add('hidden');ui.fileStatus.textContent=err?.message||'ファイルを読み込めませんでした。';ui.fileStatus.className='status error';}
  });
  ui.cancelBtn.addEventListener('click',reset);
  ui.preferCurrent.addEventListener('change',()=>{document.querySelectorAll('[data-conflict-event]').forEach(s=>s.value=ui.preferCurrent.checked?'keep':'old');});
  ui.importBtn.addEventListener('click',()=>{if(parsed&&confirm('表示されている内容をこの端末のMaaNoteへ取り込みます。よろしいですか？'))doImport();});

  (async()=>{
    try{db=await openDB();try{const r=await fetch('./common-seed.json',{cache:'no-store'});const d=await r.json();officialEvents=d.events||[];}catch{officialEvents=[];}await loadCurrent();}
    catch(err){ui.fileStatus.textContent=`移行データベースを開けません：${err?.message||err}`;ui.fileStatus.className='status error';ui.file.disabled=true;}
  })();
})();
