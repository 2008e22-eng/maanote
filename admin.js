(() => {
  'use strict';
  const DB='MaaNoteProdAdminDB', LEGACY_DB='MaaNoteProdDB', DB_VERSION=7, APP_VERSION='0.9-stage14-prod', EMERGENCY_COMMON_KEY='MaaNoteProdAdminEmergencyCommonV1', ROOT_PREFIX=location.pathname.includes('/admin/')?'../':'./';
  const app=document.getElementById('adminApp'), sheet=document.getElementById('adminSheet'), toast=document.getElementById('adminToast');
  const CONFIG=globalThis.MAANOTE_CONFIG||{};
  const API_BASE=String(CONFIG.API_BASE||'').replace(/\/$/,'');
  const SECURE_ADMIN=!!(CONFIG.ADMIN_AUTH_ENABLED && API_BASE && CONFIG.GOOGLE_CLIENT_ID);
  const state={db:null,tab:'release',events:[],other:[],history:[],drafts:[],meta:{version:0},draftTimer:null,backupTimer:null,backupSuspended:false,recovered:false,auth:{token:null,user:null,role:null},admins:[]};
  const SHARED_LOCAL_COMMON_KEY='MaaNoteProdSharedCommonPreviewV1';
  const CATEGORIES={live:'LIVE',fc:'FC EVENT',radio:'RADIO',limista:'LIMISTA',tv_web:'TV・WEB',release:'RELEASE',other:'OTHER'};

  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const attr=h;
  const uid=(p='id')=>globalThis.crypto?.randomUUID?`${p}-${crypto.randomUUID()}`:`${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const now=()=>new Date().toISOString();
  const jpDate=s=>{if(!s)return '日付未発表';const [y,m,d]=s.split('-').map(Number);const x=new Date(y,m-1,d);return `${y}/${m}/${d}(${['日','月','火','水','木','金','土'][x.getDay()]})`};

  function openDB(){const stores=[['userEventPlans','eventId'],['settings','key'],['todos','id'],['personalSchedules','id'],['travelBookings','id'],['setlists','id'],['talkMemos','id'],['commonEvents','id'],['commonOtherItems','id'],['commonMeta','key'],['commonHistory','id'],['adminDrafts','id'],['migrationInfo','id'],['legacyData','id']];const open=v=>new Promise((resolve,reject)=>{const r=v?indexedDB.open(DB,v):indexedDB.open(DB);r.onupgradeneeded=()=>{const d=r.result;stores.forEach(([n,k])=>{if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:k})})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return open(DB_VERSION).catch(e=>e&&e.name==='VersionError'?open():Promise.reject(e))}
  function all(store){return new Promise((resolve,reject)=>{const r=state.db.transaction(store,'readonly').objectStore(store).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
  function scheduleAdminBackup(){if(state.backupSuspended||!state.db)return;clearTimeout(state.backupTimer);state.backupTimer=setTimeout(writeAdminEmergencyBackup,400)}
  async function writeAdminEmergencyBackup(){if(state.backupSuspended||!state.db)return;try{const stores={};for(const n of ['commonEvents','commonOtherItems','commonMeta','commonHistory','adminDrafts'])stores[n]=await all(n);localStorage.setItem(EMERGENCY_COMMON_KEY,JSON.stringify({format:'MaaNote-emergency-backup',version:1,scope:'common',appVersion:APP_VERSION,updatedAt:now(),stores}))}catch(e){console.warn('admin emergency backup failed',e)}}
  async function recoverAdminEmergencyBackup(){let data=null;try{data=JSON.parse(localStorage.getItem(EMERGENCY_COMMON_KEY)||'null')}catch(e){}if(!data?.stores||data.format!=='MaaNote-emergency-backup')return false;const names=['commonEvents','commonOtherItems','commonMeta','commonHistory','adminDrafts'];let restored=false;state.backupSuspended=true;try{for(const n of names){const current=await all(n);const backup=data.stores[n]||[];if(!current.length&&backup.length){for(const row of backup)await put(n,structuredClone(row),true);restored=true}}state.recovered=restored;return restored}finally{state.backupSuspended=false}}
  function put(store,v,skipBackup=false){return new Promise((resolve,reject)=>{const tx=state.db.transaction(store,'readwrite');tx.objectStore(store).put(v);tx.oncomplete=()=>{if(!skipBackup)scheduleAdminBackup();resolve()};tx.onerror=()=>reject(tx.error)})}
  function del(store,key){return new Promise((resolve,reject)=>{const tx=state.db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>{scheduleAdminBackup();resolve()};tx.onerror=()=>reject(tx.error)})}

  async function migrateLegacyAdminDataIfNeeded(){
    if((await all('commonEvents')).length) return false;
    let legacyDb=null;
    try{
      legacyDb=await new Promise((resolve,reject)=>{
        const r=indexedDB.open(LEGACY_DB);
        r.onsuccess=()=>resolve(r.result);
        r.onerror=()=>reject(r.error);
        r.onupgradeneeded=()=>{try{r.transaction.abort()}catch(_){};reject(new Error('legacy DB unavailable'))};
      });
    }catch(_){return false}

    const names=['commonEvents','commonOtherItems','commonMeta','commonHistory','adminDrafts'];
    let copied=false;
    try{
      for(const name of names){
        if(!legacyDb.objectStoreNames.contains(name)) continue;
        const rows=await new Promise((resolve,reject)=>{
          const r=legacyDb.transaction(name,'readonly').objectStore(name).getAll();
          r.onsuccess=()=>resolve(r.result||[]);
          r.onerror=()=>reject(r.error);
        });
        for(const row of rows){await put(name,structuredClone(row),true);copied=true}
      }
    }finally{legacyDb.close()}
    if(copied)scheduleAdminBackup();
    return copied;
  }

  async function load(){
    await migrateLegacyAdminDataIfNeeded();
    let events=await all('commonEvents');
    let other=await all('commonOtherItems');
    if(!events.length){
      try{
        let seed=null;try{seed=await (await fetch(`${ROOT_PREFIX}common-data.json?t=${Date.now()}`,{cache:'no-store'})).json()}catch(_){};if(!seed?.events)seed=await (await fetch(`${ROOT_PREFIX}common-seed.json`)).json();
        for(const row of seed.events||[]) await put('commonEvents',row);
        for(const row of seed.otherItems||[]) await put('commonOtherItems',row);
        events=await all('commonEvents'); other=await all('commonOtherItems');
        if(!(await all('commonMeta')).some(x=>x.key==='publish')) await put('commonMeta',{key:'publish',version:1,updatedAt:'2026-09-24T12:00:00+09:00',summary:'3rdシングル発売記念イベント一覧が公開されました'});
      }catch(e){ console.warn('seed load failed',e); }
    }
    state.events=events.sort((a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999')));
    state.other=other.sort((a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999')));
    state.history=(await all('commonHistory')).sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
    state.drafts=(await all('adminDrafts')).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    const m=(await all('commonMeta')).find(x=>x.key==='publish'); state.meta=m||{version:0};
  }


  function publishLocalPreview(){
    if(SECURE_ADMIN) return;
    const payload={
      format:'MaaNote-common-data',
      version:1,
      publishMeta:state.meta,
      events:state.events,
      otherItems:state.other,
      history:state.history,
      exportedAt:now()
    };
    try{
      localStorage.setItem(SHARED_LOCAL_COMMON_KEY,JSON.stringify(payload));
      try{new BroadcastChannel('maanote-common').postMessage({type:'common-updated',version:Number(state.meta?.version||0)})}catch(_){}
    }catch(e){
      console.warn('shared local preview save failed',e);
    }
  }

  function authHeaders(extra={}){return {...extra,...(state.auth.token?{Authorization:`Bearer ${state.auth.token}`}:{})}}
  async function api(path,options={}){
    if(!API_BASE) throw new Error('API未設定');
    const headers=authHeaders(options.headers||{});
    const init={...options,headers};
    if(init.body && typeof init.body!=='string'){
      init.body=JSON.stringify(init.body);
      headers['Content-Type']='application/json';
    }
    const res=await fetch(`${API_BASE}${path}`,init);
    const data=await res.json().catch(()=>({}));
    if(!res.ok){
      const err=new Error(data.error||`API ${res.status}`);
      err.status=res.status;
      err.data=data;
      throw err;
    }
    return data;
  }

  function renderAuthGate(message=''){
    app.innerHTML=`<main class="shell"><header class="top"><div><div class="brand">MaaNote Admin</div><div class="sub">管理者用 · Stage 14 PROD</div></div></header>
      <div class="auth-card">
        <div class="auth-title">管理者ログイン</div>
        <div class="auth-copy">Googleアカウントでログインしてください。登録済みのオーナー／管理者だけが編集・公開できます。</div>
        ${message?`<div class="auth-error">${h(message)}</div>`:''}
        <div id="googleSignInButton" class="google-signin"></div>
        <div class="auth-help">管理者の追加・停止はオーナーだけが行えます。</div>
      </div></main>`;
  }

  function initGoogleLogin(){
    if(!SECURE_ADMIN) return;
    renderAuthGate();
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(globalThis.google?.accounts?.id){
        clearInterval(timer);
        google.accounts.id.initialize({
          client_id:CONFIG.GOOGLE_CLIENT_ID,
          callback:async response=>{
            try{
              state.auth.token=response.credential;
              const me=await api('/api/me');
              state.auth.user=me.user;
              state.auth.role=me.role;
              await syncRemoteCommonDataForAdmin();
              await load();
              render();
            }catch(e){
              console.error(e);
              state.auth={token:null,user:null,role:null};
              renderAuthGate(e.status===403?'このGoogleアカウントには管理者権限がありません。':'ログインを確認できませんでした。');
              setTimeout(initGoogleLogin,50);
            }
          }
        });
        google.accounts.id.renderButton(document.getElementById('googleSignInButton'),{
          theme:'outline',size:'large',shape:'pill',text:'signin_with',width:280
        });
      }else if(tries>80){
        clearInterval(timer);
        renderAuthGate('Googleログインを読み込めませんでした。通信状態を確認してください。');
      }
    },100);
  }

  function logoutAdmin(){
    state.auth={token:null,user:null,role:null};
    state.admins=[];
    try{globalThis.google?.accounts?.id?.disableAutoSelect()}catch(_){}
    initGoogleLogin();
  }

  async function clearStore(store){
    return new Promise((resolve,reject)=>{
      const tx=state.db.transaction(store,'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
    });
  }

  async function applyRemoteCommonData(payload){
    if(!payload?.events || !payload?.otherItems) return;
    state.backupSuspended=true;
    try{
      for(const store of ['commonEvents','commonOtherItems','commonMeta','commonHistory']) await clearStore(store);
      for(const row of payload.events||[]) await put('commonEvents',structuredClone(row),true);
      for(const row of payload.otherItems||[]) await put('commonOtherItems',structuredClone(row),true);
      if(payload.publishMeta) await put('commonMeta',{key:'publish',...structuredClone(payload.publishMeta)},true);
      for(const row of payload.history||[]) await put('commonHistory',structuredClone(row),true);
    }finally{
      state.backupSuspended=false;
      scheduleAdminBackup();
    }
  }

  async function syncRemoteCommonDataForAdmin(){
    if(!SECURE_ADMIN) return false;
    try{
      const payload=await api('/api/common-data');
      if(payload?.publishMeta?.version>=0){
        await applyRemoteCommonData(payload);
        return true;
      }
    }catch(e){
      if(e.status!==404) console.warn('admin common-data sync failed',e);
    }
    return false;
  }

  async function publishToApi({summary,events,otherItems}){
    const result=await api('/api/publish',{
      method:'POST',
      body:{baseVersion:Number(state.meta.version||0),summary,events,otherItems}
    });
    await applyRemoteCommonData(result.commonData);
    return result.commonData;
  }

  async function refreshAdmins(){
    if(!SECURE_ADMIN || state.auth.role!=='owner') return;
    const data=await api('/api/admins');
    state.admins=data.admins||[];
  }

  function adminsList(){
    if(state.auth.role!=='owner') return '<div class="empty">オーナーだけが管理者設定を変更できます。</div>';
    return `<div class="toolbar"><h2>管理者</h2></div>
      <div class="meta">オーナーは管理者を後から追加・停止できます。メールアドレスはGoogleログインに使うものを登録します。</div>
      <section class="admin-add-card">
        <div class="field"><label>Googleアカウントのメール</label><input class="input" type="email" data-admin-email placeholder="example@gmail.com"></div>
        <div class="field"><label>権限</label><select class="select" data-admin-role><option value="admin">管理者</option><option value="owner">オーナー</option></select></div>
        <button class="primary" data-admin-add>追加</button>
      </section>
      <div class="section">登録済み</div>
      <div class="list">${state.admins.map(a=>`<article class="row">
        <div class="rowtop"><div><div class="title">${h(a.email)}</div><div class="meta">${a.role==='owner'?'オーナー':'管理者'} · ${a.status==='active'?'有効':'停止中'}</div></div><span class="status ${a.status==='active'?'public':'cancelled'}">${a.status==='active'?'有効':'停止'}</span></div>
        <div class="actions">${a.email===state.auth.user?.email?'':`<button data-admin-toggle="${attr(a.email)}" data-next-status="${a.status==='active'?'disabled':'active'}">${a.status==='active'?'停止する':'有効にする'}</button>`}</div>
      </article>`).join('')||'<div class="empty">管理者がいません。</div>'}</div>`;
  }

  function shell(content){
    const secureNote=SECURE_ADMIN
      ? `<div class="warning secure"><strong>Google認証モード</strong><br>公開すると、見るだけ版と入力版へ同じ共通情報が自動配信されます。</div>`
      : `<div class="warning"><strong>認証未設定・ローカルモード</strong><br>この端末では③の更新を①見るだけ版・②入力版へすぐ反映します。ほかの端末や一般公開中の①へ配信するには、Google認証/API設定前は「配信用JSON」をGitHubへ上書きしてください。Google認証設定後は公開ボタンだけで全端末へ自動配信されます。</div>`;
    const authArea=SECURE_ADMIN&&state.auth.user
      ? `<div class="admin-user"><span>${h(state.auth.user.name||state.auth.user.email)}</span><small>${state.auth.role==='owner'?'OWNER':'ADMIN'}</small><button data-admin-logout>ログアウト</button></div>`
      : '';
    const tabs=[
      ['release','3rd Single'],
      ['other','その他'],
      ['history','履歴'],
      ...(SECURE_ADMIN&&state.auth.role==='owner'?[['admins','管理者']]:[])
    ];
    return `<main class="shell"><header class="top"><div><div class="brand">MaaNote Admin</div><div class="sub">管理者用 · Stage 14 PROD</div></div><div class="top-actions">${SECURE_ADMIN?'':`<button class="app-link admin-export" data-export-common-global>配信用JSON</button>`}<a class="app-link" href="${ROOT_PREFIX}">入力版</a><a class="app-link" href="${ROOT_PREFIX}view/">見るだけ版</a></div></header>${authArea}${secureNote}<nav class="tabs">${tabs.map(([k,l])=>`<button data-tab="${k}" class="${state.tab===k?'active':''}">${l}</button>`).join('')}</nav><div class="content">${content}</div></main>`;
  }

  function render(){
    if(SECURE_ADMIN && !state.auth.user){initGoogleLogin();return}
    if(state.tab==='release') app.innerHTML=shell(releaseList());
    else if(state.tab==='other') app.innerHTML=shell(otherList());
    else if(state.tab==='history') app.innerHTML=shell(historyList());
    else app.innerHTML=shell(adminsList());

    app.querySelectorAll('[data-tab]').forEach(b=>b.onclick=async()=>{
      const next=b.dataset.tab;
      if(next==='admins') await refreshAdmins();
      state.tab=next;
      render();
    });
    app.querySelector('[data-export-common-global]')?.addEventListener('click',exportCommon);
    app.querySelector('[data-admin-logout]')?.addEventListener('click',logoutAdmin);
    bindList();
  }
  function releaseList(){const drafts=state.drafts.filter(d=>d.type==='event');return `<div class="toolbar"><h2>リリースイベント</h2><button class="primary" data-new-event>＋ 新規</button></div><div class="meta">配信バージョン v${state.meta.version||0} · ${state.events.length}件</div>${drafts.length?`<div class="section">下書き</div><div class="list">${drafts.map(d=>`<article class="row"><div class="rowtop"><div><div class="date">自動保存 ${d.updatedAt?new Date(d.updatedAt).toLocaleString('ja-JP'):''}</div><div class="title">${h(d.data?.venue||'新規イベント')}</div></div><span class="status">下書き</span></div><div class="actions"><button data-resume-event="${attr(d.id)}">続きから</button><button data-discard-draft="${attr(d.id)}">破棄</button></div></article>`).join('')}</div>`:''}<div class="section">公開データ</div><div class="list">${state.events.map(e=>`<article class="row"><div class="rowtop"><div><div class="date">${jpDate(e.date)} ${h(e.prefecture||'')}</div><div class="title">${h(e.venue||'会場未入力')}</div><div class="meta">販売 ${h(e.salesStart||'未発表')} · ${e.parts?.length||0}部 · v${e.version||1}</div></div><span class="status ${h(e.status||'public')}">${statusLabel(e.status)}</span></div><div class="actions"><button data-edit-event="${attr(e.id)}">編集</button><button data-copy-event="${attr(e.id)}">複製</button></div></article>`).join('')||'<div class="empty">イベントデータがありません。</div>'}</div>`}
  function otherList(){const drafts=state.drafts.filter(d=>d.type==='other');return `<div class="toolbar"><h2>その他のまーちゃん情報</h2><button class="primary" data-new-other>＋ 新規</button></div>${drafts.length?`<div class="section">下書き</div><div class="list">${drafts.map(d=>`<article class="row"><div class="rowtop"><div><div class="date">自動保存 ${d.updatedAt?new Date(d.updatedAt).toLocaleString('ja-JP'):''}</div><div class="title">${h(d.data?.title||'新規情報')}</div></div><span class="status">下書き</span></div><div class="actions"><button data-resume-other="${attr(d.id)}">続きから</button><button data-discard-draft="${attr(d.id)}">破棄</button></div></article>`).join('')}</div>`:''}<div class="section">公開データ</div><div class="list">${state.other.map(x=>`<article class="row"><div class="rowtop"><div><div class="date">${h(CATEGORIES[x.category]||'OTHER')} · ${jpDate(x.date)} ${h(x.time||'')}</div><div class="title">${h(x.title||'タイトル未入力')}</div><div class="meta">${h(x.place||'')}</div></div><span class="status ${h(x.status||'public')}">${statusLabel(x.status)}</span></div><div class="actions"><button data-edit-other="${attr(x.id)}">編集</button><button data-copy-other="${attr(x.id)}">複製</button></div></article>`).join('')||'<div class="empty">その他の情報はまだありません。</div>'}</div>`}
  function historyList(){return `<div class="toolbar"><h2>公開履歴</h2><button class="secondary" data-export-common>JSON書き出し</button></div><div class="meta">公開のたびに新しいバージョンを作成。削除ではなく非公開・中止・終了を使用します。</div><div class="list">${state.history.map(x=>`<article class="row historyitem"><div class="date">v${x.version||'?'} · ${x.publishedAt?new Date(x.publishedAt).toLocaleString('ja-JP'):'—'}</div><div class="title">${h(x.summary||'更新')}</div><div class="meta">${x.entityType==='event'?'3rd Single':'その他'} · ${h(x.entityId||'')}</div>${x.before?`<div class="actions"><button data-rollback="${attr(x.id)}">この変更前へ戻す</button></div>`:''}</article>`).join('')||'<div class="empty">まだ公開履歴はありません。</div>'}</div>`}
  function statusLabel(s){return ({public:'公開中',hidden:'一時非公開',cancelled:'中止',ended:'終了'})[s]||'公開中'}

  function bindList(){
    app.querySelector('[data-new-event]')?.addEventListener('click',()=>openEventEditor());
    app.querySelector('[data-new-other]')?.addEventListener('click',()=>openOtherEditor());
    app.querySelectorAll('[data-edit-event]').forEach(b=>b.onclick=()=>openEventEditor(state.events.find(x=>x.id===b.dataset.editEvent)));
    app.querySelectorAll('[data-copy-event]').forEach(b=>b.onclick=()=>{const x=structuredClone(state.events.find(x=>x.id===b.dataset.copyEvent));x.id=uid('release');x.date='';x.venue=`${x.venue||''}（複製）`;x.version=0;openEventEditor(x,true)});
    app.querySelectorAll('[data-edit-other]').forEach(b=>b.onclick=()=>openOtherEditor(state.other.find(x=>x.id===b.dataset.editOther)));
    app.querySelectorAll('[data-copy-other]').forEach(b=>b.onclick=()=>{const x=structuredClone(state.other.find(x=>x.id===b.dataset.copyOther));x.id=uid('other');x.date='';x.title=`${x.title||''}（複製）`;x.version=0;openOtherEditor(x,true)});
    app.querySelectorAll('[data-resume-event]').forEach(b=>b.onclick=()=>{const d=state.drafts.find(x=>x.id===b.dataset.resumeEvent);if(d)openEventEditor(d.data)});
    app.querySelectorAll('[data-resume-other]').forEach(b=>b.onclick=()=>{const d=state.drafts.find(x=>x.id===b.dataset.resumeOther);if(d)openOtherEditor(d.data)});
    app.querySelectorAll('[data-discard-draft]').forEach(b=>b.onclick=async()=>{if(!confirm('この下書きを破棄しますか？'))return;await del('adminDrafts',b.dataset.discardDraft);await load();render();showToast('下書きを破棄しました')});
    app.querySelectorAll('[data-rollback]').forEach(b=>b.onclick=()=>rollback(b.dataset.rollback));
    app.querySelector('[data-export-common]')?.addEventListener('click',exportCommon);
    app.querySelector('[data-admin-add]')?.addEventListener('click',async()=>{
      const email=app.querySelector('[data-admin-email]')?.value?.trim();
      const role=app.querySelector('[data-admin-role]')?.value||'admin';
      if(!email){showToast('メールアドレスを入力してください');return}
      try{
        await api('/api/admins',{method:'POST',body:{email,role}});
        await refreshAdmins();
        render();
        showToast('✓ 管理者を追加しました');
      }catch(e){showToast(e.message||'追加できませんでした')}
    });
    app.querySelectorAll('[data-admin-toggle]').forEach(b=>b.onclick=async()=>{
      try{
        await api(`/api/admins/${encodeURIComponent(b.dataset.adminToggle)}`,{method:'PATCH',body:{status:b.dataset.nextStatus}});
        await refreshAdmins();
        render();
        showToast('✓ 管理者設定を更新しました');
      }catch(e){showToast(e.message||'更新できませんでした')}
    });
  }

  function openEventEditor(existing=null,isCopy=false){
    const item=structuredClone(existing||{id:uid('release'),category:'release_event',date:'',prefecture:'',venue:'',venueDetail:'',calendarLabel:'',nearestStations:[{name:'',walkMinutes:null}],salesStart:'13:00',shipping:{type:'unpublished',amount:null},purchaseLimit:null,parts:[{id:'p1',label:'1部',startTime:'16:00',priorityMeetTime:'15:40'}],officialUrl:'',status:'public',version:0});
    showSheet(eventForm(item,isCopy)); bindEventForm(item);
  }
  function eventForm(x,isCopy){const st=x.nearestStations?.[0]||{};return `<div class="sheethead"><div class="sheettitle">${x.version&&!isCopy?'イベント編集':'新規イベント'}</div><button class="textbtn" data-close>閉じる</button></div><div class="help">下書きはこの端末に自動保存。利用者への反映は「公開」を押したときだけです。</div><input type="hidden" data-f="id" value="${attr(x.id)}"><div class="grid2"><div class="field"><label>開催日</label><input class="input example" data-f="date" type="date" value="${attr(x.date||'')}"></div><div class="field"><label>都道府県</label><input class="input example" data-f="prefecture" data-example="例：東京" placeholder="例：東京" value="${attr(x.prefecture||'')}"></div></div><div class="field"><label>会場名</label><input class="input example" data-f="venue" data-example="例：タワーレコード錦糸町パルコ店" placeholder="例：タワーレコード錦糸町パルコ店" value="${attr(x.venue||'')}"></div><div class="field"><label>会場内場所</label><input class="input example" data-f="venueDetail" data-example="例：店内イベントスペース" placeholder="例：店内イベントスペース" value="${attr(x.venueDetail||'')}"></div><div class="field"><label>カレンダー表示名</label><input class="input example" data-f="calendarLabel" data-example="例：池袋" placeholder="例：池袋" value="${attr(x.calendarLabel||'')}"><div class="help">短い地名を入力。未入力なら会場名から自動判定します。</div></div><div class="grid2"><div class="field"><label>最寄駅</label><input class="input example" data-f="station" data-example="例：錦糸町駅" placeholder="例：錦糸町駅" value="${attr(st.name||'')}"></div><div class="field"><label>徒歩（分）</label><input class="input example" data-f="walk" inputmode="numeric" data-example="例：1" placeholder="例：1" value="${st.walkMinutes??''}"></div></div><div class="grid2"><div class="field"><label>CD販売開始</label><input class="input example" data-f="salesStart" type="time" value="${attr(x.salesStart||'')}"></div><div class="field"><label>購入上限（枚）</label><input class="input example" data-f="limit" inputmode="numeric" data-example="例：4" placeholder="例：4" value="${x.purchaseLimit?.count??''}"></div></div><div class="grid2"><div class="field"><label>送料</label><select class="select" data-f="shippingType"><option value="unpublished" ${x.shipping?.type==='unpublished'?'selected':''}>未発表</option><option value="not_listed" ${x.shipping?.type==='not_listed'?'selected':''}>記載なし</option><option value="free" ${x.shipping?.type==='free'?'selected':''}>無料</option><option value="paid" ${x.shipping?.type==='paid'?'selected':''}>有料</option></select></div><div class="field"><label>送料（円）</label><input class="input example" data-f="shippingAmount" inputmode="numeric" data-example="例：950" placeholder="例：950" value="${x.shipping?.amount??''}"></div></div><div class="section">各部</div><div data-parts>${(x.parts||[]).map(partHTML).join('')}</div><button class="secondary" data-add-part style="margin-top:7px">＋ 部を追加</button><div class="field"><label>公式URL</label><input class="input example" data-f="officialUrl" data-example="例：https://..." placeholder="例：https://..." value="${attr(x.officialUrl||'')}"></div><div class="field"><label>状態</label><select class="select" data-f="status">${['public','hidden','cancelled','ended'].map(v=>`<option value="${v}" ${x.status===v?'selected':''}>${statusLabel(v)}</option>`).join('')}</select></div><div class="publishbar"><button class="secondary" data-preview>プレビュー</button><button class="primary" data-publish>公開</button></div>`}
  function partHTML(p,i){return `<div class="part" data-part><div class="partgrid"><div><label class="help">部</label><input class="input example" data-p="label" data-example="例：${i+1}部" placeholder="例：${i+1}部" value="${attr(p.label||'')}"></div><div><label class="help">開始</label><input class="input" data-p="startTime" type="time" value="${attr(p.startTime||'')}"></div><div><label class="help">優先集合</label><input class="input" data-p="priorityMeetTime" type="time" value="${attr(p.priorityMeetTime||'')}"></div><button class="danger" data-remove-part>削除</button></div></div>`}

  function bindEventForm(original){
    bindClose(); activateExamples();
    const parts=sheet.querySelector('[data-parts]');
    sheet.querySelector('[data-add-part]').onclick=()=>{const n=parts.querySelectorAll('[data-part]').length+1;parts.insertAdjacentHTML('beforeend',partHTML({label:`${n}部`,startTime:'16:00',priorityMeetTime:'15:40'},n-1));bindPartButtons();activateExamples();scheduleDraft('event',readEventForm(original))};
    function bindPartButtons(){sheet.querySelectorAll('[data-remove-part]').forEach(b=>b.onclick=()=>{if(parts.querySelectorAll('[data-part]').length<=1){showToast('部は1つ以上残してください');return}b.closest('[data-part]').remove();scheduleDraft('event',readEventForm(original))})}
    bindPartButtons();
    sheet.querySelectorAll('input,select,textarea').forEach(el=>el.addEventListener('input',()=>scheduleDraft('event',readEventForm(original))));
    sheet.querySelector('[data-preview]').onclick=()=>previewEvent(readEventForm(original));
    sheet.querySelector('[data-publish]').onclick=()=>publish('event',readEventForm(original));
  }
  function readEventForm(original={}){const v=n=>sheet.querySelector(`[data-f="${n}"]`)?.value?.trim()||'';const parts=[...sheet.querySelectorAll('[data-part]')].map((el,i)=>({id:original.parts?.[i]?.id||`p${i+1}`,label:el.querySelector('[data-p="label"]').value.trim()||`${i+1}部`,startTime:el.querySelector('[data-p="startTime"]').value||null,priorityMeetTime:el.querySelector('[data-p="priorityMeetTime"]').value||null}));const st=v('shippingType'),amt=v('shippingAmount');return {...original,id:v('id'),category:'release_event',date:v('date'),prefecture:v('prefecture'),venue:v('venue'),venueDetail:v('venueDetail')||null,calendarLabel:v('calendarLabel')||null,nearestStations:v('station')?[{name:v('station'),walkMinutes:v('walk')===''?null:Number(v('walk'))}]:[],salesStart:v('salesStart')||null,shipping:{type:st,amount:st==='paid'&&amt!==''?Number(amt):null},purchaseLimit:v('limit')===''?null:{count:Number(v('limit')),scope:'per_transaction'},parts,officialUrl:v('officialUrl')||null,status:v('status')||'public'}}

  function openOtherEditor(existing=null,isCopy=false){const x=structuredClone(existing||{id:uid('other'),category:'live',date:'',time:'',title:'',place:'',note:'',officialUrl:'',status:'public',version:0});showSheet(`<div class="sheethead"><div class="sheettitle">${x.version&&!isCopy?'情報編集':'新規情報'}</div><button class="textbtn" data-close>閉じる</button></div><div class="help">LIVE / FC / RADIO / LIMISTA / TV・WEB / RELEASE など、必要な項目だけ入力します。</div><input type="hidden" data-f="id" value="${attr(x.id)}"><div class="grid2"><div class="field"><label>カテゴリ</label><select class="select" data-f="category">${Object.entries(CATEGORIES).map(([k,l])=>`<option value="${k}" ${x.category===k?'selected':''}>${l}</option>`).join('')}</select></div><div class="field"><label>状態</label><select class="select" data-f="status">${['public','hidden','cancelled','ended'].map(v=>`<option value="${v}" ${x.status===v?'selected':''}>${statusLabel(v)}</option>`).join('')}</select></div></div><div class="grid2"><div class="field"><label>日付</label><input class="input" data-f="date" type="date" value="${attr(x.date||'')}"></div><div class="field"><label>時間</label><input class="input" data-f="time" type="time" value="${attr(x.time||'')}"></div></div><div class="field"><label>タイトル</label><input class="input example" data-f="title" data-example="例：ラジオ番組名 / LIVE名" placeholder="例：ラジオ番組名 / LIVE名" value="${attr(x.title||'')}"></div><div class="field"><label>場所・放送局など</label><input class="input example" data-f="place" data-example="例：○○ホール / ○○FM" placeholder="例：○○ホール / ○○FM" value="${attr(x.place||'')}"></div><div class="field"><label>短いメモ</label><textarea class="area example" data-f="note" data-example="例：出演時間は公式情報を確認" placeholder="例：出演時間は公式情報を確認">${h(x.note||'')}</textarea></div><div class="field"><label>公式URL</label><input class="input example" data-f="officialUrl" data-example="例：https://..." placeholder="例：https://..." value="${attr(x.officialUrl||'')}"></div><div class="publishbar"><button class="secondary" data-preview>プレビュー</button><button class="primary" data-publish>公開</button></div>`);bindClose();activateExamples();sheet.querySelectorAll('input,select,textarea').forEach(el=>el.addEventListener('input',()=>scheduleDraft('other',readOtherForm(x))));sheet.querySelector('[data-preview]').onclick=()=>previewOther(readOtherForm(x));sheet.querySelector('[data-publish]').onclick=()=>publish('other',readOtherForm(x))}
  function readOtherForm(original={}){const v=n=>sheet.querySelector(`[data-f="${n}"]`)?.value?.trim()||'';return {...original,id:v('id'),category:v('category')||'other',date:v('date')||null,time:v('time')||null,title:v('title'),place:v('place')||null,note:v('note')||null,officialUrl:v('officialUrl')||null,status:v('status')||'public'}}

  function activateExamples(){sheet.querySelectorAll('.example').forEach(el=>{const ex=el.dataset.example||el.placeholder||'';el.onfocus=()=>el.placeholder='';el.onblur=()=>{if(!el.value)el.placeholder=ex}})}
  function bindClose(){sheet.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeSheet);sheet.querySelector('.sheetback')?.addEventListener('click',e=>{if(e.target.classList.contains('sheetback'))closeSheet()})}
  function showSheet(body){sheet.innerHTML=`<div class="sheetback"><div class="sheet"><div class="grab"></div>${body}</div></div>`}
  function closeSheet(){sheet.innerHTML=''}

  function scheduleDraft(type,data){clearTimeout(state.draftTimer);state.draftTimer=setTimeout(async()=>{await put('adminDrafts',{id:`${type}:${data.id}`,type,data,updatedAt:now()});showToast('下書き保存')},350)}
  async function persistDraftNow(type,data){
    clearTimeout(state.draftTimer);
    await put('adminDrafts',{id:`${type}:${data.id}`,type,data,updatedAt:now()});
  }

  async function previewEvent(x){
    await persistDraftNow('event',x);
    showSheet(`<div class="sheethead"><div class="sheettitle">公開プレビュー</div><button class="textbtn" data-preview-back>閉じる</button></div><div class="preview"><div class="big">${h(jpDate(x.date))} ${h(x.prefecture)} · ${h(x.venue||'会場未入力')}</div><div class="small">${h(x.venueDetail||'')}<br>販売 ${h(x.salesStart||'未発表')} ｜ 送料 ${h(shippingText(x.shipping))} ｜ 上限 ${x.purchaseLimit?.count?x.purchaseLimit.count+'枚/1会計':'未発表'}</div><div class="small">${(x.parts||[]).map(p=>`${h(p.label)} ${h(p.startTime||'—')} 集${h(p.priorityMeetTime||'—')}`).join('<br>')}</div></div><div class="preview-actions"><button class="secondary" data-preview-back>編集に戻る</button><button class="primary" data-preview-publish>この内容を公開</button></div>`);
    const back=()=>openEventEditor(structuredClone(x));
    sheet.querySelectorAll('[data-preview-back]').forEach(b=>b.onclick=back);
    sheet.querySelector('[data-preview-publish]').onclick=()=>publish('event',structuredClone(x));
    sheet.querySelector('.sheetback')?.addEventListener('click',e=>{if(e.target.classList.contains('sheetback'))back()});
  }

  async function previewOther(x){
    await persistDraftNow('other',x);
    showSheet(`<div class="sheethead"><div class="sheettitle">公開プレビュー</div><button class="textbtn" data-preview-back>閉じる</button></div><div class="preview"><div class="date">${h(CATEGORIES[x.category]||'OTHER')} · ${h(jpDate(x.date))} ${h(x.time||'')}</div><div class="big">${h(x.title||'タイトル未入力')}</div><div class="small">${h(x.place||'')}<br>${h(x.note||'')}</div></div><div class="preview-actions"><button class="secondary" data-preview-back>編集に戻る</button><button class="primary" data-preview-publish>この内容を公開</button></div>`);
    const back=()=>openOtherEditor(structuredClone(x));
    sheet.querySelectorAll('[data-preview-back]').forEach(b=>b.onclick=back);
    sheet.querySelector('[data-preview-publish]').onclick=()=>publish('other',structuredClone(x));
    sheet.querySelector('.sheetback')?.addEventListener('click',e=>{if(e.target.classList.contains('sheetback'))back()});
  }
  function shippingText(sh){if(!sh||sh.type==='unpublished')return '未発表';if(sh.type==='not_listed')return '記載なし';if(sh.type==='free')return '無料';return sh.amount!=null?`¥${Number(sh.amount).toLocaleString('ja-JP')}`:'有料'}

  async function publish(type,data){
    if(type==='event'&&(!data.date||!data.venue)){showToast('開催日と会場名は必須です');return}
    if(type==='other'&&!data.title){showToast('タイトルは必須です');return}

    if(type==='event'){
      const norm=s=>String(s||'').replace(/[\s　・]/g,'').toLowerCase();
      const same=state.events.find(x=>x.id!==data.id && x.date===data.date && x.prefecture===data.prefecture && norm(x.venue)===norm(data.venue));
      if(same) data={...data,id:same.id};
    }

    if(SECURE_ADMIN){
      if(!state.auth.user){showToast('管理者ログインが必要です');return}
      if(!confirm('この内容を公開しますか？\n見るだけ版と入力版の両方へ反映されます。'))return;

      const list=type==='event'?state.events:state.other;
      const before=list.find(x=>x.id===data.id)||null;
      const publishedAt=now();
      const next={...data,version:(before?.version||0)+1,updatedAt:publishedAt};
      const summary=type==='event'
        ? `${next.date||''} ${next.prefecture||''} ${next.venue||''} を${before?'更新':'追加'}しました`
        : `${CATEGORIES[next.category]||'OTHER'}「${next.title}」を${before?'更新':'追加'}しました`;
      const events=type==='event'
        ? [...state.events.filter(x=>x.id!==next.id),next].sort((a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999')))
        : state.events;
      const otherItems=type==='other'
        ? [...state.other.filter(x=>x.id!==next.id),next].sort((a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999')))
        : state.other;

      try{
        await publishToApi({summary,events,otherItems});
        await del('adminDrafts',`${type}:${next.id}`).catch(()=>{});
        closeSheet();
        await load();
        render();
        showToast('✓ ①見るだけ版・②入力版へ公開しました');
      }catch(e){
        if(e.status===409){
          showToast('他の管理者が先に更新しました。最新情報を読み込みます');
          await syncRemoteCommonDataForAdmin();
          await load();
          render();
        }else{
          console.error(e);
          showToast(e.message||'公開できませんでした');
        }
      }
      return;
    }

    if(!confirm('この内容を公開用データとして保存しますか？\n保存後、利用者全体へ反映するには common-data.json の書き出しとGitHubへのPushが必要です。'))return;
    const store=type==='event'?'commonEvents':'commonOtherItems'; const list=type==='event'?state.events:state.other; const before=list.find(x=>x.id===data.id)||null;
    const meta=(await all('commonMeta')).find(x=>x.key==='publish')||{version:0}; const version=Number(meta.version||0)+1; const publishedAt=now();
    const next={...data,version:(before?.version||0)+1,updatedAt:publishedAt}; await put(store,next);
    const summary=type==='event'?`${next.date||''} ${next.prefecture||''} ${next.venue||''} を${before?'更新':'追加'}しました`:`${CATEGORIES[next.category]||'OTHER'}「${next.title}」を${before?'更新':'追加'}しました`;
    await put('commonMeta',{key:'publish',version,updatedAt:publishedAt,summary});
    await put('commonHistory',{id:uid('history'),version,publishedAt,entityType:type,entityId:next.id,summary,before:before?structuredClone(before):null,after:structuredClone(next)});
    await del('adminDrafts',`${type}:${next.id}`).catch(()=>{}); closeSheet(); await load(); publishLocalPreview(); render();
    showToast('✓ ①見るだけ版・②入力版へこの端末内で反映しました');
  }

  async function rollback(historyId){
    const rec=state.history.find(x=>x.id===historyId);
    if(!rec?.before)return;
    if(!confirm('この変更前の内容を、新しいバージョンとして再公開しますか？'))return;

    if(SECURE_ADMIN){
      const current=(rec.entityType==='event'?state.events:state.other).find(x=>x.id===rec.entityId)||null;
      const restored={...structuredClone(rec.before),version:(current?.version||0)+1,updatedAt:now()};
      const summary=`${rec.summary} の変更前へロールバック`;
      const events=rec.entityType==='event'
        ? [...state.events.filter(x=>x.id!==rec.entityId),restored].sort((a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999')))
        : state.events;
      const otherItems=rec.entityType==='other'
        ? [...state.other.filter(x=>x.id!==rec.entityId),restored].sort((a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999')))
        : state.other;
      try{
        await publishToApi({summary,events,otherItems});
        await load();render();showToast('✓ ロールバックを公開しました');
      }catch(e){showToast(e.status===409?'他の管理者が先に更新しました':'ロールバックできませんでした')}
      return;
    }

    const store=rec.entityType==='event'?'commonEvents':'commonOtherItems';
    const current=(rec.entityType==='event'?state.events:state.other).find(x=>x.id===rec.entityId)||null;
    const meta=(await all('commonMeta')).find(x=>x.key==='publish')||{version:0};
    const version=Number(meta.version||0)+1, publishedAt=now();
    const restored={...structuredClone(rec.before),version:(current?.version||0)+1,updatedAt:publishedAt};
    await put(store,restored);
    const summary=`${rec.summary} の変更前へロールバック`;
    await put('commonMeta',{key:'publish',version,updatedAt:publishedAt,summary});
    await put('commonHistory',{id:uid('history'),version,publishedAt,entityType:rec.entityType,entityId:rec.entityId,summary,before:current?structuredClone(current):null,after:structuredClone(restored)});
    await load();publishLocalPreview();render();showToast('✓ ロールバックを①②へ反映しました');
  }

  function exportCommon(){const payload={format:'MaaNote-common-data',version:1,publishMeta:state.meta,events:state.events,otherItems:state.other,history:state.history,exportedAt:now()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='common-data.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);showToast('common-data.json を書き出しました')}
  let tt;function showToast(msg){clearTimeout(tt);toast.textContent=msg;toast.classList.add('show');tt=setTimeout(()=>toast.classList.remove('show'),1300)}

  async function boot(){
    try{
      state.db=await openDB();
      await recoverAdminEmergencyBackup();
      if(SECURE_ADMIN){
        initGoogleLogin();
        return;
      }
      await load();
      publishLocalPreview();
      scheduleAdminBackup();
      render();
      if(state.recovered)setTimeout(()=>showToast('端末バックアップから管理者データを自動復旧しました'),250);
    }catch(e){
      console.error(e);
      app.innerHTML=`<main class="shell"><div class="empty">管理者データ領域を開けませんでした。</div></main>`;
    }
  }
  boot();
})();
