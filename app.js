(() => {
  'use strict';

  const APP_VERSION = '0.9-stage15-prod';
  const APP_VERSION_LABEL = 'v0.9 Stage 15 PROD';
  const CONFIG = globalThis.MAANOTE_CONFIG || {};
  const API_BASE = String(CONFIG.API_BASE||'').replace(/\/$/,'');
  const IS_VIEW_BUILD = location.pathname.includes('/view/');
  const IS_TEST_MODE = !IS_VIEW_BUILD && new URLSearchParams(location.search).get('test')==='1';
  const COMMON_DATA_URL = API_BASE ? `${API_BASE}/api/common-data` : (IS_VIEW_BUILD ? '../common-data.json' : './common-data.json');
  const VERSION_URL = IS_VIEW_BUILD ? '../version.json' : './version.json';
  const SW_URL = IS_VIEW_BUILD ? '../sw.js' : './sw.js';
  const APP_DB_NAME = IS_VIEW_BUILD ? 'MaaNoteProdViewDB' : 'MaaNoteProdDB';
  const EMERGENCY_PREFIX = IS_VIEW_BUILD ? 'MaaNoteProdView' : 'MaaNoteProd';
  const SHARED_LOCAL_COMMON_KEY='MaaNoteProdSharedCommonPreviewV1';
  const DRIVE_SYNC_ENABLED=!IS_VIEW_BUILD && !!CONFIG.DRIVE_SYNC_ENABLED && !!API_BASE;
  const DRIVE_FILE_NAME='MaaNote_prod_personal_backup_v1.json';
  const PERSONAL_STORES=['userEventPlans','settings','todos','personalSchedules','travelBookings','setlists','talkMemos','migrationInfo','legacyData'];
  const DRIVE_DIRTY_KEY='MaaNoteProdDriveDirtyV1';
  const DRIVE_BACKEND_SESSION_KEY='MaaNoteProdDriveBackendSessionV1';
  const DRIVE_FIRST_SETUP_KEY='MaaNoteProdDriveFirstSetupV1';
  const DRIVE_AUTO_DELAY=9000;
  let driveAutoTimer=null;
  let driveAutoBackupSuspended=false;
  let driveReconnectToastShown=false;

  const ACCENT = '#47B0A0';
  const OFFICIAL_URL = 'https://www.jp-r.co.jp/masaki_satou/event/006feb74b8da455d4d8e8d30b5f54904965d113acebc5cffe84c79f8d2b7cc76/';

  // TEST BUILD: current announced event dates/venues are used as UI data.
  // Items marked null/未発表 are intentionally not inferred.
  const seededOfficialEvents = [
    {
      id:'release-20261102-chiba', category:'release_event', date:'2026-11-02', prefecture:'千葉',
      venue:'イオンモール幕張新都心', venueDetail:null, calendarLabel:'幕張',
      nearestStations:[{name:'幕張豊砂駅', walkMinutes:null}],
      salesStart:null, shipping:{type:'unpublished', amount:null}, purchaseLimit:null,
      parts:[], officialUrl:OFFICIAL_URL, status:'public', version:2, updatedAt:'2026-10-02T20:00:00+09:00'
    },
    {
      id:'release-20261108-ishikawa', category:'release_event', date:'2026-11-08', prefecture:'石川',
      venue:'金沢フォーラス', venueDetail:null, calendarLabel:'金沢',
      nearestStations:[{name:'金沢駅', walkMinutes:null}],
      salesStart:null, shipping:{type:'unpublished', amount:null}, purchaseLimit:null,
      parts:[], officialUrl:OFFICIAL_URL, status:'public', version:2, updatedAt:'2026-10-02T20:00:00+09:00'
    },
    {
      id:'release-20261115-tokyo', category:'release_event', date:'2026-11-15', prefecture:'東京',
      venue:'タワーレコード錦糸町パルコ店', venueDetail:'店内イベントスペース', calendarLabel:'錦糸町',
      nearestStations:[{name:'錦糸町駅', walkMinutes:1}],
      salesStart:'11:00', shipping:{type:'paid', amount:950}, purchaseLimit:{count:4, scope:'per_transaction'},
      parts:[
        {id:'p1', label:'1部', startTime:'14:00', priorityMeetTime:'13:40'},
        {id:'p2', label:'2部', startTime:'17:00', priorityMeetTime:'16:40'}
      ],
      officialUrl:OFFICIAL_URL, status:'public', version:2, updatedAt:'2026-10-02T20:00:00+09:00'
    },
    {
      id:'release-20261121-hokkaido', category:'release_event', date:'2026-11-21', prefecture:'北海道',
      venue:'サッポロファクトリー', venueDetail:null, calendarLabel:'札幌',
      nearestStations:[], salesStart:null, shipping:{type:'unpublished', amount:null}, purchaseLimit:null,
      parts:[], officialUrl:OFFICIAL_URL, status:'public', version:2, updatedAt:'2026-10-02T20:00:00+09:00'
    },
    {
      id:'release-20261123-aichi', category:'release_event', date:'2026-11-23', prefecture:'愛知',
      venue:'エアポートウォーク名古屋', venueDetail:null, calendarLabel:'名古屋',
      nearestStations:[], salesStart:null, shipping:{type:'unpublished', amount:null}, purchaseLimit:null,
      parts:[], officialUrl:OFFICIAL_URL, status:'public', version:2, updatedAt:'2026-10-02T20:00:00+09:00'
    },
    {
      id:'release-20261128-hiroshima', category:'release_event', date:'2026-11-28', prefecture:'広島',
      venue:'イオンモール広島府中', venueDetail:null, calendarLabel:'広島',
      nearestStations:[], salesStart:null, shipping:{type:'unpublished', amount:null}, purchaseLimit:null,
      parts:[], officialUrl:OFFICIAL_URL, status:'public', version:2, updatedAt:'2026-10-02T20:00:00+09:00'
    },
    {
      id:'release-20261206-fukuoka', category:'release_event', date:'2026-12-06', prefecture:'福岡',
      venue:'キャナルシティ博多', venueDetail:null, calendarLabel:'博多',
      nearestStations:[], salesStart:null, shipping:{type:'unpublished', amount:null}, purchaseLimit:null,
      parts:[], officialUrl:OFFICIAL_URL, status:'public', version:2, updatedAt:'2026-10-02T20:00:00+09:00'
    },
    {
      id:'release-20261215-tokyo', category:'release_event', date:'2026-12-15', prefecture:'東京',
      venue:'池袋・サンシャインシティ 噴水広場', venueDetail:null, calendarLabel:'池袋',
      nearestStations:[{name:'池袋駅', walkMinutes:null}], salesStart:null, shipping:{type:'unpublished', amount:null}, purchaseLimit:null,
      parts:[], officialUrl:OFFICIAL_URL, status:'public', version:2, updatedAt:'2026-10-02T20:00:00+09:00'
    },
    {
      id:'release-20261219-hyogo', category:'release_event', date:'2026-12-19', prefecture:'兵庫',
      venue:'神戸ハーバーランド スペースシアター', venueDetail:null, calendarLabel:'神戸',
      nearestStations:[], salesStart:null, shipping:{type:'unpublished', amount:null}, purchaseLimit:null,
      parts:[], officialUrl:OFFICIAL_URL, status:'public', version:2, updatedAt:'2026-10-02T20:00:00+09:00'
    }
  ];
  let officialEvents = [];

  const initialOtherItems = [
    {
      id:'other-test-release-note', category:'release', date:'2026-09-24', time:null,
      title:'3rdシングル発売記念イベント一覧が公開されました', place:null, note:'管理者配信の画面確認用サンプルです。',
      officialUrl:OFFICIAL_URL, status:'public', version:2, updatedAt:'2026-10-02T20:00:00+09:00', sample:true
    }
  ];

  const initialUserPlans = {
    'release-20261115-tokyo': {
      eventId:'release-20261115-tokyo', participationStatus:'confirmed', cdQuantity:8,
      parts:{ p1:{talkTicketQuantity:3,priorityNumber:108}, p2:{talkTicketQuantity:4,priorityNumber:53} },
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), revision:1, deleted:false
    },
    'release-20261108-ishikawa': {
      eventId:'release-20261108-ishikawa', participationStatus:'maybe', cdQuantity:null, parts:{},
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), revision:1, deleted:false
    }
  };


  const initialTodos = [
    {id:'todo-hotel-20261110', title:'ホテル予約を確認', eventId:'release-20261115-tokyo', dueDate:'2026-11-10', dueTime:null, memo:'予約内容とキャンセル期限を確認', completed:false, showOnCalendar:true, createdBy:'suggestion', sortOrder:1, createdAt:'2026-10-02T12:00:00+09:00', updatedAt:'2026-10-02T12:00:00+09:00', revision:1, deleted:false},
    {id:'todo-battery-20261114', title:'モバイルバッテリーを充電', eventId:'release-20261115-tokyo', dueDate:'2026-11-14', dueTime:'21:00', memo:null, completed:false, showOnCalendar:true, createdBy:'manual', sortOrder:2, createdAt:'2026-10-02T12:00:00+09:00', updatedAt:'2026-10-02T12:00:00+09:00', revision:1, deleted:false},
    {id:'todo-friend-20261115', title:'○○ちゃんに連絡', eventId:'release-20261115-tokyo', dueDate:'2026-11-15', dueTime:'11:30', memo:'到着時間を送る', completed:false, showOnCalendar:true, createdBy:'manual', sortOrder:3, createdAt:'2026-10-02T12:00:00+09:00', updatedAt:'2026-10-02T12:00:00+09:00', revision:1, deleted:false},
    {id:'todo-example-done', title:'新幹線の予約', eventId:'release-20261115-tokyo', dueDate:'2026-11-01', dueTime:null, memo:null, completed:true, completedAt:'2026-10-30T09:00:00+09:00', showOnCalendar:false, createdBy:'manual', sortOrder:4, createdAt:'2026-10-02T12:00:00+09:00', updatedAt:'2026-10-30T09:00:00+09:00', revision:2, deleted:false}
  ];

  const initialPersonalSchedules = [
    {id:'schedule-meet-20261115', eventId:'release-20261115-tokyo', date:'2026-11-15', time:'12:30', title:'○○ちゃんと待ち合わせ', memo:'会場入口付近', createdAt:'2026-10-02T12:00:00+09:00', updatedAt:'2026-10-02T12:00:00+09:00', revision:1, deleted:false}
  ];

  const initialTravelBookings = [
    {
      id:'travel-sample-outbound-20261115', eventId:'release-20261115-tokyo',
      type:'train', direction:'outbound', title:'東京行き新幹線', date:'2026-11-15',
      startTime:'09:10', endDate:'2026-11-15', endTime:'11:40',
      from:'新大阪', to:'東京', seat:'12号車 8A', bookingSite:'EX予約',
      bookingCode:'TEST-ABC123', partySize:1, cost:14720,
      paymentStatus:'paid', bookingStatus:'confirmed', paymentDue:null, freeCancelUntil:null,
      url:null, notes:'画面確認用サンプルです。', images:[], sample:true,
      createdAt:'2026-10-02T12:00:00+09:00', updatedAt:'2026-10-02T12:00:00+09:00', revision:1, deleted:false
    },
    {
      id:'travel-sample-hotel-20261115', eventId:'release-20261115-tokyo',
      type:'hotel', direction:'stay', title:'○○ホテル東京', date:'2026-11-15',
      startTime:'15:00', endDate:'2026-11-16', endTime:'10:00',
      from:null, to:null, seat:null, bookingSite:'楽天トラベル',
      bookingCode:'TEST-HOTEL456', partySize:1, cost:9800,
      paymentStatus:'paid', bookingStatus:'confirmed', paymentDue:null, freeCancelUntil:'2026-11-14',
      url:null, notes:'画面確認用サンプルです。', images:[], sample:true,
      createdAt:'2026-10-02T12:00:00+09:00', updatedAt:'2026-10-02T12:00:00+09:00', revision:1, deleted:false
    }
  ];


  const initialSetlists = [];
  const initialTalkMemos = [];

  const state = {
    screen:'home',
    eventCategoryTab:'release',
    eventFilter:'all',
    eventSort:'date',
    detailEventId:null,
    detailTab:'official',
    lastEventScroll:0,
    userPlans:{},
    otherItems:[],
    commonMeta:{version:0,updatedAt:null,summary:null},
    commonHistory:[],
    todos:[],
    personalSchedules:[],
    travelBookings:[],
    setlists:[],
    talkMemos:[],
    travelEventFilter:null,
    travelDirectionFilter:'all',
    scheduleTab:'calendar',
    calendarView:'month',
    calendarCursor:null,
    todoFilter:'open',
    todoSelection:false,
    selectedTodoIds:new Set(),
    summaryMoneyVisible:false,
    settings:{ mode:'personal_management', homeEventFilter:'all', headerImage:null, previewDate:null, imageQuality:'standard', fontSize:'standard', rememberEventFilter:true, lastEventFilter:'all', driveBackupMode:null },
    settingsReturnScreen:'home',
    recoveredEmergencyBackup:false,
    hadStoredSettings:false,
    drive:{file:null,busy:false,error:null,needsReconnect:false,user:null,statusChecked:false},
    db:null
  };

  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  const sheetRoot = document.getElementById('sheetRoot');
  const networkStatusEl = document.getElementById('networkStatus');
  let wasOffline = !navigator.onLine;

  const icon = (name) => {
    const common = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
    const p = {
      home:`<svg viewBox="0 0 24 24" ${common}><path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z"/></svg>`,
      heart:`<svg viewBox="0 0 24 24" ${common}><path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.8l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8z"/></svg>`,
      calendar:`<svg viewBox="0 0 24 24" ${common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M7 14h2M12 14h2M17 14h1M7 18h2M12 18h2"/></svg>`,
      luggage:`<svg viewBox="0 0 24 24" ${common}><rect x="5" y="7" width="14" height="14" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M9 11v6M15 11v6M8 21v1M16 21v1"/></svg>`,
      chart:`<svg viewBox="0 0 24 24" ${common}><path d="M5 20V11M10 20V5M15 20v-8M20 20V3"/></svg>`,
      plus:`<svg viewBox="0 0 24 24" ${common}><path d="M12 5v14M5 12h14"/></svg>`,
      settings:`<svg viewBox="0 0 24 24" ${common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .9l-.03.08H10l-.03-.08a1.7 1.7 0 0 0-1-.9 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.9-1L3.62 14v-4l.08-.03a1.7 1.7 0 0 0 .9-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06L7.03 4.2l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.9l.03-.08h4l.03.08a1.7 1.7 0 0 0 1 .9 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.2.4.52.75.9 1l.08.03v4l-.08.03c-.38.25-.7.6-.9 1z"/></svg>`,
      pin:`<svg viewBox="0 0 24 24" ${common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/></svg>`,
      chevron:`<svg viewBox="0 0 24 24" ${common}><path d="m9 18 6-6-6-6"/></svg>`,
      close:`<svg viewBox="0 0 24 24" ${common}><path d="M6 6l12 12M18 6 6 18"/></svg>`,
      external:`<svg viewBox="0 0 24 24" ${common}><path d="M14 4h6v6M20 4l-9 9"/><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/></svg>`,
      back:`<svg viewBox="0 0 24 24" ${common}><path d="m15 18-6-6 6-6"/></svg>`,
      edit:`<svg viewBox="0 0 24 24" ${common}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></svg>`,
      list:`<svg viewBox="0 0 24 24" ${common}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`
    };
    return p[name] || '';
  };

  function openDB(){
    const stores=[
      ['userEventPlans','eventId'],['settings','key'],['todos','id'],['personalSchedules','id'],
      ['travelBookings','id'],['setlists','id'],['talkMemos','id'],['commonEvents','id'],
      ['commonOtherItems','id'],['commonMeta','key'],['commonHistory','id'],['adminDrafts','id'],
      ['migrationInfo','id'],['legacyData','id']
    ];
    const open = (version) => new Promise((resolve,reject)=>{
      const req = version ? indexedDB.open(APP_DB_NAME,version) : indexedDB.open(APP_DB_NAME);
      req.onupgradeneeded = () => {
        const db=req.result;
        stores.forEach(([name,keyPath])=>{
          if(!db.objectStoreNames.contains(name)) db.createObjectStore(name,{keyPath});
        });
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
    return open(7).catch(err=>{
      // 同じGitHub Pages URLで新しいMaaNoteを先に開いた場合、
      // 端末内DBのバージョンが7より新しくても既存DBをそのまま開く。
      if(err && err.name==='VersionError') return open();
      throw err;
    });
  }


  const EMERGENCY_PERSONAL_KEY=`${EMERGENCY_PREFIX}EmergencyPersonalV1`;
  const EMERGENCY_COMMON_KEY=`${EMERGENCY_PREFIX}EmergencyCommonV1`;
  let emergencyBackupTimer=null;
  let emergencyBackupSuspended=false;

  function emergencySanitize(value,key=''){
    if(key==='headerImage' || key==='images' || key==='dataUrl') return key==='images'?[]:null;
    if(typeof value==='string' && value.startsWith('data:image/')) return null;
    if(Array.isArray(value)) return value.map(v=>emergencySanitize(v,''));
    if(value && typeof value==='object'){
      const out={};
      for(const [k,v] of Object.entries(value)) out[k]=emergencySanitize(v,k);
      return out;
    }
    return value;
  }

  function parseEmergencyBackup(key){
    try{
      const raw=localStorage.getItem(key);
      if(!raw) return null;
      const data=JSON.parse(raw);
      return data && data.format==='MaaNote-emergency-backup' ? data : null;
    }catch(err){
      console.warn('Emergency backup parse failed',err);
      return null;
    }
  }

  async function writeEmergencyBackup(){
    if(emergencyBackupSuspended || !state.db) return;
    try{
      const personalStores=PERSONAL_STORES;
      const commonStores=['commonEvents','commonOtherItems','commonMeta','commonHistory','adminDrafts'];
      const personal={};
      const common={};
      if(!IS_VIEW_BUILD){
        for(const store of personalStores) personal[store]=emergencySanitize(await idbGetAll(store),store);
      }
      for(const store of commonStores) common[store]=emergencySanitize(await idbGetAll(store),store);
      if(!IS_VIEW_BUILD){
        localStorage.setItem(EMERGENCY_PERSONAL_KEY,JSON.stringify({
          format:'MaaNote-emergency-backup',version:1,scope:'personal',appVersion:APP_VERSION,
          updatedAt:new Date().toISOString(),stores:personal
        }));
      }
      localStorage.setItem(EMERGENCY_COMMON_KEY,JSON.stringify({
        format:'MaaNote-emergency-backup',version:1,scope:'common',appVersion:APP_VERSION,
        updatedAt:new Date().toISOString(),stores:common
      }));
    }catch(err){
      console.warn('Emergency backup write failed',err);
    }
  }

  function scheduleEmergencyBackup(){
    if(emergencyBackupSuspended || !state.db) return;
    clearTimeout(emergencyBackupTimer);
    emergencyBackupTimer=setTimeout(()=>writeEmergencyBackup(),450);
  }

  async function restoreEmergencyBackupIfNeeded(){
    if(!state.db) return false;
    let restored=false;
    emergencyBackupSuspended=true;
    try{
      const personalBackup=IS_VIEW_BUILD?null:parseEmergencyBackup(EMERGENCY_PERSONAL_KEY);
      if(personalBackup?.stores){
        const personalStores=PERSONAL_STORES;
        for(const store of personalStores){
          const currentRows=await idbGetAll(store);
          const backupRows=personalBackup.stores[store]||[];
          if(!currentRows.length && backupRows.length){
            for(const row of backupRows) await idbPut(store,structuredClone(row),{skipEmergencyBackup:true,skipAutoDriveBackup:true});
            restored=true;
          }
        }
      }

      const commonBackup=parseEmergencyBackup(EMERGENCY_COMMON_KEY);
      if(commonBackup?.stores){
        const commonStores=['commonEvents','commonOtherItems','commonMeta','commonHistory','adminDrafts'];
        for(const store of commonStores){
          const currentRows=await idbGetAll(store);
          const backupRows=commonBackup.stores[store]||[];
          if(!currentRows.length && backupRows.length){
            for(const row of backupRows) await idbPut(store,structuredClone(row),{skipEmergencyBackup:true,skipAutoDriveBackup:true});
            restored=true;
          }
        }
      }
    }catch(err){
      console.warn('Emergency backup recovery failed',err);
    }finally{
      emergencyBackupSuspended=false;
    }
    state.recoveredEmergencyBackup=restored;
    return restored;
  }

  function idbGetAll(store){
    return new Promise((resolve,reject)=>{
      const tx=state.db.transaction(store,'readonly');
      const req=tx.objectStore(store).getAll();
      req.onsuccess=()=>resolve(req.result||[]); req.onerror=()=>reject(req.error);
    });
  }
  function idbClear(store){
    return new Promise((resolve,reject)=>{
      const tx=state.db.transaction(store,'readwrite');
      const req=tx.objectStore(store).clear();
      req.onsuccess=()=>resolve();
      req.onerror=()=>reject(req.error);
    });
  }

  function idbPut(store,value,{skipEmergencyBackup=false,skipAutoDriveBackup=false}={}){
    return new Promise((resolve,reject)=>{
      const tx=state.db.transaction(store,'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete=()=>{
        if(!skipEmergencyBackup) scheduleEmergencyBackup();
        if(!skipAutoDriveBackup) markDriveBackupDirty(store,value);
        resolve();
      };
      tx.onerror=()=>reject(tx.error);
    });
  }

  async function applySharedLocalCommonData(){
    if(API_BASE) return {updated:false};
    let payload=null;
    try{payload=JSON.parse(localStorage.getItem(SHARED_LOCAL_COMMON_KEY)||'null')}catch(_){}
    if(payload?.format!=='MaaNote-common-data' || !Array.isArray(payload.events) || !Array.isArray(payload.otherItems)) {
      return {updated:false};
    }
    const metaRows=await idbGetAll('commonMeta');
    const localMeta=metaRows.find(x=>x.key==='publish')||{version:0};
    const localVersion=Number(localMeta.version||0);
    const incomingVersion=Number(payload.publishMeta?.version||0);
    if(incomingVersion<=localVersion) return {updated:false,incomingVersion,localVersion};

    for(const row of payload.events) await idbPut('commonEvents',structuredClone(row));
    for(const row of payload.otherItems) await idbPut('commonOtherItems',structuredClone(row));
    if(payload.publishMeta){
      await idbPut('commonMeta',{key:'publish',...structuredClone(payload.publishMeta)});
    }
    if(Array.isArray(payload.history)){
      for(const row of payload.history) await idbPut('commonHistory',structuredClone(row));
    }
    return {updated:true,incomingVersion,localVersion};
  }

  async function syncPublishedCommonData({force=false}={}){
    const localPreview=await applySharedLocalCommonData();
    if(!navigator.onLine) return {updated:localPreview.updated,offline:true};
    try{
      const res=await fetch(`${COMMON_DATA_URL}?t=${Date.now()}`,{cache:'no-store'});
      if(!res.ok) throw new Error(`common-data ${res.status}`);
      const payload=await res.json();
      if(payload?.format!=='MaaNote-common-data' || !Array.isArray(payload.events) || !Array.isArray(payload.otherItems)) {
        throw new Error('invalid common-data');
      }

      const metaRows=await idbGetAll('commonMeta');
      const localMeta=metaRows.find(x=>x.key==='publish')||{version:0};
      const remoteMeta=payload.publishMeta||{version:0};
      const localVersion=Number(localMeta.version||0);
      const remoteVersion=Number(remoteMeta.version||0);
      const currentEvents=await idbGetAll('commonEvents');
      const shouldApply=force || !currentEvents.length || remoteVersion>localVersion;

      if(!shouldApply) return {updated:localPreview.updated,remoteVersion,localVersion};

      for(const row of payload.events) await idbPut('commonEvents',structuredClone(row));
      for(const row of payload.otherItems) await idbPut('commonOtherItems',structuredClone(row));

      if(remoteMeta && typeof remoteMeta==='object'){
        await idbPut('commonMeta',{
          key:'publish',
          version:remoteVersion,
          updatedAt:remoteMeta.updatedAt||null,
          summary:remoteMeta.summary||null
        });
      }

      if(Array.isArray(payload.history)){
        for(const row of payload.history) await idbPut('commonHistory',structuredClone(row));
      }

      return {updated:true,remoteVersion,localVersion};
    }catch(err){
      console.warn('Published common-data sync failed',err);
      return {updated:false,error:true};
    }
  }

  async function loadCommonData(){
    let events=await idbGetAll('commonEvents');
    if(!events.length){
      for(const row of seededOfficialEvents) await idbPut('commonEvents',structuredClone(row));
      events=structuredClone(seededOfficialEvents);
    }else{
      const byId=new Map(events.map(x=>[x.id,x]));
      for(const seed of seededOfficialEvents){
        const current=byId.get(seed.id);
        if(!current || Number(current.version||0) < Number(seed.version||0)){
          await idbPut('commonEvents',structuredClone(seed));
          byId.set(seed.id,structuredClone(seed));
        }
      }
      events=[...byId.values()];
    }
    officialEvents=events.filter(x=>x.status!=='hidden').sort((a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999')));

    const other=await idbGetAll('commonOtherItems');
    state.otherItems=other.filter(x=>x.status!=='hidden').sort((a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999')));

    const metaRows=await idbGetAll('commonMeta');
    const publish=metaRows.find(x=>x.key==='publish');
    if(!publish){
      state.commonMeta={version:1,updatedAt:'2026-10-02T20:00:00+09:00',summary:'3rdシングル発売記念イベント一覧が公開されました'};
      await idbPut('commonMeta',{key:'publish',...state.commonMeta});
    }else{
      if(Number(publish.version||0) < 2){
        state.commonMeta={version:2,updatedAt:'2026-10-02T20:00:00+09:00',summary:'3rdシングル発売記念イベント情報を10/2公式更新内容に合わせました'};
        await idbPut('commonMeta',{key:'publish',...state.commonMeta});
      }else{
        state.commonMeta={version:Number(publish.version||0),updatedAt:publish.updatedAt||null,summary:publish.summary||null};
      }
    }
    state.commonHistory=await idbGetAll('commonHistory');
  }

  async function initData(){
    state.db = await openDB();
    await restoreEmergencyBackupIfNeeded();
    await syncPublishedCommonData();
    await loadCommonData();
    const plans=IS_VIEW_BUILD?[]:await idbGetAll('userEventPlans');
    state.userPlans=Object.fromEntries(plans.filter(p=>!p.deleted).map(p=>[p.eventId,p]));
    const settings=await idbGetAll('settings');
    state.hadStoredSettings=settings.length>0;
    for(const row of settings) state.settings[row.key]=row.value;
    if(IS_VIEW_BUILD) state.settings.mode='view_only';
    applyFontSize(state.settings.fontSize||'standard');
    if(state.settings.rememberEventFilter && state.settings.lastEventFilter) state.eventFilter=state.settings.lastEventFilter;

    const todos=IS_VIEW_BUILD?[]:await idbGetAll('todos');
    state.todos=todos.filter(t=>!t.deleted);

    const schedules=IS_VIEW_BUILD?[]:await idbGetAll('personalSchedules');
    state.personalSchedules=schedules.filter(x=>!x.deleted);

    const travel=IS_VIEW_BUILD?[]:await idbGetAll('travelBookings');
    state.travelBookings=travel.filter(x=>!x.deleted);

    let setlists=IS_VIEW_BUILD?[]:await idbGetAll('setlists');
    if(!IS_VIEW_BUILD && !setlists.length && initialSetlists.length){
      for(const row of initialSetlists) await idbPut('setlists',row);
      setlists=structuredClone(initialSetlists);
    }
    state.setlists=setlists.filter(x=>!x.deleted);

    let talkMemos=IS_VIEW_BUILD?[]:await idbGetAll('talkMemos');
    if(!IS_VIEW_BUILD && !talkMemos.length && initialTalkMemos.length){
      for(const row of initialTalkMemos) await idbPut('talkMemos',row);
      talkMemos=structuredClone(initialTalkMemos);
    }
    state.talkMemos=talkMemos.filter(x=>!x.deleted);
    scheduleEmergencyBackup();
  }

  function applyFontSize(size){
    const allowed=['small','standard','large','xlarge'];
    const value=allowed.includes(size)?size:'standard';
    document.documentElement.dataset.fontSize=value;
  }

  async function saveSetting(key,value){
    state.settings[key]=value;
    if(key==='fontSize') applyFontSize(value);
    await idbPut('settings',{key,value});
  }

  async function savePlan(eventId,patch){
    const now=new Date().toISOString();
    const current=state.userPlans[eventId] || {eventId,participationStatus:'unset',cdQuantity:null,parts:{},createdAt:now,revision:0,deleted:false};
    const next={...current,...patch, updatedAt:now, revision:(current.revision||0)+1};
    state.userPlans[eventId]=next;
    await idbPut('userEventPlans',next);
    showToast('✓ 保存しました');
  }


  function uid(prefix='id'){
    if(globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  }

  async function saveTodo(todo, toast=true){
    const now=new Date().toISOString();
    const existing=state.todos.find(t=>t.id===todo.id);
    const next={
      id:todo.id||uid('todo'), title:'', eventId:null, dueDate:null, dueTime:null, memo:null,
      completed:false, completedAt:null, showOnCalendar:true, createdBy:'manual', sortOrder:Date.now(),
      createdAt:existing?.createdAt||now, revision:(existing?.revision||0)+1, deleted:false,
      ...existing, ...todo, updatedAt:now
    };
    await idbPut('todos',next);
    state.todos=state.todos.filter(t=>t.id!==next.id);
    if(!next.deleted) state.todos.push(next);
    if(toast) showToast('✓ TODOを保存しました');
    return next;
  }

  async function savePersonalSchedule(item, toast=true){
    const now=new Date().toISOString();
    const existing=state.personalSchedules.find(x=>x.id===item.id);
    const next={id:item.id||uid('schedule'),eventId:null,date:fmtISODate(currentDate()),time:null,title:'',memo:null,createdAt:existing?.createdAt||now,revision:(existing?.revision||0)+1,deleted:false,...existing,...item,updatedAt:now};
    await idbPut('personalSchedules',next);
    state.personalSchedules=state.personalSchedules.filter(x=>x.id!==next.id);
    if(!next.deleted) state.personalSchedules.push(next);
    if(toast) showToast('✓ 予定を保存しました');
    return next;
  }

  async function saveTravelBooking(item, toast=true){
    const now=new Date().toISOString();
    const existing=state.travelBookings.find(x=>x.id===item.id);
    const next={
      id:item.id||uid('travel'), eventId:null, type:'other', direction:'none', title:'',
      date:null, startTime:null, endDate:null, endTime:null, from:null, to:null, seat:null,
      bookingSite:null, bookingCode:null, reservedOn:null, partySize:null, cost:null, paymentStatus:'unset',
      bookingStatus:'unset', paymentDue:null, freeCancelUntil:null, url:null, notes:null,
      images:[], createdAt:existing?.createdAt||now, revision:(existing?.revision||0)+1, deleted:false,
      ...existing, ...item, updatedAt:now
    };
    await idbPut('travelBookings',next);
    state.travelBookings=state.travelBookings.filter(x=>x.id!==next.id);
    if(!next.deleted) state.travelBookings.push(next);
    if(toast) showToast('✓ 旅程を保存しました');
    return next;
  }


  async function saveSetlist(eventId,partId,titles,source='manual',toast=true){
    const now=new Date().toISOString();
    const id=`${eventId}::${partId}`;
    const existing=state.setlists.find(x=>x.id===id);
    const clean=(titles||[]).map(x=>String(x||'').trim()).filter(Boolean);
    const next={
      id,eventId,partId,
      songs:clean.map((title,i)=>({id:existing?.songs?.[i]?.id||uid('song'),order:i+1,title})),
      source,
      createdAt:existing?.createdAt||now,
      updatedAt:now,
      revision:(existing?.revision||0)+1,
      deleted:false
    };
    await idbPut('setlists',next);
    state.setlists=state.setlists.filter(x=>x.id!==id);
    state.setlists.push(next);
    if(toast) showToast('✓ セトリを保存しました');
    return next;
  }

  function setlistFor(eventId,partId){
    return state.setlists.find(x=>!x.deleted&&x.eventId===eventId&&x.partId===partId) || null;
  }

  function setlistFilledCount(eventId){
    return state.setlists.filter(x=>!x.deleted&&x.eventId===eventId&&(x.songs||[]).length).length;
  }

  function dateObj(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
  const jpWeek=['日','月','火','水','木','金','土'];
  function fmtDate(s, withYear=false){
    const d=dateObj(s); return `${withYear? d.getFullYear()+'/' : ''}${d.getMonth()+1}/${d.getDate()}(${jpWeek[d.getDay()]})`;
  }
  function fmtMoney(n){ return n==null?'未発表':`¥${Number(n).toLocaleString('ja-JP')}`; }
  function statusText(s){ return ({confirmed:'✅参加確定',maybe:'🩷まーちゃんに会いたくなるかも',not_attending:'－不参加',unset:'未設定'})[s||'unset']; }
  function commonStatusBadge(s){
    if(s==='cancelled') return '<span class="common-status cancelled">中止</span>';
    if(s==='ended') return '<span class="common-status ended">終了</span>';
    return '';
  }
  function shippingText(sh){
    if(!sh) return '未発表';
    if(sh.type==='paid') return fmtMoney(sh.amount);
    if(sh.type==='free') return '無料';
    if(sh.type==='not_listed') return '記載なし';
    return '未発表';
  }
  function stationText(ev){
    if(!ev.nearestStations?.length) return '最寄駅 未発表';
    const s=ev.nearestStations[0]; return `${s.name}${s.walkMinutes!=null?` 徒歩${s.walkMinutes}分`:''}`;
  }

  async function saveTalkMemo(item, toast=true){
    const now=new Date().toISOString();
    const existing=state.talkMemos.find(x=>x.id===item.id);
    const next={
      id:item.id||uid('talk'), eventId:null, partId:null, text:'', completed:false,
      ...existing, ...item,
      createdAt:existing?.createdAt||now, updatedAt:now, revision:(existing?.revision||0)+1,
      deleted:false
    };
    await idbPut('talkMemos',next);
    state.talkMemos=state.talkMemos.filter(x=>x.id!==next.id);
    if(!next.deleted) state.talkMemos.push(next);
    if(toast) showToast('✓ メモを保存しました');
    return next;
  }

  function talkMemosForEvent(eventId){
    return state.talkMemos.filter(x=>!x.deleted && x.eventId===eventId).sort((a,b)=>{
      const pa=String(a.partId||'zzz'), pb=String(b.partId||'zzz');
      return pa.localeCompare(pb)||String(a.createdAt||'').localeCompare(String(b.createdAt||''));
    });
  }

  function currentDate(){
    if(IS_TEST_MODE && state.settings.previewDate) return dateObj(state.settings.previewDate);
    return new Date();
  }
  function dayDiff(a,b){ return Math.round((dateObj(a)-new Date(b.getFullYear(),b.getMonth(),b.getDate()))/86400000); }

  function userPlanForEvent(ev){
    if(!ev) return {};
    const direct=state.userPlans[ev.id];
    if(direct && !direct.deleted) return direct;

    // If the same official event was recreated in the admin screen after storage loss,
    // its random id may differ from the id stored in personal data.
    // For release events, safely fall back to the original seeded event on the same date/prefecture.
    const seed=seededOfficialEvents.find(s=>s.date===ev.date && s.prefecture===ev.prefecture);
    if(seed){
      const seededPlan=state.userPlans[seed.id];
      if(seededPlan && !seededPlan.deleted) return seededPlan;
    }

    // Legacy release ids include YYYYMMDD. Use this only when there is one unambiguous match.
    const token=String(ev.date||'').replace(/-/g,'');
    if(token){
      const matches=Object.values(state.userPlans).filter(p=>!p.deleted && String(p.eventId||'').includes(token));
      if(matches.length===1) return matches[0];
    }
    return {};
  }

  function filteredEvents(){
    let arr=[...officialEvents];
    const f=state.eventFilter;
    if(f!=='all') arr=arr.filter(ev=>(userPlanForEvent(ev).participationStatus||'unset')===f);
    arr.sort((a,b)=>a.date.localeCompare(b.date));
    return arr;
  }

  function homeEventCandidates(){
    let arr=[...officialEvents];
    const mode=state.settings.homeEventFilter||'all';
    if(mode==='exclude_not_attending') arr=arr.filter(e=>(state.userPlans[e.id]?.participationStatus||'unset')!=='not_attending');
    if(mode==='confirmed_only') arr=arr.filter(e=>(state.userPlans[e.id]?.participationStatus||'unset')==='confirmed');
    const today=currentDate();
    return arr.filter(e=>dayDiff(e.date,today)>=0).sort((a,b)=>a.date.localeCompare(b.date));
  }

  function homeMode(ev){
    const diff=dayDiff(ev.date,currentDate());
    if(diff===0) return 'today'; if(diff===1) return 'tomorrow'; return 'normal';
  }

  function homePresentationMode(ev){
    // Display mode must match the app's effective date exactly.
    // previewDate is only a TEST override for currentDate(); it must not remap TODAY/NEXT.
    return homeMode(ev);
  }

  function nextItem(ev){
    const parts=ev.parts||[];
    const items=[];
    if(ev.salesStart) items.push({time:ev.salesStart,title:'CD販売開始'});
    for(const p of parts){
      if(p.priorityMeetTime) items.push({time:p.priorityMeetTime,title:`${p.label} 優先エリア集合`});
      if(p.startTime) items.push({time:p.startTime,title:`${p.label} 開始`});
    }
    if(state.settings.mode!=='view_only') {
      state.personalSchedules.filter(x=>!x.deleted && x.date===ev.date && x.time).forEach(x=>items.push({time:x.time,title:x.title||'予定'}));
      state.travelBookings
        .filter(x=>!x.deleted && x.eventId===ev.id && x.date===ev.date && x.startTime)
        .forEach(x=>items.push({time:x.startTime,title:`旅程：${travelDisplayTitle(x)}`}));
    }
    items.sort((a,b)=>a.time.localeCompare(b.time));
    if(!items.length) return null;
    const now=currentDate();
    if(fmtISODate(now)!==ev.date) return items[0]||null;
    const hhmm=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    return items.find(x=>x.time>=hhmm)||null;
  }
  function fmtISODate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

  function render(){
    if(state.screen==='detail') renderDetail();
    else if(state.screen==='home') renderHome();
    else if(state.screen==='events') renderEvents();
    else if(state.screen==='schedule') renderSchedule();
    else if(state.screen==='travel') renderTravel();
    else if(state.screen==='summary') renderSummary();
    else if(state.screen==='settings') renderSettings();
    else renderPlaceholder(state.screen);
  }

  function renderHome(){
    const candidates=homeEventCandidates();
    const effectiveToday=fmtISODate(currentDate());
    const todayEvents=officialEvents.filter(e=>e.date===effectiveToday);
    const ev=(todayEvents.find(e=>userPlanForEvent(e).participationStatus==='confirmed')||todayEvents[0]||candidates[0]||officialEvents[0]);
    const plan=userPlanForEvent(ev);
    const mode=homePresentationMode(ev);
    const next=nextItem(ev);
    const headerStyle=state.settings.headerImage?`style="background-image:url('${state.settings.headerImage.replace(/'/g,"%27")}')"`:'';
    const headerClass=state.settings.headerImage?'home-hero has-image':'home-hero';
    const parts=ev.parts||[];
    app.innerHTML=`
      <main class="screen">
        <header class="${headerClass}" ${headerStyle}>
          <div class="home-hero-inner">
            <div class="hero-top">
              <div class="brand-block"><div class="brand">MaaNote</div><div class="brand-sub">まーちゃん 3rd Single${IS_VIEW_BUILD?' · VIEW':''}</div></div>
              <div class="hero-actions">
                ${IS_VIEW_BUILD?'':`<button class="icon-btn" data-action="quick-add" aria-label="追加">${icon('plus')}</button>`}
                <button class="icon-btn" data-action="settings" aria-label="設定">${icon('settings')}</button>
              </div>
            </div>
          </div>
        </header>
        <div class="content home-content">
          ${homeEventCard(ev,plan,mode,next,parts)}
          ${state.settings.mode!=='view_only'?homePersonalSection(ev,mode):''}
          ${renderCommonNotice()}
        </div>
      </main>
      ${tabbar('home')}
    `;
    bindCommon();
  }

  function renderCommonNotice(){
    const version=Number(state.commonMeta?.version||0);
    const seen=Number(state.settings.lastSeenCommonVersion||0);
    const fresh=version>seen;
    const summary=state.commonMeta?.summary||'管理者からのお知らせがあります。';
    return `<section class="card section-card common-notice ${fresh?'fresh':''}">
      <div class="section-title-row"><div class="section-title">📢 ${fresh?'新しい情報':'お知らせ'}</div><span class="small muted">配信 v${version||'—'}</span></div>
      <div class="small">${escapeHTML(summary)}</div>
      ${fresh?`<button class="notice-ack" data-common-ack>確認済みにする</button>`:''}
    </section>`;
  }

  function homeEventCard(ev,plan,mode,next,parts){
    const management=state.settings.mode!=='view_only';
    const kicker=mode==='today'?'TODAY':mode==='tomorrow'?'TOMORROW':'NEXT EVENT';
    const confirmed=plan.participationStatus==='confirmed';
    const limitText=ev.purchaseLimit?.count?`${ev.purchaseLimit.count}枚/1会計`:'未発表';
    return `<section class="card event-hero-card" data-open-event="${ev.id}">
      <div class="event-head">
        <div class="event-kicker">${kicker}</div>
        <div class="event-date-row">
          <div class="event-date">${fmtDate(ev.date)}　${ev.prefecture} ${commonStatusBadge(ev.status)}</div>
          ${management?`<span class="status-badge ${plan.participationStatus||'unset'}">${statusText(plan.participationStatus)}</span>`:''}
        </div>
      </div>
      <div class="venue-name">${escapeHTML(ev.venue||'会場未発表')}</div>
      ${ev.venueDetail?`<div class="venue-detail">${escapeHTML(ev.venueDetail)}</div>`:''}
      <button class="map-row" data-map="${escapeAttr(ev.venue+' '+stationText(ev))}">${icon('pin')}<span>${stationText(ev)}</span><span class="chev">›</span></button>
      ${next && (mode==='today'||mode==='tomorrow')?`<div class="next-panel"><div class="next-label">NEXT</div><div class="next-line"><span class="next-time">${next.time}</span><span class="next-title">${next.title}</span></div></div>`:''}
      <div class="info-strip"><span>販売 <strong>${ev.salesStart||'未発表'}</strong></span><span>送料 <strong>${shippingText(ev.shipping)}</strong></span><span>上限 <strong>${limitText}</strong></span></div>
      ${management && (confirmed || mode==='today') && parts.length ? userCompact(plan,parts) : parts.length?`<div class="small muted part-summary">${parts.map(p=>`${p.label} ${p.startTime}`).join(' ｜ ')}</div>`:`<div class="small muted part-summary">各部詳細：未発表</div>`}
      ${management?`<div class="home-shortcuts"><button class="shortcut-btn" data-open-setlist="${ev.id}">${icon('list')} セトリ${setlistFilledCount(ev.id)?` ${setlistFilledCount(ev.id)}部`:''}</button><button class="shortcut-btn" data-home-travel="${ev.id}">${icon('luggage')} 旅程</button></div>`:''}
    </section>`;
  }

  function userCompact(plan,parts){
    return `<div class="home-cd-line"><span>CD購入</span><strong>${plan.cdQuantity??0}枚</strong></div>
      <div class="compact-table">
        <div class="tr"><div class="td">部</div><div class="td">開催</div><div class="td">集合</div><div class="td">トーク券</div><div class="td">優先</div></div>
        ${parts.map(p=>{const u=plan.parts?.[p.id]||{}; return `<div class="tr"><div class="td">${p.label}</div><div class="td">${p.startTime||'—'}</div><div class="td">${p.priorityMeetTime||'—'}</div><div class="td">${u.talkTicketQuantity??'—'}枚</div><div class="td">${u.priorityNumber??'—'}</div></div>`}).join('')}
      </div>`;
  }

  function renderEvents(){
    const list=filteredEvents();
    const otherList=state.otherItems.filter(x=>x.status!=='hidden');
    app.innerHTML=`<main class="screen">
      ${simpleTopbar('イベント')}
      <div class="segment-wrap">
        <div class="segment"><button data-category="release" class="${state.eventCategoryTab==='release'?'active':''}">3rd Single</button><button data-category="other" class="${state.eventCategoryTab==='other'?'active':''}">その他</button></div>
      </div>
      <div class="content">
        ${state.eventCategoryTab==='release'?`<div class="filter-scroll">
          ${[['all','すべて'],['confirmed','参加確定'],['maybe','会いたくなるかも'],['not_attending','不参加']].map(([k,l])=>`<button class="filter-chip ${state.eventFilter===k?'active':''}" data-filter="${k}">${l}</button>`).join('')}
        </div>`:''}
        ${state.eventCategoryTab==='release'?`<div class="event-list">${list.map(eventCard).join('')||'<div class="empty-state">該当するイベントはありません。</div>'}</div>`:`<div class="other-list">${otherList.map(otherItemCard).join('')||'<div class="card empty-state">その他の情報はまだありません。</div>'}</div>`}
      </div>
    </main>${tabbar('events')}`;
    bindCommon();
    document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=async()=>{state.eventFilter=b.dataset.filter;if(state.settings.rememberEventFilter)await saveSetting('lastEventFilter',state.eventFilter);renderEvents();});
    document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{state.eventCategoryTab=b.dataset.category;renderEvents();});
  }

  function otherItemCard(item){
    const labels={live:'LIVE',fc:'FC EVENT',radio:'RADIO',limista:'LIMISTA',tv_web:'TV・WEB',release:'RELEASE',other:'OTHER'};
    const status=item.status==='cancelled'?'中止':item.status==='ended'?'終了':'';
    return `<article class="card other-card">
      <div class="other-card-top"><span class="other-kind">${labels[item.category]||'OTHER'}</span><span class="small muted">${item.date?fmtDate(item.date,true):'日付未発表'}${item.time?` ${item.time}`:''}</span></div>
      <div class="other-title">${escapeHTML(item.title||'タイトル未入力')} ${status?`<span class="status-inline">${status}</span>`:''}</div>
      ${item.place?`<div class="small muted">📍 ${escapeHTML(item.place)}</div>`:''}
      ${item.note?`<div class="other-note">${escapeHTML(item.note)}</div>`:''}
      ${item.officialUrl?`<a class="official-mini-link" data-online-link href="${escapeAttr(item.officialUrl)}" target="_blank" rel="noopener">公式情報を確認 ›</a>`:''}
    </article>`;
  }

  function eventCard(ev){
    const plan=userPlanForEvent(ev);
    const confirmed=plan.participationStatus==='confirmed';
    return `<button class="event-card ${confirmed?'confirmed':''}" data-open-event="${ev.id}">
      <div class="event-card-top"><div class="event-card-date">${fmtDate(ev.date)}　${ev.prefecture} ${commonStatusBadge(ev.status)}</div>${state.settings.mode!=='view_only'?`<span class="status-badge ${plan.participationStatus||'unset'}">${statusText(plan.participationStatus)}</span>`:''}</div>
      <div class="event-card-venue">${ev.venue}</div>
      <div class="event-card-map">${icon('pin')} ${stationText(ev)} <span class="chev">›</span></div>
      <div class="event-card-info"><span>販売 ${ev.salesStart||'未発表'}</span><span>送料 ${shippingText(ev.shipping)}</span><span>上限 ${ev.purchaseLimit?.count?ev.purchaseLimit.count+'枚/1会計':'未発表'}</span></div>
      ${ev.parts.length?`<div class="part-lines">${ev.parts.map(p=>{const u=plan.parts?.[p.id]||{};return `<div class="part-line"><span class="pname">${p.label}</span><span>${p.startTime}</span><span>集${p.priorityMeetTime||'—'}</span><span>${confirmed?`トーク${u.talkTicketQuantity??'—'}枚`:''}</span><span>${confirmed&&u.priorityNumber!=null?'#'+u.priorityNumber:''}</span></div>`}).join('')}</div>`:'<div class="part-lines"><div class="muted">各部詳細：未発表</div></div>'}
      ${confirmed?`<div class="event-card-foot"><span>CD ${plan.cdQuantity??0}枚</span><span>${travelCountForEvent(ev.id)?`🧳旅程 ${travelCountForEvent(ev.id)}件`:'🧳旅程なし'}</span></div>`:''}
    </button>`;
  }

  function renderDetail(){
    const ev=officialEvents.find(x=>x.id===state.detailEventId) || officialEvents[0];
    const plan=userPlanForEvent(ev);
    app.innerHTML=`<main class="screen">
      <header class="topbar"><div class="topbar-inner"><button data-action="close-detail" aria-label="閉じる">${icon('close')}</button><div class="topbar-title">イベント詳細</div><button data-action="edit-day" aria-label="当日情報を編集">${icon('edit')}</button></div></header>
      <div class="detail-wrap">
        <div class="detail-summary"><div class="detail-date">${fmtDate(ev.date,true)}　${ev.prefecture} ${commonStatusBadge(ev.status)}</div><div class="detail-venue">${ev.venue}</div><div class="detail-place">${icon('pin')} ${stationText(ev)}</div></div>
        ${IS_VIEW_BUILD?'':`<div class="detail-tabs"><div class="segment"><button data-detail-tab="official" class="${state.detailTab==='official'?'active':''}">公式情報</button><button data-detail-tab="day" class="${state.detailTab==='day'?'active':''}">当日</button><button data-detail-tab="travel" class="${state.detailTab==='travel'?'active':''}">旅程</button></div></div>`}
        ${detailBody(ev,plan)}
      </div>
      ${detailPager(ev)}
    </main>${tabbar('events')}`;
    bindCommon();
    document.querySelector('[data-action="close-detail"]').onclick=()=>{state.screen='events';renderEvents(); requestAnimationFrame(()=>window.scrollTo(0,state.lastEventScroll));};
    document.querySelector('[data-action="edit-day"]').onclick=()=>{state.detailTab='day';renderDetail();setTimeout(()=>openDayEditSheet(ev.id),40)};
    document.querySelectorAll('[data-detail-tab]').forEach(b=>b.onclick=()=>{state.detailTab=b.dataset.detailTab;renderDetail();});
    document.querySelectorAll('[data-status]').forEach(b=>b.onclick=async()=>{await savePlan(ev.id,{participationStatus:b.dataset.status});renderDetail();});
    const cdInput=document.querySelector('[data-cd-quantity-input]');
    if(cdInput){
      const persistCd=async()=>{
        const value=numOrNull(cdInput.value);
        await savePlan(ev.id,{cdQuantity:value});
        cdInput.value=value??'';
      };
      cdInput.addEventListener('change',persistCd);
      cdInput.addEventListener('blur',persistCd);
    }
    document.querySelectorAll('[data-edit-part]').forEach(b=>b.onclick=()=>openPartEditSheet(ev.id,b.dataset.editPart));
    const prev=document.querySelector('[data-page-prev]'), next=document.querySelector('[data-page-next]');
    if(prev) prev.onclick=()=>openAdjacent(-1);
    if(next) next.onclick=()=>openAdjacent(1);
  }

  function detailBody(ev,plan){
    if(state.detailTab==='official') return officialTab(ev);
    if(state.detailTab==='day') return dayTab(ev,plan);
    return travelTab(ev);
  }

  function officialTab(ev){
    return `<section class="card section-card">
      <div class="section-title-row"><div class="section-title">公式情報</div>${ev.sampleDetail?'<span class="test-ribbon">詳細は画面確認用</span>':''}</div>
      <div class="info-list">
        ${infoRow('開催日',fmtDate(ev.date,true))}
        ${infoRow('会場',ev.venue)}
        ${infoRow('会場内場所',ev.venueDetail)}
        ${infoRow('最寄駅',stationText(ev))}
        ${infoRow('販売開始',ev.salesStart)}
        ${infoRow('送料',shippingText(ev.shipping), shippingText(ev.shipping)==='未発表')}
        ${infoRow('購入上限',ev.purchaseLimit?.count?`${ev.purchaseLimit.count}枚/1会計`:'未発表',!ev.purchaseLimit)}
      </div>
    </section>
    <section class="card section-card">
      <div class="section-title">各部</div>
      <div class="parts-official" style="margin-top:8px">
        <div class="row"><div class="cell">部</div><div class="cell">開催</div><div class="cell">優先集合</div></div>
        ${ev.parts.length?ev.parts.map(p=>`<div class="row"><div class="cell">${p.label}</div><div class="cell">${p.startTime||'未発表'}</div><div class="cell">${p.priorityMeetTime||'未発表'}</div></div>`).join(''):`<div class="row"><div class="cell" style="grid-column:1/-1;color:#8A9694">詳細未発表</div></div>`}
      </div>
    </section>
    <section class="card section-card">
      <a class="official-link" data-online-link href="${ev.officialUrl}" target="_blank" rel="noopener">公式ページを確認 ${icon('external')}</a>
      <div class="small muted" style="margin-top:8px">管理者最終更新：${new Date(ev.updatedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
    </section>
    <div class="disclaimer">MaaNoteは非公式のファン向けアプリです。内容の反映・訂正に時間がかかる場合があります。参加前には必ず公式サイト・公式SNS等で最新情報をご確認ください。</div>`;
  }
  function infoRow(label,value,unset=false){ const v=value??'未発表'; return `<div class="info-row"><div class="info-label">${label}</div><div class="info-value ${unset||v==='未発表'?'unset':''}">${v}</div></div>`; }

  function dayTab(ev,plan){
    if(state.settings.mode==='view_only') return `<section class="card section-card"><div class="placeholder-screen" style="min-height:220px"><div><strong>見るだけモード</strong>参加状況・CD・トーク券・優先番号は非表示です。設定から「自分の予定も管理する」に切り替えられます。</div></div></section>`;
    const confirmed=plan.participationStatus==='confirmed';
    return `<div class="day-panel">
      <section class="card section-card">
        <div class="section-title">参加状況</div>
        <div class="status-selector" style="margin-top:8px">
          ${[['confirmed','✅ 参加確定'],['maybe','🩷 まーちゃんに会いたくなるかも'],['not_attending','－ 不参加']].map(([k,l])=>`<button class="status-option ${plan.participationStatus===k?'active':''}" data-status="${k}"><span class="radio"></span><span>${l}</span></button>`).join('')}
        </div>
      </section>
      ${confirmed?`<section class="card section-card"><div class="quick-value"><div class="quick-value-label">CD購入枚数</div><div class="cd-quantity-entry"><input class="edit-pill cd-quantity-input" inputmode="numeric" pattern="[0-9]*" aria-label="CD購入枚数" value="${plan.cdQuantity??''}" placeholder="0" data-cd-quantity-input><span>枚</span></div></div></section>
      <section class="card section-card">
        <div class="section-title-row"><div class="section-title">各部</div><span class="small muted">自動保存</span></div>
        <div class="user-part-table">
          <div class="row"><div class="cell">部</div><div class="cell">開催</div><div class="cell">集合</div><div class="cell">トーク券</div><div class="cell">優先</div></div>
          ${ev.parts.length?ev.parts.map(p=>{const u=plan.parts?.[p.id]||{};return `<div class="row"><div class="cell"><strong>${p.label}</strong></div><div class="cell">${p.startTime||'—'}</div><div class="cell">${p.priorityMeetTime||'—'}</div><div class="cell"><button class="edit-pill" data-edit-part="${p.id}">${u.talkTicketQuantity??'未入力'}</button></div><div class="cell"><button class="edit-pill" data-edit-part="${p.id}">${u.priorityNumber??'未入力'}</button></div></div>`}).join(''):`<div class="row"><div class="cell" style="grid-column:1/-1">部情報が未発表です</div></div>`}
        </div>
      </section>`:`<section class="card section-card"><div class="small muted">参加確定にすると、CD購入枚数・各部のトーク券・優先番号を入力できます。</div></section>`}
      <section class="card section-card setlist-entry-card">
        <button class="setlist-entry-button" data-open-setlist="${ev.id}"><span class="setlist-entry-icon">🎵</span><span class="setlist-entry-main"><strong>セトリ</strong><small>${setlistFilledCount(ev.id)?`${setlistFilledCount(ev.id)}部 入力済み`:'まだ入力されていません'}</small></span><span class="chev">›</span></button>
      </section>
      ${talkMemoEntry(ev)}
    </div>`;
  }


  function talkMemoEntry(ev){
    const rows=talkMemosForEvent(ev.id); const done=rows.filter(x=>x.completed).length;
    if(!rows.length){
      return `<section class="talk-memo-inline"><button class="talk-memo-empty" data-open-talk-memos="${ev.id}">＋ 話したいことメモ</button></section>`;
    }
    return `<section class="card section-card setlist-entry-card"><button class="setlist-entry-button" data-open-talk-memos="${ev.id}"><span class="setlist-entry-icon talk">💬</span><span class="setlist-entry-main"><strong>話したいこと</strong><small>${rows.length}件${done?` · ${done}件 話した`:''}</small></span><span class="chev">›</span></button></section>`;
  }

  function partLabelForMemo(ev,partId){
    if(!partId) return '部指定なし';
    return ev.parts?.find(p=>p.id===partId)?.label || '部指定なし';
  }

  function openTalkMemoSheet(eventId){
    const ev=officialEvents.find(x=>x.id===eventId); if(!ev)return;
    const rows=talkMemosForEvent(eventId);
    showSheet(`<div class="sheet-head"><div class="sheet-title">話したいことメモ</div><button class="text-btn" data-sheet-close>閉じる</button></div>
      <div class="talk-memo-context"><strong>${fmtDate(ev.date)} ${escapeHTML(ev.prefecture)}</strong><span>${escapeHTML(ev.venue)}</span></div>
      <div class="talk-memo-list">${rows.length?rows.map(m=>`<div class="talk-memo-row ${m.completed?'completed':''}"><button class="talk-check" data-toggle-talk="${m.id}" aria-label="話した切替">${m.completed?'✓':''}</button><button class="talk-main" data-edit-talk="${m.id}"><span>${escapeHTML(m.text)}</span><small>${escapeHTML(partLabelForMemo(ev,m.partId))}</small></button><button class="talk-delete" data-delete-talk="${m.id}" aria-label="削除">×</button></div>`).join(''):`<div class="talk-memo-empty-state">まだメモはありません。<br>当日話したいことを短く残せます。</div>`}</div>
      <button class="sheet-card-btn primary full-width-btn" data-add-talk>＋ メモを追加</button>
      <div class="form-help">メモは端末へ保存され、オフラインでも使えます。使わない場合はイベント画面で目立たない表示にしています。</div>`);
    sheetRoot.querySelector('[data-add-talk]').onclick=()=>openTalkMemoEditSheet(eventId,null,ev.parts?.[0]?.id||null);
    sheetRoot.querySelectorAll('[data-edit-talk]').forEach(b=>b.onclick=()=>openTalkMemoEditSheet(eventId,b.dataset.editTalk));
    sheetRoot.querySelectorAll('[data-toggle-talk]').forEach(b=>b.onclick=async()=>{const m=state.talkMemos.find(x=>x.id===b.dataset.toggleTalk);if(!m)return;await saveTalkMemo({...m,completed:!m.completed},false);openTalkMemoSheet(eventId);});
    sheetRoot.querySelectorAll('[data-delete-talk]').forEach(b=>b.onclick=async()=>{const m=state.talkMemos.find(x=>x.id===b.dataset.deleteTalk);if(!m)return;if(!confirm('このメモを削除しますか？'))return;await idbPut('talkMemos',{...m,deleted:true,deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revision:(m.revision||0)+1});state.talkMemos=state.talkMemos.filter(x=>x.id!==m.id);openTalkMemoSheet(eventId);});
  }

  function openTalkMemoEditSheet(eventId,id=null,presetPartId=null){
    const ev=officialEvents.find(x=>x.id===eventId); if(!ev)return;
    const existing=id?state.talkMemos.find(x=>x.id===id):null;
    const draft={id:existing?.id||uid('talk'),eventId,partId:existing?.partId??presetPartId,text:existing?.text||'',completed:!!existing?.completed};
    showSheet(`<div class="sheet-head"><button class="text-btn" data-talk-back>‹ 戻る</button><div class="sheet-title">${existing?'メモを編集':'メモを追加'}</div><button class="text-btn" data-talk-done>完了</button></div>
      <div class="form-group"><label class="form-label">関連する部</label><select class="form-select" data-talk-part><option value="" ${!draft.partId?'selected':''}>部指定なし</option>${(ev.parts||[]).map(p=>`<option value="${p.id}" ${draft.partId===p.id?'selected':''}>${escapeHTML(p.label)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">内容</label><textarea class="form-input form-textarea example-input talk-editor" data-example="例：新曲の○○について聞きたい" placeholder="例：新曲の○○について聞きたい" data-talk-text>${escapeHTML(draft.text)}</textarea></div>
      <label class="toggle-row"><span><strong>話した</strong><small>終わった内容にチェックできます</small></span><input type="checkbox" data-talk-completed ${draft.completed?'checked':''}></label>
      ${existing?'<button class="danger-btn full-width-btn" data-talk-delete>このメモを削除</button>':''}
      <div class="form-help">入力内容は自動保存です。入力例はタップすると消えます。</div>`);
    activateExampleInputs(sheetRoot);
    let saved=!!existing;
    const persist=async()=>{
      const text=sheetRoot.querySelector('[data-talk-text]').value.trim();
      if(!text)return null;
      const row=await saveTalkMemo({...draft,id:draft.id,eventId,partId:sheetRoot.querySelector('[data-talk-part]').value||null,text,completed:sheetRoot.querySelector('[data-talk-completed]').checked},false);
      saved=true; return row;
    };
    sheetRoot.querySelector('[data-talk-text]').addEventListener('change',persist);
    sheetRoot.querySelector('[data-talk-part]').addEventListener('change',persist);
    sheetRoot.querySelector('[data-talk-completed]').addEventListener('change',persist);
    sheetRoot.querySelector('[data-talk-back]').onclick=async()=>{await persist();openTalkMemoSheet(eventId);};
    sheetRoot.querySelector('[data-talk-done]').onclick=async()=>{await persist();openTalkMemoSheet(eventId);};
    const del=sheetRoot.querySelector('[data-talk-delete]'); if(del)del.onclick=async()=>{if(!confirm('このメモを削除しますか？'))return;const m=state.talkMemos.find(x=>x.id===draft.id);if(m){await idbPut('talkMemos',{...m,deleted:true,deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revision:(m.revision||0)+1});state.talkMemos=state.talkMemos.filter(x=>x.id!==m.id);}openTalkMemoSheet(eventId);};
  }

  function detailPager(ev){
    const list=filteredEvents(); const idx=list.findIndex(x=>x.id===ev.id);
    return `<div class="detail-pager"><div class="detail-pager-inner"><button data-page-prev ${idx<=0?'disabled':''}>◀ 前のイベント</button><button data-page-next ${idx<0||idx>=list.length-1?'disabled':''}>次のイベント ▶</button></div></div>`;
  }
  function openAdjacent(delta){
    const list=filteredEvents(); const idx=list.findIndex(x=>x.id===state.detailEventId); const next=list[idx+delta]; if(!next)return;
    state.detailEventId=next.id; renderDetail(); window.scrollTo(0,0);
  }

  async function handleStep(eventId,btn){
    const delta=Number(btn.dataset.delta||0); const kind=btn.dataset.step;
    const p=state.userPlans[eventId]||{};
    if(kind==='cd') await savePlan(eventId,{cdQuantity:Math.max(0,(p.cdQuantity||0)+delta)});
    renderDetail();
  }

  function openDayEditSheet(eventId){
    const ev=officialEvents.find(e=>e.id===eventId); const plan=state.userPlans[eventId]||{};
    showSheet(`<div class="sheet-head"><div class="sheet-title">当日情報を編集</div><button class="text-btn" data-sheet-close>完了</button></div>
      <div class="form-group"><label class="form-label">CD購入枚数</label><input class="form-input example-input" inputmode="numeric" data-example="例：8" placeholder="例：8" value="${plan.cdQuantity??''}" data-sheet-cd></div>
      <div class="form-help">変更は入力後すぐ端末に保存します。</div>
      ${ev.parts.map(p=>{const u=plan.parts?.[p.id]||{};return `<div class="card section-card" style="margin-top:10px"><div class="section-title">${p.label}</div><div class="form-group"><label class="form-label">トーク券</label><input class="form-input example-input" inputmode="numeric" data-example="例：3" placeholder="例：3" value="${u.talkTicketQuantity??''}" data-sheet-talk="${p.id}"></div><div class="form-group"><label class="form-label">優先番号</label><input class="form-input example-input" inputmode="numeric" data-example="例：108" placeholder="例：108" value="${u.priorityNumber??''}" data-sheet-priority="${p.id}"></div><div class="form-help">優先番号は数字のみ入力。</div></div>`}).join('')}`);
    activateExampleInputs(sheetRoot);
    sheetRoot.querySelector('[data-sheet-cd]').addEventListener('change',async e=>{await savePlan(eventId,{cdQuantity:numOrNull(e.target.value)});});
    sheetRoot.querySelectorAll('[data-sheet-talk]').forEach(el=>el.addEventListener('change',async e=>await updatePartField(eventId,e.target.dataset.sheetTalk,'talkTicketQuantity',numOrNull(e.target.value))));
    sheetRoot.querySelectorAll('[data-sheet-priority]').forEach(el=>el.addEventListener('change',async e=>await updatePartField(eventId,e.target.dataset.sheetPriority,'priorityNumber',numOrNull(e.target.value))));
  }

  function openPartEditSheet(eventId,partId){
    const ev=officialEvents.find(e=>e.id===eventId); const part=ev.parts.find(p=>p.id===partId); const plan=state.userPlans[eventId]||{}; const u=plan.parts?.[partId]||{};
    showSheet(`<div class="sheet-head"><div class="sheet-title">${part.label}を編集</div><button class="text-btn" data-sheet-close>完了</button></div>
      <div class="form-group"><label class="form-label">トーク券</label><input class="form-input example-input" inputmode="numeric" data-example="例：3" placeholder="例：3" value="${u.talkTicketQuantity??''}" data-sheet-talk="${partId}"></div>
      <div class="form-group"><label class="form-label">優先番号</label><input class="form-input example-input" inputmode="numeric" data-example="例：108" placeholder="例：108" value="${u.priorityNumber??''}" data-sheet-priority="${partId}"></div><div class="form-help">優先番号は数字のみ入力。入力例はタップすると消え、未入力のまま離れると再表示されます。</div>`);
    activateExampleInputs(sheetRoot);
    sheetRoot.querySelector('[data-sheet-talk]').addEventListener('change',async e=>await updatePartField(eventId,partId,'talkTicketQuantity',numOrNull(e.target.value)));
    sheetRoot.querySelector('[data-sheet-priority]').addEventListener('change',async e=>await updatePartField(eventId,partId,'priorityNumber',numOrNull(e.target.value)));
  }

  async function updatePartField(eventId,partId,field,value){
    const p=state.userPlans[eventId]||{eventId,participationStatus:'confirmed',cdQuantity:null,parts:{}};
    const parts={...(p.parts||{})}; parts[partId]={...(parts[partId]||{}),[field]:value};
    await savePlan(eventId,{parts});
  }
  function numOrNull(v){ const t=String(v).trim(); if(!t)return null; const n=Number(t.replace(/,/g,'')); return Number.isFinite(n)?Math.max(0,Math.trunc(n)):null; }


  function homePersonalSection(ev,mode){
    const date=ev.date;
    const schedules=state.personalSchedules.filter(x=>!x.deleted && x.date===date).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
    const openTodos=state.todos.filter(t=>!t.deleted && !t.completed).sort(todoSort);
    const relevant=openTodos.filter(t=>t.eventId===ev.id || (t.dueDate && t.dueDate<=date)).slice(0,3);
    const travels=state.travelBookings.filter(x=>!x.deleted&&x.eventId===ev.id).sort(travelSort);
    if(mode==='today'){
      return `<section class="card section-card"><div class="section-title-row"><div class="section-title">📝 今日の予定</div><button class="mini-link" data-home-open-schedule>すべて見る ›</button></div>${schedules.length?schedules.slice(0,3).map(x=>`<button class="home-row-btn" data-edit-schedule="${x.id}"><span class="home-row-time">${x.time||'—'}</span><span>${escapeHTML(x.title)}</span><span class="chev">›</span></button>`).join(''):`<button class="home-empty-add" data-home-add-schedule>＋ 今日の予定を追加</button>`}${relevant.length?`<div class="home-subtitle">やること</div>${relevant.map(t=>homeTodoRow(t)).join('')}`:''}</section>`;
    }
    if(mode==='tomorrow'){
      return `<section class="card section-card"><div class="section-title-row"><div class="section-title">☑ 明日の準備</div><button class="mini-link" data-home-open-todo>TODOを見る ›</button></div>${travels.length?`<div class="home-subtitle" style="margin-top:0;padding-top:0;border-top:0">🧳 明日の旅程</div>${travels.slice(0,2).map(x=>`<button class="home-row-btn" data-edit-travel="${x.id}"><span class="home-row-time">${x.startTime||'—'}</span><span>${escapeHTML(travelDisplayTitle(x))}</span><span class="chev">›</span></button>`).join('')}`:''}${relevant.length?`<div class="home-subtitle">やること</div>${relevant.map(t=>homeTodoRow(t)).join('')}`:'<div class="small muted" style="margin-top:7px">明日までの未完了TODOはありません。</div>'}${schedules.length?`<div class="home-subtitle">明日の予定</div>${schedules.slice(0,2).map(x=>`<button class="home-row-btn" data-edit-schedule="${x.id}"><span class="home-row-time">${x.time||'—'}</span><span>${escapeHTML(x.title)}</span><span class="chev">›</span></button>`).join('')}`:''}</section>`;
    }
    return `<section class="card section-card"><div class="section-title-row"><div class="section-title">☑ TODO</div><button class="mini-link" data-home-open-todo>すべて見る ›</button></div>${openTodos.length?openTodos.slice(0,3).map(t=>homeTodoRow(t)).join(''):'<div class="small muted">未完了のTODOはありません。</div>'}</section>`;
  }

  function homeTodoRow(t){
    const overdue=t.dueDate && t.dueDate<fmtISODate(currentDate());
    return `<div class="home-row-btn todo-home-row"><button class="todo-check ${t.completed?'done':''}" data-toggle-todo="${t.id}" aria-label="完了切替">${t.completed?'✓':''}</button><button class="home-row-main" data-edit-todo="${t.id}"><span>${escapeHTML(t.title)}</span><small class="${overdue?'danger-text':''}">${todoDueLabel(t)}</small></button><span class="chev">›</span></div>`;
  }

  function todoSort(a,b){
    const ad=a.dueDate||'9999-99-99', bd=b.dueDate||'9999-99-99';
    if(ad!==bd) return ad.localeCompare(bd);
    return (a.dueTime||'99:99').localeCompare(b.dueTime||'99:99') || (a.sortOrder||0)-(b.sortOrder||0);
  }

  function todoDueLabel(t){
    if(!t.dueDate) return '期限なし';
    const today=fmtISODate(currentDate());
    if(t.dueDate===today) return t.dueTime?`今日 ${t.dueTime}まで`:'今日まで';
    const d=dayDiff(t.dueDate,currentDate());
    if(d===1) return t.dueTime?`明日 ${t.dueTime}まで`:'明日まで';
    if(d<0) return `${fmtDate(t.dueDate)} 期限超過`;
    return `${fmtDate(t.dueDate)}${t.dueTime?' '+t.dueTime:''}まで`;
  }

  function renderSchedule(){
    if(!state.calendarCursor){
      const base=currentDate();
      state.calendarCursor={year:base.getFullYear(),month:base.getMonth()+1};
    }
    const viewOnly=state.settings.mode==='view_only';
    if(viewOnly) state.scheduleTab='calendar';
    app.innerHTML=`<main class="screen">${simpleTopbar('予定')}
      ${!viewOnly?`<div class="segment-wrap"><div class="segment"><button data-schedule-tab="calendar" class="${state.scheduleTab==='calendar'?'active':''}">カレンダー</button><button data-schedule-tab="todo" class="${state.scheduleTab==='todo'?'active':''}">TODO</button></div></div>`:''}
      ${state.scheduleTab==='todo'&&!viewOnly?renderTodoPanel():renderCalendarPanel()}
    </main>${tabbar('schedule')}`;
    bindCommon(); bindSchedule();
  }

  function renderCalendarPanel(){
    const {year,month}=state.calendarCursor;
    return `<div class="segment-wrap compact-subsegment"><div class="segment"><button data-calendar-view="month" class="${state.calendarView==='month'?'active':''}">月表示</button><button data-calendar-view="list" class="${state.calendarView==='list'?'active':''}">リスト</button></div></div>
      <div class="content schedule-content">
        <div class="calendar-toolbar"><button data-month-shift="-1">‹</button><button class="calendar-month-label" data-month-today>${year}年${month}月</button><button data-month-shift="1">›</button></div>
        ${state.calendarView==='month'?renderMonthGrid(year,month):renderMonthList(year,month)}
        ${state.calendarView==='month'?`<section class="card section-card month-agenda"><div class="section-title-row"><div class="section-title">今月の予定</div>${state.settings.mode!=='view_only'?'<button class="mini-link" data-add-schedule>＋予定</button>':''}</div>${renderAgendaItems(monthEntries(year,month).slice(0,8),true)}</section>`:''}
      </div>`;
  }

  function monthEntries(year,month){
    const prefix=`${year}-${String(month).padStart(2,'0')}-`;
    const rows=[];
    officialEvents.filter(e=>e.date.startsWith(prefix)).forEach(e=>rows.push({kind:'event',date:e.date,time:e.parts?.[0]?.startTime||e.salesStart||null,title:eventCalendarLabel(e),eventId:e.id,icon:'🎤'}));
    if(state.settings.mode!=='view_only'){
      state.personalSchedules.filter(x=>!x.deleted && x.date?.startsWith(prefix)).forEach(x=>rows.push({kind:'schedule',date:x.date,time:x.time,title:x.title,id:x.id,eventId:x.eventId,icon:'📝'}));
      state.todos.filter(t=>!t.deleted && !t.completed && t.showOnCalendar && t.dueDate?.startsWith(prefix)).forEach(t=>rows.push({kind:'todo',date:t.dueDate,time:t.dueTime,title:t.title,id:t.id,eventId:t.eventId,icon:'☑'}));
      state.travelBookings.filter(x=>!x.deleted).forEach(x=>{
        if(x.date?.startsWith(prefix)) rows.push({kind:'travel',date:x.date,time:x.startTime,title:travelDisplayTitle(x),id:x.id,eventId:x.eventId,icon:travelIcon(x.type)});
        if(x.paymentDue?.startsWith(prefix)) rows.push({kind:'travel',date:x.paymentDue,time:null,title:`支払期限：${travelDisplayTitle(x)}`,id:x.id,eventId:x.eventId,icon:'⏰'});
        if(x.freeCancelUntil?.startsWith(prefix)) rows.push({kind:'travel',date:x.freeCancelUntil,time:null,title:`キャンセル期限：${travelDisplayTitle(x)}`,id:x.id,eventId:x.eventId,icon:'⏰'});
      });
    }
    const kindOrder={event:0,travel:1,schedule:2,todo:3};
    return rows.sort((a,b)=>a.date.localeCompare(b.date)||(kindOrder[a.kind]??9)-(kindOrder[b.kind]??9)||(a.time||'99:99').localeCompare(b.time||'99:99')||String(a.title||'').localeCompare(String(b.title||''),'ja'));
  }

  function nthWeekdayOfMonth(year,month,weekday,nth){
    const first=new Date(year,month-1,1).getDay();
    const offset=(7+weekday-first)%7;
    return 1+offset+(nth-1)*7;
  }

  function vernalEquinoxDay(year){
    return Math.floor(20.8431 + 0.242194 * (year - 1980)) - Math.floor((year - 1980) / 4);
  }

  function autumnEquinoxDay(year){
    return Math.floor(23.2488 + 0.242194 * (year - 1980)) - Math.floor((year - 1980) / 4);
  }

  function baseJapaneseHolidayName(year,month,day){
    if(month===1){
      if(day===1) return '元日';
      if(day===nthWeekdayOfMonth(year,1,1,2)) return '成人の日';
    }
    if(month===2){
      if(day===11) return '建国記念の日';
      if(year>=2020 && day===23) return '天皇誕生日';
    }
    if(month===3 && day===vernalEquinoxDay(year)) return '春分の日';
    if(month===4 && day===29) return '昭和の日';
    if(month===5){
      if(day===3) return '憲法記念日';
      if(day===4) return 'みどりの日';
      if(day===5) return 'こどもの日';
    }
    if(month===7 && day===nthWeekdayOfMonth(year,7,1,3)) return '海の日';
    if(month===8 && year>=2016 && day===11) return '山の日';
    if(month===9){
      if(day===nthWeekdayOfMonth(year,9,1,3)) return '敬老の日';
      if(day===autumnEquinoxDay(year)) return '秋分の日';
    }
    if(month===10 && day===nthWeekdayOfMonth(year,10,1,2)) return 'スポーツの日';
    if(month===11){
      if(day===3) return '文化の日';
      if(day===23) return '勤労感謝の日';
    }
    return null;
  }

  const japaneseHolidayCache=new Map();
  function getMonthHolidayMap(year,month){
    const key=`${year}-${month}`;
    if(japaneseHolidayCache.has(key)) return japaneseHolidayCache.get(key);
    const lastDay=new Date(year,month,0).getDate();
    const map=new Map();
    const toISO=(n)=>`${year}-${String(month).padStart(2,'0')}-${String(n).padStart(2,'0')}`;
    const addDays=(dateStr,offset)=>{ const dt=new Date(dateStr+'T00:00:00'); dt.setDate(dt.getDate()+offset); return fmtISODate(dt); };
    for(let day=1; day<=lastDay; day++){
      const name=baseJapaneseHolidayName(year,month,day);
      if(name) map.set(toISO(day),name);
    }
    const baseHolidayDates=[...map.keys()];
    baseHolidayDates.forEach(ds=>{
      if(new Date(ds+'T00:00:00').getDay()!==0) return;
      let probe=addDays(ds,1);
      while(map.has(probe)) probe=addDays(probe,1);
      if(probe.startsWith(`${year}-${String(month).padStart(2,'0')}-`)) map.set(probe,'振替休日');
    });
    for(let day=2; day<lastDay; day++){
      const ds=toISO(day);
      if(map.has(ds)) continue;
      const dow=new Date(ds+'T00:00:00').getDay();
      if(dow===0) continue;
      if(map.has(addDays(ds,-1)) && map.has(addDays(ds,1))) map.set(ds,'国民の休日');
    }
    japaneseHolidayCache.set(key,map);
    return map;
  }

  function getJapaneseHolidayName(dateStr){
    const [year,month]=dateStr.split('-').map(Number);
    return getMonthHolidayMap(year,month).get(dateStr)||null;
  }

  function eventCalendarLabel(ev){
    if(ev?.calendarLabel) return shorten(ev.calendarLabel,6);
    const venue=String(ev?.venue||'').trim();
    const placeRules=[
      [/幕張/,'幕張'],
      [/金沢/,'金沢'],
      [/錦糸町/,'錦糸町'],
      [/サッポロ|札幌/,'札幌'],
      [/名古屋/,'名古屋'],
      [/広島/,'広島'],
      [/博多/,'博多'],
      [/池袋|サンシャイン/,'池袋'],
      [/神戸/,'神戸']
    ];
    for(const [pattern,label] of placeRules){
      if(pattern.test(venue)) return label;
    }
    const compact=venue
      .replace(/イオンモール|タワーレコード|エアポートウォーク|キャナルシティ|サンシャインシティ|ハーバーランド|スペースシアター|噴水広場|パルコ店|フォーラス|店内イベントスペース|店/g,'')
      .replace(/[・\s]+/g,' ')
      .trim();
    return shorten(compact||ev?.prefecture||'イベント',6);
  }

  function renderMonthGrid(year,month){
    const first=new Date(year,month-1,1); const last=new Date(year,month,0); const start=first.getDay(); const days=last.getDate();
    const entries=monthEntries(year,month); const cells=[];
    const holidayMap=getMonthHolidayMap(year,month);
    for(let i=0;i<start;i++) cells.push('<div class="calendar-day outside"></div>');
    const today=fmtISODate(currentDate());
    for(let d=1;d<=days;d++){
      const ds=`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayEntries=entries.filter(x=>x.date===ds); const dow=new Date(year,month-1,d).getDay(); const holidayName=holidayMap.get(ds);
      const dayClass=`calendar-day ${ds===today?'today ':''}${holidayName?'holiday ':''}`.trim();
      const numClass=`day-num ${holidayName?'holiday':(dow===0?'sun':dow===6?'sat':'')}`.trim();
      const pills=dayEntries.slice(0,3).map(x=>{
        const body=x.kind==='event'?`★${escapeHTML(shorten(x.title,6))}`:`${x.icon} ${escapeHTML(shorten(x.title,8))}`;
        return `<span class="day-pill ${x.kind}">${body}</span>`;
      }).join('');
      const more=dayEntries.length>3?`<span class="day-more">＋${dayEntries.length-3}</span>`:'';
      const aria=`${year}年${month}月${d}日${holidayName?` ${holidayName}`:''}`;
      cells.push(`<button class="${dayClass}" data-day="${ds}" aria-label="${escapeAttr(aria)}"><span class="${numClass}">${d}</span><div class="day-items">${pills}${more}</div></button>`);
    }
    while(cells.length%7) cells.push('<div class="calendar-day outside"></div>');
    return `<div class="calendar-card card"><div class="week-head"><span class="sun">日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span class="sat">土</span></div><div class="calendar-grid">${cells.join('')}</div></div>`;
  }

  function renderMonthList(year,month){
    const entries=monthEntries(year,month);
    if(!entries.length) return '<div class="card empty-state">この月の予定はありません。</div>';
    const groups={}; entries.forEach(x=>(groups[x.date]??=[]).push(x));
    return `<div class="agenda-list">${Object.entries(groups).map(([date,items])=>`<section class="card agenda-day"><div class="agenda-date">${fmtDate(date)}</div>${renderAgendaItems(items,false)}</section>`).join('')}</div>`;
  }

  function renderAgendaItems(items,compact=false){
    if(!items.length) return '<div class="small muted">予定はありません。</div>';
    return `<div class="agenda-items">${items.map(x=>`<button class="agenda-row" ${x.kind==='event'?`data-open-event="${x.eventId}"`:x.kind==='todo'?`data-edit-todo="${x.id}"`:x.kind==='travel'?`data-edit-travel="${x.id}"`:`data-edit-schedule="${x.id}"`}><span class="agenda-icon">${x.icon}</span><span class="agenda-main"><strong>${escapeHTML(x.title)}</strong>${!compact?`<small>${x.time||'終日'}</small>`:''}</span>${compact?`<span class="agenda-meta">${fmtDate(x.date)}${x.time?' '+x.time:''}</span>`:''}<span class="chev">›</span></button>`).join('')}</div>`;
  }

  function renderTodoPanel(){
    const visible=state.todos.filter(t=>!t.deleted && (state.todoFilter==='done'?t.completed:!t.completed)).sort(todoSort);
    const selecting=state.todoSelection;
    return `<div class="content todo-content"><div class="todo-toolbar"><div class="filter-scroll todo-filters"><button class="filter-chip ${state.todoFilter==='open'?'active':''}" data-todo-filter="open">未完了 ${state.todos.filter(t=>!t.deleted&&!t.completed).length}</button><button class="filter-chip ${state.todoFilter==='done'?'active':''}" data-todo-filter="done">完了 ${state.todos.filter(t=>!t.deleted&&t.completed).length}</button></div><div class="todo-toolbar-actions"><button class="mini-btn" data-todo-select>${selecting?'終了':'選択'}</button><button class="add-round" data-add-todo aria-label="TODO追加">＋</button></div></div>
      ${selecting?`<div class="bulk-bar"><button data-select-all>全部選択</button><button data-select-done>完了だけ</button><button class="danger-btn" data-delete-selected>削除</button></div>`:''}
      <div class="todo-list">${visible.length?visible.map(todoRow).join(''):'<div class="card empty-state">該当するTODOはありません。<br><button class="inline-add" data-add-todo>＋ TODOを追加</button></div>'}</div></div>`;
  }

  function todoRow(t){
    const selected=state.selectedTodoIds.has(t.id); const overdue=!t.completed&&t.dueDate&&t.dueDate<fmtISODate(currentDate());
    return `<div class="card todo-row ${t.completed?'completed':''} ${selected?'selected':''}">${state.todoSelection?`<button class="select-circle ${selected?'on':''}" data-select-todo="${t.id}">${selected?'✓':''}</button>`:`<button class="todo-check ${t.completed?'done':''}" data-toggle-todo="${t.id}" aria-label="完了切替">${t.completed?'✓':''}</button>`}<button class="todo-row-main" data-edit-todo="${t.id}"><span class="todo-title">${escapeHTML(t.title)}</span><span class="todo-meta ${overdue?'danger-text':''}">${todoDueLabel(t)}${t.eventId?` · ${eventShort(t.eventId)}`:''}</span></button><span class="chev">›</span></div>`;
  }

  function eventShort(eventId){ const e=officialEvents.find(x=>x.id===eventId); return e?`${fmtDate(e.date).replace(/\(.+\)/,'')} ${e.prefecture}`:''; }

  function bindSchedule(){
    document.querySelectorAll('[data-schedule-tab]').forEach(b=>b.onclick=()=>{state.scheduleTab=b.dataset.scheduleTab;renderSchedule();});
    document.querySelectorAll('[data-calendar-view]').forEach(b=>b.onclick=()=>{state.calendarView=b.dataset.calendarView;renderSchedule();});
    document.querySelectorAll('[data-month-shift]').forEach(b=>b.onclick=()=>{let {year,month}=state.calendarCursor;month+=Number(b.dataset.monthShift);if(month<1){month=12;year--}if(month>12){month=1;year++}state.calendarCursor={year,month};renderSchedule();});
    document.querySelectorAll('[data-month-today]').forEach(b=>b.onclick=()=>{const d=currentDate();state.calendarCursor={year:d.getFullYear(),month:d.getMonth()+1};renderSchedule();});
    document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>openDaySheet(b.dataset.day));
    document.querySelectorAll('[data-add-todo]').forEach(b=>b.onclick=()=>openTodoEditSheet());
    document.querySelectorAll('[data-add-schedule]').forEach(b=>b.onclick=()=>openScheduleEditSheet());
    document.querySelectorAll('[data-todo-filter]').forEach(b=>b.onclick=()=>{state.todoFilter=b.dataset.todoFilter;state.selectedTodoIds.clear();renderSchedule();});
    document.querySelectorAll('[data-toggle-todo]').forEach(b=>b.onclick=async e=>{e.stopPropagation();await toggleTodo(b.dataset.toggleTodo);renderSchedule();});
    document.querySelectorAll('[data-edit-todo]').forEach(b=>b.onclick=()=>openTodoEditSheet(b.dataset.editTodo));
    document.querySelectorAll('[data-edit-schedule]').forEach(b=>b.onclick=()=>openScheduleEditSheet(b.dataset.editSchedule));
    document.querySelectorAll('[data-todo-select]').forEach(b=>b.onclick=()=>{state.todoSelection=!state.todoSelection;state.selectedTodoIds.clear();renderSchedule();});
    document.querySelectorAll('[data-select-todo]').forEach(b=>b.onclick=()=>{const id=b.dataset.selectTodo;if(state.selectedTodoIds.has(id))state.selectedTodoIds.delete(id);else state.selectedTodoIds.add(id);renderSchedule();});
    document.querySelectorAll('[data-select-all]').forEach(b=>b.onclick=()=>{state.todos.filter(t=>!t.deleted&&(state.todoFilter==='done'?t.completed:!t.completed)).forEach(t=>state.selectedTodoIds.add(t.id));renderSchedule();});
    document.querySelectorAll('[data-select-done]').forEach(b=>b.onclick=()=>{state.selectedTodoIds.clear();state.todos.filter(t=>!t.deleted&&t.completed).forEach(t=>state.selectedTodoIds.add(t.id));renderSchedule();});
    document.querySelectorAll('[data-delete-selected]').forEach(b=>b.onclick=bulkDeleteSelected);
  }

  async function toggleTodo(id){
    const t=state.todos.find(x=>x.id===id); if(!t)return;
    await saveTodo({...t,completed:!t.completed,completedAt:!t.completed?new Date().toISOString():null},false);
    showToast(!t.completed?'✓ 完了にしました':'未完了に戻しました');
  }

  async function bulkDeleteSelected(){
    if(!state.selectedTodoIds.size){showToast('削除するTODOを選択してください');return;}
    if(!confirm(`${state.selectedTodoIds.size}件のTODOを削除しますか？`)) return;
    for(const id of [...state.selectedTodoIds]){const t=state.todos.find(x=>x.id===id);if(t)await idbPut('todos',{...t,deleted:true,deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revision:(t.revision||0)+1});}
    state.todos=state.todos.filter(t=>!state.selectedTodoIds.has(t.id)); state.selectedTodoIds.clear(); state.todoSelection=false; showToast('削除しました'); renderSchedule();
  }

  function openTodoEditSheet(id=null,preset={}){
    const t=id?state.todos.find(x=>x.id===id):null; const draftId=t?.id||uid('todo'); const item={eventId:null,dueDate:null,dueTime:null,title:'',memo:'',showOnCalendar:true,...preset,...t};
    showSheet(`<div class="sheet-head"><div class="sheet-title">${t?'TODOを編集':'TODOを追加'}</div><button class="text-btn" data-sheet-close>完了</button></div>
      <div class="form-group"><label class="form-label">やること</label><input class="form-input example-input" data-example="例：モバイルバッテリーを充電" placeholder="例：モバイルバッテリーを充電" value="${escapeAttr(item.title||'')}" data-todo-title></div>
      <div class="form-grid-2"><div class="form-group"><label class="form-label">期限</label><input class="form-input" type="date" value="${item.dueDate||''}" data-todo-date></div><div class="form-group"><label class="form-label">時間</label><input class="form-input" type="time" value="${item.dueTime||''}" data-todo-time></div></div>
      <div class="form-group"><label class="form-label">関連イベント</label><select class="form-select" data-todo-event><option value="">なし</option>${officialEvents.map(e=>`<option value="${e.id}" ${item.eventId===e.id?'selected':''}>${fmtDate(e.date)} ${e.prefecture}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">メモ</label><textarea class="form-input form-textarea example-input" data-example="例：寝る前に確認" placeholder="例：寝る前に確認" data-todo-memo>${escapeHTML(item.memo||'')}</textarea></div>
      <label class="toggle-row"><span><strong>カレンダーに表示</strong><small>期限日がある場合に表示</small></span><input type="checkbox" data-todo-calendar ${item.showOnCalendar!==false?'checked':''}></label>
      ${t?'<button class="sheet-delete-btn" data-delete-todo>このTODOを削除</button>':''}
      <div class="form-help">入力内容は変更後すぐ端末に保存します。例の文字は入力データには含まれません。</div>`);
    activateExampleInputs(sheetRoot);
    const save=async()=>{
      const title=sheetRoot.querySelector('[data-todo-title]').value.trim(); if(!title)return;
      await saveTodo({...(t||{}),id:draftId,title,dueDate:sheetRoot.querySelector('[data-todo-date]').value||null,dueTime:sheetRoot.querySelector('[data-todo-time]').value||null,eventId:sheetRoot.querySelector('[data-todo-event]').value||null,memo:sheetRoot.querySelector('[data-todo-memo]').value.trim()||null,showOnCalendar:sheetRoot.querySelector('[data-todo-calendar]').checked},false);
    };
    sheetRoot.querySelectorAll('input,select,textarea').forEach(el=>el.addEventListener('change',save));
    const title=sheetRoot.querySelector('[data-todo-title]'); title.addEventListener('blur',async()=>{if(title.value.trim())await save();});
    const del=sheetRoot.querySelector('[data-delete-todo]'); if(del)del.onclick=async()=>{if(!confirm('このTODOを削除しますか？'))return;await idbPut('todos',{...t,deleted:true,deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revision:(t.revision||0)+1});state.todos=state.todos.filter(x=>x.id!==t.id);closeSheet();showToast('削除しました');renderSchedule();};
  }

  function openScheduleEditSheet(id=null,preset={}){
    const row=id?state.personalSchedules.find(x=>x.id===id):null; const draftId=row?.id||uid('schedule'); const item={date:fmtISODate(currentDate()),time:null,title:'',memo:'',eventId:null,...preset,...row};
    showSheet(`<div class="sheet-head"><div class="sheet-title">${row?'予定を編集':'予定を追加'}</div><button class="text-btn" data-sheet-close>完了</button></div>
      <div class="form-grid-2"><div class="form-group"><label class="form-label">日付</label><input class="form-input" type="date" value="${item.date||''}" data-schedule-date></div><div class="form-group"><label class="form-label">時間</label><input class="form-input" type="time" value="${item.time||''}" data-schedule-time></div></div>
      <div class="form-group"><label class="form-label">予定</label><input class="form-input example-input" data-example="例：○○ちゃんと入口で待ち合わせ" placeholder="例：○○ちゃんと入口で待ち合わせ" value="${escapeAttr(item.title||'')}" data-schedule-title></div>
      <div class="form-group"><label class="form-label">関連イベント</label><select class="form-select" data-schedule-event><option value="">なし</option>${officialEvents.map(e=>`<option value="${e.id}" ${item.eventId===e.id?'selected':''}>${fmtDate(e.date)} ${e.prefecture}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">メモ</label><textarea class="form-input form-textarea example-input" data-example="例：着いたらLINEする" placeholder="例：着いたらLINEする" data-schedule-memo>${escapeHTML(item.memo||'')}</textarea></div>
      ${row?'<button class="sheet-delete-btn" data-delete-schedule>この予定を削除</button>':''}
      <div class="form-help">当日の時間つき予定はホームのNEXT候補にも使われます。</div>`);
    activateExampleInputs(sheetRoot);
    const save=async()=>{const title=sheetRoot.querySelector('[data-schedule-title]').value.trim();if(!title)return;await savePersonalSchedule({...(row||{}),id:draftId,date:sheetRoot.querySelector('[data-schedule-date]').value||fmtISODate(currentDate()),time:sheetRoot.querySelector('[data-schedule-time]').value||null,title,eventId:sheetRoot.querySelector('[data-schedule-event]').value||null,memo:sheetRoot.querySelector('[data-schedule-memo]').value.trim()||null},false);};
    sheetRoot.querySelectorAll('input,select,textarea').forEach(el=>el.addEventListener('change',save));
    const title=sheetRoot.querySelector('[data-schedule-title]'); title.addEventListener('blur',async()=>{if(title.value.trim())await save();});
    const del=sheetRoot.querySelector('[data-delete-schedule]'); if(del)del.onclick=async()=>{if(!confirm('この予定を削除しますか？'))return;await idbPut('personalSchedules',{...row,deleted:true,deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revision:(row.revision||0)+1});state.personalSchedules=state.personalSchedules.filter(x=>x.id!==row.id);closeSheet();showToast('削除しました');renderSchedule();};
  }

  function openDaySheet(date){
    const entries=monthEntries(Number(date.slice(0,4)),Number(date.slice(5,7))).filter(x=>x.date===date);
    showSheet(`<div class="sheet-head"><div class="sheet-title">${fmtDate(date,true)}</div><button class="text-btn" data-sheet-close>閉じる</button></div>${renderAgendaItems(entries,false)}${state.settings.mode!=='view_only'?`<div class="sheet-actions-grid"><button class="sheet-card-btn primary" data-day-add-schedule>＋予定</button><button class="sheet-card-btn primary" data-day-add-todo>＋TODO</button></div>`:''}`);
    sheetRoot.querySelectorAll('[data-open-event]').forEach(b=>b.onclick=()=>{state.detailEventId=b.dataset.openEvent;state.screen='detail';closeSheet();renderDetail();});
    sheetRoot.querySelectorAll('[data-edit-todo]').forEach(b=>b.onclick=()=>openTodoEditSheet(b.dataset.editTodo));
    sheetRoot.querySelectorAll('[data-edit-schedule]').forEach(b=>b.onclick=()=>openScheduleEditSheet(b.dataset.editSchedule));
    sheetRoot.querySelectorAll('[data-edit-travel]').forEach(b=>b.onclick=()=>openTravelEditSheet(b.dataset.editTravel));
    const a=sheetRoot.querySelector('[data-day-add-schedule]'); if(a)a.onclick=()=>openScheduleEditSheet(null,{date});
    const t=sheetRoot.querySelector('[data-day-add-todo]'); if(t)t.onclick=()=>openTodoEditSheet(null,{dueDate:date});
  }


  function travelTypeLabel(type){
    return ({train:'新幹線・電車',flight:'飛行機',bus:'バス',car:'車・レンタカー',hotel:'宿泊',food:'食事',other:'その他',unclassified:'未整理'})[type]||'その他';
  }
  function travelDirectionLabel(direction){
    return ({outbound:'行き',return:'帰り',stay:'宿泊',none:'未設定'})[direction]||'未設定';
  }
  function travelIcon(type){
    return ({train:'🚄',flight:'✈️',bus:'🚌',car:'🚗',hotel:'🏨',food:'🍴',other:'🧳',unclassified:'📷'})[type]||'🧳';
  }
  function travelCountForEvent(eventId){
    return state.travelBookings.filter(x=>!x.deleted && x.eventId===eventId).length;
  }
  function travelDisplayTitle(x){
    const t=(x.title||'').trim();
    if(t) return t;
    if(x.type==='hotel') return '宿泊';
    if((x.images||[]).length && (!x.from&&!x.to&&!x.date)) return '予約画像（未整理）';
    return travelTypeLabel(x.type);
  }
  function travelRouteText(x){
    if(x.type==='hotel'){
      const span=x.date?`${fmtDate(x.date)}${x.startTime?' '+x.startTime:''}`:'日付未入力';
      const end=x.endDate?` → ${fmtDate(x.endDate)}${x.endTime?' '+x.endTime:''}`:'';
      return `${span}${end}`;
    }
    if(x.from||x.to) return `${x.from||'出発地未入力'} → ${x.to||'到着地未入力'}`;
    return x.date?`${fmtDate(x.date)}${x.startTime?' '+x.startTime:''}`:'日時未入力';
  }
  function travelDateTimeText(x){
    if(!x.date) return '日時未入力';
    const first=`${fmtDate(x.date)}${x.startTime?' '+x.startTime:''}`;
    if(x.endDate||x.endTime){
      const same=!x.endDate||x.endDate===x.date;
      return `${first} → ${same?'':fmtDate(x.endDate)+' '}${x.endTime||''}`.trim();
    }
    return first;
  }
  function travelStatusText(x){
    const b=({confirmed:'予約済',pending:'仮予約',cancelled:'キャンセル',unset:'未設定'})[x.bookingStatus||'unset'];
    const p=({paid:'支払済',unpaid:'未払い',pay_later:'現地/後払い',unset:'未設定'})[x.paymentStatus||'unset'];
    return `${b} · ${p}`;
  }
  function travelSort(a,b){
    const ad=a.date||'9999-99-99',bd=b.date||'9999-99-99';
    if(ad!==bd)return ad.localeCompare(bd);
    return (a.startTime||'99:99').localeCompare(b.startTime||'99:99') || travelDisplayTitle(a).localeCompare(travelDisplayTitle(b),'ja');
  }

  function renderTravel(){
    if(state.settings.mode==='view_only'){
      app.innerHTML=`<main class="screen travel-screen">${simpleTopbar('旅程')}<div class="content"><div class="card placeholder-screen"><div><strong>見るだけモード</strong>旅程は個人データのため非表示です。設定から「自分の予定も管理する」に切り替えると利用できます。</div></div></div></main>${tabbar('travel')}`;
      bindCommon(); return;
    }
    let list=state.travelBookings.filter(x=>!x.deleted);
    if(state.travelEventFilter) list=list.filter(x=>x.eventId===state.travelEventFilter);
    if(state.travelDirectionFilter!=='all') list=list.filter(x=>x.direction===state.travelDirectionFilter || (state.travelDirectionFilter==='stay'&&x.type==='hotel'));
    list.sort(travelSort);
    const contextEvent=officialEvents.find(e=>e.id===state.travelEventFilter);
    app.innerHTML=`<main class="screen">
      <header class="topbar"><div class="topbar-inner"><div></div><div class="topbar-title">旅程</div><button data-add-travel data-event-id="${state.travelEventFilter||''}" aria-label="旅程を追加">${icon('plus')}</button></div></header>
      <div class="content travel-content">
        ${contextEvent?`<section class="travel-context card"><div><strong>${fmtDate(contextEvent.date)} ${contextEvent.prefecture}</strong><small>${escapeHTML(contextEvent.venue)}</small></div><button data-travel-show-all>すべて表示</button></section>`:''}
        <div class="filter-scroll travel-filter-scroll">
          ${[['all','すべて'],['outbound','行き'],['stay','宿泊'],['return','帰り']].map(([k,l])=>`<button class="filter-chip ${state.travelDirectionFilter===k?'active':''}" data-travel-filter="${k}">${l}</button>`).join('')}
        </div>
        <div class="travel-list">${list.length?list.map(travelCard).join(''):`<div class="card empty-state">旅程はまだありません。<br><button class="inline-add" data-add-travel data-event-id="${state.travelEventFilter||''}">＋ 旅程を追加</button></div>`}</div>
        <div class="travel-privacy-note">予約画像はこのStageでは端末のIndexedDBに保存します。画像を追加しただけでは外部サービスへ送信しません。</div>
      </div>
    </main>${tabbar('travel')}`;
    bindCommon(); bindTravel();
  }

  function travelCard(x){
    const ev=officialEvents.find(e=>e.id===x.eventId);
    const images=(x.images||[]).length;
    const isImageOnly=images>0 && !x.startTime && !x.from && !x.to && !x.bookingSite && !x.bookingCode && (x.title==='予約画像'||x.type==='unclassified');
    return `<button class="card travel-card" data-edit-travel="${x.id}">
      <span class="travel-card-icon">${travelIcon(x.type)}</span>
      <span class="travel-card-main">
        <span class="travel-card-top"><strong>${escapeHTML(travelDisplayTitle(x))}</strong><span class="travel-type-badge">${travelDirectionLabel(x.direction)} · ${travelTypeLabel(x.type)}</span></span>
        <span class="travel-card-route">${escapeHTML(travelRouteText(x))}</span>
        <span class="travel-card-meta">${ev?`${fmtDate(ev.date).replace(/\(.+\)/,'')} ${ev.prefecture} · `:''}${travelStatusText(x)}${x.cost!=null?` · ${fmtMoney(x.cost)}`:''}</span>
        ${images?`<span class="travel-image-count">📷 ${images}枚${isImageOnly?' · 画像のみ':''}</span>`:''}
      </span>
      <span class="chev">›</span>
    </button>`;
  }

  function bindTravel(){
    document.querySelectorAll('[data-travel-filter]').forEach(b=>b.onclick=()=>{state.travelDirectionFilter=b.dataset.travelFilter;renderTravel();});
    document.querySelectorAll('[data-travel-show-all]').forEach(b=>b.onclick=()=>{state.travelEventFilter=null;renderTravel();});
  }

  function travelTab(ev){
    if(state.settings.mode==='view_only') return `<section class="card section-card"><div class="placeholder-screen" style="min-height:190px"><div><strong>見るだけモード</strong>旅程は個人データのため非表示です。</div></div></section>`;
    const list=state.travelBookings.filter(x=>!x.deleted&&x.eventId===ev.id).sort(travelSort);
    return `<section class="card section-card">
      <div class="section-title-row"><div class="section-title">旅程</div><button class="mini-link" data-add-travel data-event-id="${ev.id}">＋追加</button></div>
      ${list.length?`<div class="travel-detail-list">${list.map(travelCard).join('')}</div>`:`<div class="small muted">このイベントに紐づく旅程はありません。<br><button class="inline-add" data-add-travel data-event-id="${ev.id}">＋ 旅程を追加</button></div>`}
    </section><div class="travel-privacy-note">予約画像や予約番号などはユーザー個人データです。管理者配信データとは分離して保存します。</div>`;
  }

  function openTravelAddSheet(eventId=null){
    const ev=officialEvents.find(e=>e.id===eventId);
    showSheet(`<div class="sheet-head"><div class="sheet-title">旅程を追加</div><button class="text-btn" data-sheet-close>閉じる</button></div>
      ${ev?`<div class="form-help" style="margin-bottom:8px">${fmtDate(ev.date)} ${ev.prefecture} に紐付けて追加します。</div>`:''}
      <button class="travel-image-primary" data-travel-pick-first><span>📷</span><strong>予約画像を追加</strong><small>スクショだけでも保存できます</small></button>
      <input type="file" accept="image/*" multiple hidden data-travel-first-file>
      <div class="travel-or"><span>または</span></div>
      <button class="sheet-card-btn primary" style="width:100%" data-travel-manual>画像なしで手入力</button>
      <div class="form-help" style="margin-top:10px">画像を選んだだけでは外部AIへ送信しません。AI自動入力は後のバージョンで追加予定です。</div>`,'travel-sheet');
    const file=sheetRoot.querySelector('[data-travel-first-file]');
    sheetRoot.querySelector('[data-travel-pick-first]').onclick=()=>file.click();
    if(file)file.onchange=async()=>{
      if(!file.files?.length)return;
      showToast('画像を端末用に準備中…');
      const images=await readTravelImages(file.files);
      openTravelImageChoiceSheet(eventId,images);
    };
    sheetRoot.querySelector('[data-travel-manual]').onclick=()=>openTravelEditSheet(null,{eventId,date:ev?.date||null,type:'train',direction:'outbound'});
  }

  function openTravelImageChoiceSheet(eventId,images){
    const ev=officialEvents.find(e=>e.id===eventId);
    showSheet(`<div class="sheet-head"><div class="sheet-title">予約画像 ${images.length}枚</div><button class="text-btn" data-sheet-close>閉じる</button></div>
      <div class="travel-image-grid preview-grid">${images.map((img,i)=>`<div class="travel-thumb"><img src="${img.dataUrl}" alt="予約画像 ${i+1}"></div>`).join('')}</div>
      <div class="form-grid-2"><div class="form-group"><label class="form-label">種類（任意）</label><select class="form-select" data-image-only-type><option value="unclassified">未整理</option><option value="train">新幹線・電車</option><option value="flight">飛行機</option><option value="bus">バス</option><option value="car">車・レンタカー</option><option value="hotel">宿泊</option><option value="other">その他</option></select></div><div class="form-group"><label class="form-label">行き / 帰り（任意）</label><select class="form-select" data-image-only-dir><option value="none">未設定</option><option value="outbound">行き</option><option value="stay">宿泊</option><option value="return">帰り</option></select></div></div>
      <div class="sheet-actions-grid"><button class="sheet-card-btn primary" data-image-only-save>このまま保存</button><button class="sheet-card-btn primary" data-image-edit>内容も入力</button></div>
      <button class="sheet-card-btn travel-ai-disabled" disabled>画像から自動入力（v1.2予定）</button>
      <div class="form-help">「このまま保存」なら、画像をそのまま旅程として端末保存します。あとから内容を追記できます。</div>`,'travel-sheet');
    const make=()=>({eventId,type:sheetRoot.querySelector('[data-image-only-type]').value,direction:sheetRoot.querySelector('[data-image-only-dir]').value,title:'予約画像',date:ev?.date||null,images});
    sheetRoot.querySelector('[data-image-only-save]').onclick=async()=>{await saveTravelBooking(make());closeSheet();};
    sheetRoot.querySelector('[data-image-edit]').onclick=async()=>{const row=await saveTravelBooking(make(),false);openTravelEditSheet(row.id);};
  }

  function openTravelEditSheet(id=null,preset={}){
    const existing=id?state.travelBookings.find(x=>x.id===id):null;
    const linked=officialEvents.find(e=>e.id===(preset.eventId||existing?.eventId));
    const draftId=existing?.id||uid('travel');
    const item={id:draftId,eventId:null,type:'train',direction:'outbound',title:'',date:linked?.date||null,startTime:null,endDate:null,endTime:null,from:'',to:'',seat:'',bookingSite:'',bookingCode:'',reservedOn:null,partySize:null,cost:null,paymentStatus:'unset',bookingStatus:'unset',paymentDue:null,freeCancelUntil:null,url:'',notes:'',images:[],...preset,...existing};
    const transport=['train','flight','bus','car'].includes(item.type);
    const hotel=item.type==='hotel';
    showSheet(`<div class="sheet-head"><div class="sheet-title">${existing?'旅程を編集':'旅程を入力'}</div><button class="text-btn" data-sheet-close>完了</button></div>
      <div class="form-grid-2"><div class="form-group"><label class="form-label">種類</label><select class="form-select" data-travel-type><option value="train" ${item.type==='train'?'selected':''}>新幹線・電車</option><option value="flight" ${item.type==='flight'?'selected':''}>飛行機</option><option value="bus" ${item.type==='bus'?'selected':''}>バス</option><option value="car" ${item.type==='car'?'selected':''}>車・レンタカー</option><option value="hotel" ${item.type==='hotel'?'selected':''}>宿泊</option><option value="food" ${item.type==='food'?'selected':''}>食事</option><option value="other" ${item.type==='other'?'selected':''}>その他</option><option value="unclassified" ${item.type==='unclassified'?'selected':''}>未整理</option></select></div><div class="form-group"><label class="form-label">行き / 帰り</label><select class="form-select" data-travel-direction><option value="outbound" ${item.direction==='outbound'?'selected':''}>行き</option><option value="stay" ${item.direction==='stay'?'selected':''}>宿泊</option><option value="return" ${item.direction==='return'?'selected':''}>帰り</option><option value="none" ${item.direction==='none'?'selected':''}>未設定</option></select></div></div>
      <div class="form-group"><label class="form-label">関連イベント</label><select class="form-select" data-travel-event><option value="">なし</option>${officialEvents.map(e=>`<option value="${e.id}" ${item.eventId===e.id?'selected':''}>${fmtDate(e.date)} ${e.prefecture}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">タイトル</label><input class="form-input example-input" data-example="例：東京行き新幹線" placeholder="例：東京行き新幹線" value="${escapeAttr(item.title||'')}" data-travel-title></div>
      <div class="form-grid-2"><div class="form-group"><label class="form-label" data-travel-date-label>${hotel?'チェックイン日':'日付'}</label><input class="form-input" type="date" value="${item.date||''}" data-travel-date></div><div class="form-group"><label class="form-label" data-travel-start-label>${hotel?'チェックイン':'出発'}</label><input class="form-input" type="time" value="${item.startTime||''}" data-travel-start></div></div>
      <div class="form-grid-2"><div class="form-group"><label class="form-label" data-travel-enddate-label>${hotel?'チェックアウト日':'到着日'}</label><input class="form-input" type="date" value="${item.endDate||''}" data-travel-enddate></div><div class="form-group"><label class="form-label" data-travel-end-label>${hotel?'チェックアウト':'到着'}</label><input class="form-input" type="time" value="${item.endTime||''}" data-travel-end></div></div>
      <div data-transport-fields ${transport?'':'hidden'}><div class="form-grid-2"><div class="form-group"><label class="form-label">出発地</label><input class="form-input example-input" data-example="例：新大阪" placeholder="例：新大阪" value="${escapeAttr(item.from||'')}" data-travel-from></div><div class="form-group"><label class="form-label">到着地</label><input class="form-input example-input" data-example="例：東京" placeholder="例：東京" value="${escapeAttr(item.to||'')}" data-travel-to></div></div></div>
      <div class="form-group"><label class="form-label">座席 / 部屋 / クラス</label><input class="form-input example-input" data-example="例：12号車 8A / ツインルーム" placeholder="例：12号車 8A / ツインルーム" value="${escapeAttr(item.seat||'')}" data-travel-seat></div>
      <div class="form-grid-2"><div class="form-group"><label class="form-label">予約サイト</label><input class="form-input example-input" data-example="例：EX予約" placeholder="例：EX予約" value="${escapeAttr(item.bookingSite||'')}" data-travel-site></div><div class="form-group"><label class="form-label">予約番号</label><input class="form-input example-input" data-example="例：ABC123456" placeholder="例：ABC123456" value="${escapeAttr(item.bookingCode||'')}" data-travel-code></div></div>
      <div class="form-group"><label class="form-label">予約した日</label><input class="form-input" type="date" value="${item.reservedOn||''}" data-travel-reserved-on></div>
      <div class="form-grid-2"><div class="form-group"><label class="form-label">人数</label><input class="form-input example-input" inputmode="numeric" data-example="例：1" placeholder="例：1" value="${item.partySize??''}" data-travel-party></div><div class="form-group"><label class="form-label">料金</label><input class="form-input example-input" inputmode="numeric" data-example="例：14,720" placeholder="例：14,720" value="${item.cost??''}" data-travel-cost></div></div>
      <div class="form-grid-2"><div class="form-group"><label class="form-label">予約状態</label><select class="form-select" data-travel-booking-status><option value="unset" ${item.bookingStatus==='unset'?'selected':''}>未設定</option><option value="confirmed" ${item.bookingStatus==='confirmed'?'selected':''}>予約済</option><option value="pending" ${item.bookingStatus==='pending'?'selected':''}>仮予約</option><option value="cancelled" ${item.bookingStatus==='cancelled'?'selected':''}>キャンセル</option></select></div><div class="form-group"><label class="form-label">支払状態</label><select class="form-select" data-travel-payment-status><option value="unset" ${item.paymentStatus==='unset'?'selected':''}>未設定</option><option value="paid" ${item.paymentStatus==='paid'?'selected':''}>支払済</option><option value="unpaid" ${item.paymentStatus==='unpaid'?'selected':''}>未払い</option><option value="pay_later" ${item.paymentStatus==='pay_later'?'selected':''}>現地 / 後払い</option></select></div></div>
      <div class="form-grid-2"><div class="form-group"><label class="form-label">支払期限</label><input class="form-input" type="date" value="${item.paymentDue||''}" data-travel-payment-due></div><div class="form-group"><label class="form-label">無料キャンセル期限</label><input class="form-input" type="date" value="${item.freeCancelUntil||''}" data-travel-cancel></div></div>
      <div class="form-group"><label class="form-label">予約ページURL</label><input class="form-input example-input" inputmode="url" data-example="例：https://..." placeholder="例：https://..." value="${escapeAttr(item.url||'')}" data-travel-url></div>
      <div class="form-group"><label class="form-label">メモ</label><textarea class="form-input form-textarea example-input" data-example="例：東京駅で○○ちゃんと合流" placeholder="例：東京駅で○○ちゃんと合流" data-travel-notes>${escapeHTML(item.notes||'')}</textarea></div>
      <div class="form-group"><div class="section-title-row"><label class="form-label" style="margin:0">予約画像</label><button class="mini-link" data-add-travel-images>＋画像</button></div>${renderTravelImages(item)}<input type="file" accept="image/*" multiple hidden data-travel-image-file><div class="form-help">画像は複数保存できます。画像を削除しても、入力済みの旅程情報は残ります。</div></div>
      ${existing?'<button class="sheet-delete-btn" data-delete-travel>この旅程を削除</button>':''}
      <div class="form-help">入力内容は自動保存です。予約画像は現在端末内に保存し、外部AIには送信しません。</div>`,'travel-sheet');
    activateExampleInputs(sheetRoot);
    updateTravelFormVisibility();

    const collect=()=>({
      ...(existing||{}), id:draftId,
      type:sheetRoot.querySelector('[data-travel-type]').value,
      direction:sheetRoot.querySelector('[data-travel-direction]').value,
      eventId:sheetRoot.querySelector('[data-travel-event]').value||null,
      title:sheetRoot.querySelector('[data-travel-title]').value.trim(),
      date:sheetRoot.querySelector('[data-travel-date]').value||null,
      startTime:sheetRoot.querySelector('[data-travel-start]').value||null,
      endDate:sheetRoot.querySelector('[data-travel-enddate]').value||null,
      endTime:sheetRoot.querySelector('[data-travel-end]').value||null,
      from:sheetRoot.querySelector('[data-travel-from]')?.value.trim()||null,
      to:sheetRoot.querySelector('[data-travel-to]')?.value.trim()||null,
      seat:sheetRoot.querySelector('[data-travel-seat]')?.value.trim()||null,
      bookingSite:sheetRoot.querySelector('[data-travel-site]').value.trim()||null,
      bookingCode:sheetRoot.querySelector('[data-travel-code]').value.trim()||null,
      reservedOn:sheetRoot.querySelector('[data-travel-reserved-on]').value||null,
      partySize:numOrNull(sheetRoot.querySelector('[data-travel-party]').value),
      cost:numOrNull(sheetRoot.querySelector('[data-travel-cost]').value),
      bookingStatus:sheetRoot.querySelector('[data-travel-booking-status]').value,
      paymentStatus:sheetRoot.querySelector('[data-travel-payment-status]').value,
      paymentDue:sheetRoot.querySelector('[data-travel-payment-due]').value||null,
      freeCancelUntil:sheetRoot.querySelector('[data-travel-cancel]').value||null,
      url:sheetRoot.querySelector('[data-travel-url]').value.trim()||null,
      notes:sheetRoot.querySelector('[data-travel-notes]').value.trim()||null,
      images:item.images||[]
    });
    const save=async()=>{const row=collect();await saveTravelBooking(row,false);};
    sheetRoot.querySelectorAll('input:not([type="file"]),select:not([data-travel-type]),textarea').forEach(el=>el.addEventListener('change',save));
    sheetRoot.querySelector('[data-travel-type]').addEventListener('change',async()=>{updateTravelFormVisibility();await save();});
    sheetRoot.querySelectorAll('.example-input').forEach(el=>el.addEventListener('blur',async()=>{if(el.value.trim())await save();}));

    const file=sheetRoot.querySelector('[data-travel-image-file]');
    sheetRoot.querySelector('[data-add-travel-images]').onclick=()=>file.click();
    file.onchange=async()=>{
      if(!file.files?.length)return;
      showToast('画像を端末用に準備中…');
      const added=await readTravelImages(file.files);
      const row=collect(); row.images=[...(item.images||[]),...added];
      const saved=await saveTravelBooking(row,false); showToast('✓ 画像を保存しました'); openTravelEditSheet(saved.id);
    };
    sheetRoot.querySelectorAll('[data-delete-travel-image]').forEach(b=>b.onclick=async()=>{
      if(!confirm('この画像を削除しますか？'))return;
      const row=collect(); row.images=(row.images||[]).filter(img=>img.id!==b.dataset.deleteTravelImage);
      const saved=await saveTravelBooking(row,false); showToast('画像を削除しました'); openTravelEditSheet(saved.id);
    });
    sheetRoot.querySelectorAll('[data-view-travel-image]').forEach(b=>b.onclick=async()=>{const saved=await saveTravelBooking(collect(),false);openTravelImageViewer(saved.id,b.dataset.viewTravelImage);});
    const del=sheetRoot.querySelector('[data-delete-travel]');
    if(del)del.onclick=async()=>{
      if(!confirm('この旅程を削除しますか？予約画像もこの旅程から削除されます。'))return;
      const row=state.travelBookings.find(x=>x.id===draftId)||existing; if(!row)return;
      await idbPut('travelBookings',{...row,images:[],deleted:true,deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revision:(row.revision||0)+1});
      state.travelBookings=state.travelBookings.filter(x=>x.id!==draftId); closeSheet(); showToast('旅程を削除しました'); render();
    };
  }

  function updateTravelFormVisibility(){
    const type=sheetRoot.querySelector('[data-travel-type]')?.value;
    if(!type)return;
    const transport=['train','flight','bus','car'].includes(type);
    const hotel=type==='hotel';
    const group=sheetRoot.querySelector('[data-transport-fields]'); if(group)group.hidden=!transport;
    const dl=sheetRoot.querySelector('[data-travel-date-label]'); if(dl)dl.textContent=hotel?'チェックイン日':'日付';
    const sl=sheetRoot.querySelector('[data-travel-start-label]'); if(sl)sl.textContent=hotel?'チェックイン':'開始 / 出発';
    const ed=sheetRoot.querySelector('[data-travel-enddate-label]'); if(ed)ed.textContent=hotel?'チェックアウト日':'終了 / 到着日';
    const el=sheetRoot.querySelector('[data-travel-end-label]'); if(el)el.textContent=hotel?'チェックアウト':'終了 / 到着';
    const dir=sheetRoot.querySelector('[data-travel-direction]'); if(hotel&&dir&&dir.value==='outbound')dir.value='stay';
  }

  function renderTravelImages(item){
    const imgs=item.images||[];
    if(!imgs.length) return `<div class="travel-image-empty">画像はまだありません</div>`;
    return `<div class="travel-image-grid">${imgs.map((img,i)=>`<div class="travel-thumb"><button class="travel-thumb-open" data-view-travel-image="${img.id}" aria-label="画像を拡大"><img src="${img.dataUrl}" alt="予約画像 ${i+1}"></button><button class="travel-thumb-delete" data-delete-travel-image="${img.id}" aria-label="画像を削除">×</button></div>`).join('')}</div>`;
  }

  function openTravelImageViewer(bookingId,imageId){
    const row=state.travelBookings.find(x=>x.id===bookingId); const img=row?.images?.find(x=>x.id===imageId); if(!img)return;
    showSheet(`<div class="sheet-head"><div class="sheet-title">予約画像</div><button class="text-btn" data-image-view-close>戻る</button></div><div class="travel-image-viewer"><img src="${img.dataUrl}" alt="予約画像"></div><div class="form-help">画像は端末保存データです。</div>`,'travel-sheet');
    sheetRoot.querySelector('[data-image-view-close]').onclick=()=>openTravelEditSheet(bookingId);
  }

  async function readTravelImages(fileList){
    const files=[...fileList].slice(0,10); const result=[];
    for(const file of files){
      try{result.push({id:uid('img'),name:file.name||'予約画像',dataUrl:await resizeTravelImage(file),createdAt:new Date().toISOString()});}
      catch(err){console.warn('image resize failed',err);}
    }
    return result;
  }

  function resizeTravelImage(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader(); reader.onerror=reject;
      reader.onload=()=>{
        const img=new Image(); img.onerror=reject;
        img.onload=()=>{
          const quality=state.settings.imageQuality||'standard';
          const cfg=quality==='low'?{maxSide:1300,jpeg:.78}:quality==='high'?{maxSide:2400,jpeg:.94}:{maxSide:1900,jpeg:.88};
          const scale=Math.min(1,cfg.maxSide/Math.max(img.width,img.height));
          const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(img.width*scale)); canvas.height=Math.max(1,Math.round(img.height*scale));
          const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0,canvas.width,canvas.height);
          resolve(canvas.toDataURL('image/jpeg',cfg.jpeg));
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function shorten(s,n){ const arr=[...String(s||'')]; return arr.length>n?arr.slice(0,n).join('')+'…':arr.join(''); }
  function escapeHTML(s){ return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }


  function openSetlistSheet(eventId){
    const ev=officialEvents.find(x=>x.id===eventId); if(!ev)return;
    const parts=ev.parts||[];
    const rows=parts.map(part=>{
      const row=setlistFor(eventId,part.id); const songs=row?.songs||[];
      return `<div class="card section-card setlist-part-card">
        <div class="setlist-part-head"><div><strong>${escapeHTML(part.label)}</strong><small>${songs.length?`${songs.length}曲`:'未入力'}</small></div><button class="mini-btn" data-edit-setlist-part="${part.id}">${songs.length?'編集':'入力'}</button></div>
        ${songs.length?`<ol class="setlist-song-list">${songs.map(s=>`<li>${escapeHTML(s.title)}</li>`).join('')}</ol>`:`<button class="setlist-empty" data-edit-setlist-part="${part.id}">＋ ${escapeHTML(part.label)}のセトリを入力</button>`}
      </div>`;
    }).join('');
    showSheet(`<div class="sheet-head"><div class="sheet-title">🎵 セトリ</div><button class="text-btn" data-sheet-close>完了</button></div>
      <div class="setlist-event-title"><strong>${fmtDate(ev.date)} ${escapeHTML(ev.prefecture)}</strong><span>${escapeHTML(ev.venue)}</span></div>
      ${parts.length?rows:`<div class="card empty-state">各部の情報が未発表のため、セトリ入力はまだ利用できません。</div>`}
      ${parts.length?`<div class="setlist-actions"><button class="sheet-card-btn primary" data-import-setlist>テキストから取り込む</button><button class="sheet-card-btn" data-copy-setlist ${setlistFilledCount(eventId)?'':'disabled'}>共有用テキストをコピー</button></div>`:''}
      <div class="form-help">曲名と曲順だけを保存します。歌詞は入力しないでください。データは端末に保存され、オフラインでも確認できます。</div>`);
    sheetRoot.querySelectorAll('[data-edit-setlist-part]').forEach(b=>b.onclick=()=>openSetlistPartEditSheet(eventId,b.dataset.editSetlistPart));
    const imp=sheetRoot.querySelector('[data-import-setlist]'); if(imp)imp.onclick=()=>openSetlistImportSheet(eventId);
    const copy=sheetRoot.querySelector('[data-copy-setlist]'); if(copy)copy.onclick=()=>copySetlistShareText(eventId);
  }

  function openSetlistPartEditSheet(eventId,partId){
    const ev=officialEvents.find(x=>x.id===eventId); const part=ev?.parts?.find(x=>x.id===partId); if(!ev||!part)return;
    const current=setlistFor(eventId,partId); const titles=(current?.songs||[]).map(x=>x.title);
    const draft=titles.length?[...titles]:[''];
    const renderEditor=()=>{
      showSheet(`<div class="sheet-head"><div class="sheet-title">${escapeHTML(part.label)} セトリ</div><button class="text-btn" data-setlist-editor-done>完了</button></div>
        <div class="form-help" style="margin-top:0">入力例はタップすると消えます。空欄の曲は保存されません。</div>
        <div class="setlist-editor" data-setlist-editor>${draft.map((title,i)=>`<div class="setlist-edit-row"><span>${i+1}</span><input class="form-input example-input" data-example="例：曲名" placeholder="例：曲名" value="${escapeAttr(title)}" data-setlist-song="${i}"><button class="setlist-remove" data-remove-setlist-song="${i}" aria-label="曲を削除">×</button></div>`).join('')}</div>
        <button class="setlist-add-song" data-add-setlist-song>＋ 曲を追加</button>
        ${titles.length?`<button class="sheet-delete-btn" data-clear-setlist>この部のセトリをすべて削除</button>`:''}`);
      activateExampleInputs(sheetRoot);
      const syncDraft=()=>{sheetRoot.querySelectorAll('[data-setlist-song]').forEach(inp=>{draft[Number(inp.dataset.setlistSong)]=inp.value;});};
      sheetRoot.querySelectorAll('[data-setlist-song]').forEach(inp=>inp.addEventListener('blur',async()=>{syncDraft();await saveSetlist(eventId,partId,draft,'manual',false);}));
      sheetRoot.querySelectorAll('[data-remove-setlist-song]').forEach(b=>b.onclick=async()=>{syncDraft();draft.splice(Number(b.dataset.removeSetlistSong),1);if(!draft.length)draft.push('');await saveSetlist(eventId,partId,draft,'manual',false);renderEditor();});
      sheetRoot.querySelector('[data-add-setlist-song]').onclick=async()=>{syncDraft();draft.push('');await saveSetlist(eventId,partId,draft,'manual',false);renderEditor();requestAnimationFrame(()=>sheetRoot.querySelectorAll('[data-setlist-song]')[draft.length-1]?.focus());};
      sheetRoot.querySelector('[data-setlist-editor-done]').onclick=async()=>{syncDraft();await saveSetlist(eventId,partId,draft,'manual',false);openSetlistSheet(eventId);};
      const clear=sheetRoot.querySelector('[data-clear-setlist]'); if(clear)clear.onclick=async()=>{if(!confirm(`${part.label}のセトリをすべて削除しますか？`))return;draft.splice(0,draft.length,'');await saveSetlist(eventId,partId,[],'manual',false);showToast('セトリを削除しました');openSetlistSheet(eventId);};
    };
    renderEditor();
  }

  function openSetlistImportSheet(eventId){
    const ev=officialEvents.find(x=>x.id===eventId); if(!ev)return;
    showSheet(`<div class="sheet-head"><div class="sheet-title">セトリを貼り付け</div><button class="text-btn" data-import-back>戻る</button></div>
      <div class="form-group"><label class="form-label">対象</label><select class="form-select" data-setlist-import-target><option value="auto">部表記から自動判定</option>${ev.parts.map(p=>`<option value="${p.id}">${escapeHTML(p.label)}だけに取り込む</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">セトリテキスト</label><textarea class="form-input form-textarea setlist-paste example-input" data-example="例：\n■1部\n1. 曲名\n2. 曲名\n\n■2部\n1. 曲名" placeholder="例：\n■1部\n1. 曲名\n2. 曲名\n\n■2部\n1. 曲名" data-setlist-import-text></textarea></div>
      <button class="sheet-card-btn primary full-width-btn" data-setlist-parse>内容を確認</button>
      <div class="form-help">「■1部」「2部」などの部表記と、番号付き・番号なしの曲名に対応します。既存セトリがある場合は勝手に上書きせず、次の画面で比較して選べます。</div>`);
    activateExampleInputs(sheetRoot);
    sheetRoot.querySelector('[data-import-back]').onclick=()=>openSetlistSheet(eventId);
    sheetRoot.querySelector('[data-setlist-parse]').onclick=()=>{
      const text=sheetRoot.querySelector('[data-setlist-import-text]').value.trim();
      const target=sheetRoot.querySelector('[data-setlist-import-target]').value;
      if(!text){showToast('セトリを貼り付けてください');return;}
      const parsed=parseSetlistText(ev,text,target);
      if(parsed.error){showToast(parsed.error);return;}
      openSetlistImportConfirmSheet(eventId,parsed.parts);
    };
  }

  function parseSetlistText(ev,text,target='auto'){
    const lines=String(text).replace(/\r/g,'').split('\n');
    const result={};
    const partByNumber=new Map((ev.parts||[]).map(p=>{const m=String(p.label||'').match(/(\d+)\s*部/);return [m?m[1]:p.id,p];}));
    const cleanTitle=line=>String(line||'')
      .replace(/^\s*[■□◆◇●○▶▷▼▽★☆]+\s*/,'')
      .replace(/^\s*(?:\d+\s*[\.．、\)）:]|[①②③④⑤⑥⑦⑧⑨⑩]|[-・])\s*/,'')
      .trim();
    if(target!=='auto'){
      const part=ev.parts.find(p=>p.id===target); if(!part)return {error:'対象の部が見つかりません'};
      const songs=lines.map(cleanTitle).filter(Boolean).filter(x=>!/^第?\s*\d+\s*部\s*[:：]?$/.test(x));
      if(!songs.length)return {error:'曲名を読み取れませんでした'};
      result[part.id]=songs; return {parts:result};
    }
    let current=null;
    for(const raw of lines){
      const trimmed=raw.trim(); if(!trimmed)continue;
      const header=trimmed.match(/^[■□◆◇●○▶▷▼▽★☆\s]*第?\s*(\d+)\s*部(?:\s*[:：].*)?$/);
      if(header){
        const p=partByNumber.get(header[1]); current=p?.id||null;
        if(current && !result[current])result[current]=[];
        continue;
      }
      if(!current)continue;
      const title=cleanTitle(trimmed); if(title)result[current].push(title);
    }
    Object.keys(result).forEach(k=>{if(!result[k].length)delete result[k];});
    if(!Object.keys(result).length){
      if(ev.parts.length===1){const songs=lines.map(cleanTitle).filter(Boolean);if(songs.length)result[ev.parts[0].id]=songs;}
      if(!Object.keys(result).length)return {error:'部を判定できません。対象の部を選んで取り込んでください'};
    }
    return {parts:result};
  }

  function openSetlistImportConfirmSheet(eventId,partsMap){
    const ev=officialEvents.find(x=>x.id===eventId); if(!ev)return;
    const partIds=Object.keys(partsMap);
    showSheet(`<div class="sheet-head"><div class="sheet-title">取り込み内容を確認</div><button class="text-btn" data-import-cancel>戻る</button></div>
      <div class="setlist-compare-list">${partIds.map(partId=>{
        const part=ev.parts.find(p=>p.id===partId); const incoming=partsMap[partId]||[]; const existing=setlistFor(eventId,partId)?.songs||[];
        return `<div class="card section-card setlist-compare-card" data-import-part="${partId}"><div class="section-title-row"><div class="section-title">${escapeHTML(part?.label||partId)}</div><span class="small muted">${incoming.length}曲</span></div>
          ${existing.length?`<div class="compare-columns"><div><strong>現在</strong><ol>${existing.map(s=>`<li>${escapeHTML(s.title)}</li>`).join('')}</ol></div><div><strong>貼り付け</strong><ol>${incoming.map(t=>`<li>${escapeHTML(t)}</li>`).join('')}</ol></div></div><div class="import-choice"><label><input type="radio" name="import-${partId}" value="keep" checked> 現在を残す</label><label><input type="radio" name="import-${partId}" value="replace"> 貼り付け内容に置き換える</label></div>`:`<div class="incoming-only"><ol>${incoming.map(t=>`<li>${escapeHTML(t)}</li>`).join('')}</ol><input type="hidden" name="import-${partId}" value="replace"></div>`}
        </div>`;
      }).join('')}</div>
      <button class="sheet-card-btn primary full-width-btn" data-import-confirm>この内容で取り込む</button>
      <div class="form-help">既存データがある部は「現在を残す」が初期選択です。置き換える場合だけ明示的に選んでください。</div>`);
    sheetRoot.querySelector('[data-import-cancel]').onclick=()=>openSetlistImportSheet(eventId);
    sheetRoot.querySelector('[data-import-confirm]').onclick=async()=>{
      let changed=0;
      for(const partId of partIds){
        const radios=[...sheetRoot.querySelectorAll(`input[name="import-${partId}"]`)];
        const action=radios.find(x=>x.checked)?.value || radios[0]?.value || 'keep';
        if(action==='replace'){await saveSetlist(eventId,partId,partsMap[partId],'pasted',false);changed++;}
      }
      showToast(changed?`✓ ${changed}部のセトリを取り込みました`:'変更はありません');
      openSetlistSheet(eventId);
    };
  }

  function buildSetlistShareText(eventId){
    const ev=officialEvents.find(x=>x.id===eventId); if(!ev)return '';
    const blocks=[];
    for(const part of ev.parts||[]){
      const songs=setlistFor(eventId,part.id)?.songs||[]; if(!songs.length)continue;
      blocks.push(`■${part.label}\n${songs.map((s,i)=>`${i+1}. ${s.title}`).join('\n')}`);
    }
    if(!blocks.length)return '';
    return `${fmtDate(ev.date)} ${ev.prefecture}\n${ev.venue}\n\n${blocks.join('\n\n')}`;
  }

  async function copySetlistShareText(eventId){
    const text=buildSetlistShareText(eventId); if(!text){showToast('コピーできるセトリがありません');return;}
    try{
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);}
      else {const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}
      showToast('✓ 共有用テキストをコピーしました');
    }catch(_){showToast('コピーできませんでした');}
  }

  function summaryData(){
    const statusCounts={confirmed:0,maybe:0,not_attending:0,unset:0};
    let cdTotal=0, talkTotal=0;
    const partTotals=new Map();
    const eventRows=[];

    for(const ev of officialEvents){
      const plan=userPlanForEvent(ev);
      const status=plan.participationStatus||'unset';
      statusCounts[status]=(statusCounts[status]||0)+1;

      let eventCd=null, eventTalk=0;
      if(status==='confirmed'){
        if(Number.isFinite(Number(plan.cdQuantity)) && plan.cdQuantity!==null && plan.cdQuantity!==''){
          eventCd=Number(plan.cdQuantity);
          cdTotal+=eventCd;
        }
        for(const part of (ev.parts||[])){
          const qty=plan.parts?.[part.id]?.talkTicketQuantity;
          if(qty!==null && qty!==undefined && qty!=='' && Number.isFinite(Number(qty))){
            const n=Number(qty);
            eventTalk+=n;
            talkTotal+=n;
            const label=part.label||part.id;
            partTotals.set(label,(partTotals.get(label)||0)+n);
          }
        }
      }

      const eventTravel=state.travelBookings
        .filter(x=>!x.deleted && x.eventId===ev.id && x.bookingStatus!=='cancelled' && x.cost!==null && x.cost!==undefined && x.cost!=='' && Number.isFinite(Number(x.cost)))
        .reduce((sum,x)=>sum+Number(x.cost),0);

      const hasPersonal=status!=='unset' || eventCd!==null || eventTalk>0 || eventTravel>0;
      if(hasPersonal){
        eventRows.push({ev,plan,status,eventCd,eventTalk,eventTravel});
      }
    }

    const countedTravel=state.travelBookings.filter(x=>!x.deleted && x.bookingStatus!=='cancelled' && x.cost!==null && x.cost!==undefined && x.cost!=='' && Number.isFinite(Number(x.cost)));
    const travelTotal=countedTravel.reduce((sum,x)=>sum+Number(x.cost),0);
    const travelTypeTotals=new Map();
    for(const x of countedTravel){
      const key=x.type||'other';
      travelTypeTotals.set(key,(travelTypeTotals.get(key)||0)+Number(x.cost));
    }
    const unlinkedTravel=countedTravel.filter(x=>!x.eventId).reduce((sum,x)=>sum+Number(x.cost),0);

    return {statusCounts,cdTotal,talkTotal,partTotals,eventRows,travelTotal,travelTypeTotals,unlinkedTravel};
  }

  function renderSummary(){
    if(state.settings.mode==='view_only'){
      app.innerHTML=`<main class="screen">${simpleTopbar('集計')}<div class="content"><div class="card placeholder-screen"><div><strong>見るだけモード</strong>集計は個人データのため非表示です。設定から「自分の予定も管理する」に切り替えると利用できます。</div></div></div></main>${tabbar('summary')}`;
      bindCommon(); return;
    }
    const d=summaryData();
    const partRows=[...d.partTotals.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'ja',{numeric:true}));
    const travelRows=[...d.travelTypeTotals.entries()].sort((a,b)=>b[1]-a[1]);
    const statusMini=[
      ['confirmed','参加確定'],['maybe','会いたくなるかも'],['not_attending','不参加'],['unset','未設定']
    ];

    app.innerHTML=`<main class="screen">${simpleTopbar('集計')}
      <div class="content summary-content">
        <div class="test-note">端末に保存されている個人データから自動集計します。CD・トーク券は「参加確定」イベントの入力値を集計します。</div>

        <section class="summary-kpi-grid">
          <div class="card summary-kpi"><span>参加確定</span><strong>${d.statusCounts.confirmed}</strong><small>イベント</small></div>
          <div class="card summary-kpi"><span>CD</span><strong>${d.cdTotal.toLocaleString('ja-JP')}</strong><small>枚</small></div>
          <div class="card summary-kpi"><span>トーク券</span><strong>${d.talkTotal.toLocaleString('ja-JP')}</strong><small>枚</small></div>
        </section>

        <section class="card section-card">
          <div class="section-title-row"><div class="section-title">参加状況</div><span class="small muted">全 ${officialEvents.length}件</span></div>
          <div class="summary-status-grid">
            ${statusMini.map(([key,label])=>`<div class="summary-status-item ${key}"><span>${label}</span><strong>${d.statusCounts[key]||0}</strong></div>`).join('')}
          </div>
        </section>

        <section class="card section-card">
          <div class="section-title-row"><div class="section-title">トーク券 部別</div><span class="small muted">参加確定のみ</span></div>
          ${partRows.length?`<div class="summary-chip-list">${partRows.map(([label,total])=>`<div class="summary-chip"><span>${escapeHTML(label)}</span><strong>${total.toLocaleString('ja-JP')}枚</strong></div>`).join('')}</div>`:`<div class="summary-empty">トーク券の入力はまだありません</div>`}
        </section>

        <section class="card section-card summary-money-card">
          <div class="section-title-row">
            <div><div class="section-title">お金</div><div class="summary-money-sub">旅程に入力した金額をまとめて表示</div></div>
            <button class="summary-money-toggle" data-summary-money-toggle aria-expanded="${state.summaryMoneyVisible?'true':'false'}">${state.summaryMoneyVisible?'金額を隠す':'金額を見る'}</button>
          </div>
          ${state.summaryMoneyVisible?`
            <div class="summary-money-total"><span>合計</span><strong>${fmtMoney(d.travelTotal)}</strong></div>
            ${travelRows.length?`
              <div class="summary-money-heading">項目別</div>
              <div class="summary-cost-list">${travelRows.map(([type,total])=>`<div class="summary-cost-row"><span>${travelIcon(type)} ${travelTypeLabel(type)}</span><strong>${fmtMoney(total)}</strong></div>`).join('')}</div>
              <div class="summary-money-heading">イベント別</div>
              <div class="summary-money-event-list">
                ${d.eventRows.filter(r=>r.eventTravel>0).map(r=>`<div class="summary-money-event-row"><span><strong>${fmtDate(r.ev.date).replace(/\(.+\)/,'')} ${escapeHTML(r.ev.prefecture)}</strong><small>${escapeHTML(r.ev.venue)}</small></span><b>${fmtMoney(r.eventTravel)}</b></div>`).join('') || '<div class="summary-empty">イベントに紐づいた金額はありません</div>'}
              </div>
              ${d.unlinkedTravel?`<div class="summary-cost-note">イベント未紐付け分 ${fmtMoney(d.unlinkedTravel)} を含みます</div>`:''}
            `:`<div class="summary-empty">金額が入力された旅程はまだありません</div>`}
          `:`<div class="summary-money-hidden">金額は非表示です</div>`}
        </section>

        <section class="card section-card">
          <div class="section-title-row"><div class="section-title">イベント別 内訳</div><span class="small muted">タップで詳細</span></div>
          ${d.eventRows.length?`<div class="summary-event-list">${d.eventRows.map(r=>{
            const talkText=r.status==='confirmed'?`${r.eventTalk.toLocaleString('ja-JP')}枚`:'—';
            const cdText=r.status==='confirmed'?(r.eventCd===null?'未入力':`${r.eventCd.toLocaleString('ja-JP')}枚`):'—';
            return `<button class="summary-event-row" data-open-event="${r.ev.id}"><span class="summary-event-main"><strong>${fmtDate(r.ev.date)} ${escapeHTML(r.ev.prefecture)}</strong><small>${escapeHTML(r.ev.venue)}</small><em>${statusText(r.status)}</em></span><span class="summary-event-values"><span>CD <b>${cdText}</b></span><span>トーク <b>${talkText}</b></span></span><span class="chev">›</span></button>`;
          }).join('')}</div>`:`<div class="summary-empty">集計対象の個人データはまだありません</div>`}
        </section>

        <div class="summary-footnote">※ 金額は「お金」を開いたときだけ表示します。未入力項目は推測せず、旅程に入力された金額だけを合計します。</div>
      </div>
    </main>${tabbar('summary')}`;
    bindCommon();
    const moneyToggle=document.querySelector('[data-summary-money-toggle]');
    if(moneyToggle){
      moneyToggle.onclick=()=>{
        state.summaryMoneyVisible=!state.summaryMoneyVisible;
        renderSummary();
      };
    }
  }

  function renderPlaceholder(which){
    const titles={schedule:'予定',travel:'旅程',summary:'集計'};
    app.innerHTML=`<main class="screen">${simpleTopbar(titles[which]||'MaaNote')}<div class="content"><div class="card placeholder-screen"><div><strong>${titles[which]||''}</strong>Stage 8では旧v9.6データ移行まで実装済みです。</div></div></div></main>${tabbar(which)}`;
    bindCommon();
  }

  function simpleTopbar(title){ return `<header class="topbar"><div class="topbar-inner"><div></div><div class="topbar-title">${title}</div><button data-action="settings" aria-label="設定">${icon('settings')}</button></div></header>`; }

  function tabbar(active){
    const view=state.settings.mode==='view_only';
    const tabs=view ? [['home','home','ホーム'],['events','heart','イベント'],['schedule','calendar','予定']] : [['home','home','ホーム'],['events','heart','イベント'],['schedule','calendar','予定'],['travel','luggage','旅程'],['summary','chart','集計']];
    return `<nav class="tabbar"><div class="tabbar-inner ${view?'view-only':''}">${tabs.map(([key,ic,label])=>`<button class="tab-btn ${active===key?'active':''}" data-tab="${key}">${icon(ic)}<span>${label}</span></button>`).join('')}</div></nav>`;
  }

  function bindCommon(){
    document.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>{
      const target=btn.dataset.tab;
      if(target===state.screen){ window.scrollTo({top:0,behavior:'smooth'}); return; }
      if(state.screen==='events') state.lastEventScroll=window.scrollY;
      if(target==='travel') state.travelEventFilter=null;
      state.screen=target; render(); window.scrollTo(0,0);
    });
    document.querySelectorAll('[data-open-event]').forEach(el=>el.onclick=(e)=>{
      if(e.target.closest('[data-map],[data-placeholder]')) return;
      if(state.screen==='events') state.lastEventScroll=window.scrollY;
      state.detailEventId=el.dataset.openEvent; state.screen='detail'; const openedEv=officialEvents.find(x=>x.id===state.detailEventId); state.detailTab=IS_VIEW_BUILD?'official':((homeMode(openedEv)==='today' && userPlanForEvent(openedEv).participationStatus==='confirmed')?'day':'official'); renderDetail(); window.scrollTo(0,0);
    });
    document.querySelectorAll('[data-map]').forEach(el=>el.onclick=(e)=>{
      e.stopPropagation();
      if(!navigator.onLine){ showToast('地図はオンライン時に開けます'); return; }
      const q=encodeURIComponent(el.dataset.map);
      window.open(`https://www.google.com/maps/search/?api=1&query=${q}`,'_blank','noopener');
    });
    document.querySelectorAll('[data-online-link]').forEach(el=>el.onclick=(e)=>{
      if(!navigator.onLine){ e.preventDefault(); showToast('公式ページはオンライン時に開けます'); }
    });
    document.querySelectorAll('[data-action="settings"]').forEach(b=>b.onclick=openSettingsScreen);
    document.querySelectorAll('[data-action="quick-add"]').forEach(b=>b.onclick=openQuickAddSheet);
    document.querySelectorAll('[data-placeholder]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();showToast('次の実装段階で追加します');});
    document.querySelectorAll('[data-home-open-todo]').forEach(b=>b.onclick=()=>{state.scheduleTab='todo';state.screen='schedule';renderSchedule();window.scrollTo(0,0);});
    document.querySelectorAll('[data-home-open-schedule]').forEach(b=>b.onclick=()=>{state.scheduleTab='calendar';state.screen='schedule';renderSchedule();window.scrollTo(0,0);});
    document.querySelectorAll('[data-home-add-schedule]').forEach(b=>b.onclick=()=>openScheduleEditSheet(null,{date:fmtISODate(currentDate())}));
    document.querySelectorAll('[data-toggle-todo]').forEach(b=>b.onclick=async e=>{e.stopPropagation();await toggleTodo(b.dataset.toggleTodo);render();});
    document.querySelectorAll('[data-edit-todo]').forEach(b=>b.onclick=e=>{e.stopPropagation();openTodoEditSheet(b.dataset.editTodo);});
    document.querySelectorAll('[data-edit-schedule]').forEach(b=>b.onclick=e=>{e.stopPropagation();openScheduleEditSheet(b.dataset.editSchedule);});
    document.querySelectorAll('[data-edit-travel]').forEach(b=>b.onclick=e=>{e.stopPropagation();openTravelEditSheet(b.dataset.editTravel);});
    document.querySelectorAll('[data-home-travel]').forEach(b=>b.onclick=e=>{e.stopPropagation();state.travelEventFilter=b.dataset.homeTravel;state.travelDirectionFilter='all';state.screen='travel';renderTravel();window.scrollTo(0,0);});
    document.querySelectorAll('[data-add-travel]').forEach(b=>b.onclick=e=>{e.stopPropagation();openTravelAddSheet(b.dataset.eventId||null);});
    document.querySelectorAll('[data-open-setlist]').forEach(b=>b.onclick=e=>{e.stopPropagation();openSetlistSheet(b.dataset.openSetlist);});
    document.querySelectorAll('[data-open-talk-memos]').forEach(b=>b.onclick=e=>{e.stopPropagation();openTalkMemoSheet(b.dataset.openTalkMemos);});
    document.querySelectorAll('[data-common-ack]').forEach(b=>b.onclick=async e=>{e.stopPropagation();await saveSetting('lastSeenCommonVersion',Number(state.commonMeta?.version||0));renderHome();showToast('✓ 確認済みにしました');});
  }

  function openSettingsScreen(){
    state.settingsReturnScreen=state.screen==='settings'?(state.settingsReturnScreen||'home'):state.screen;
    state.screen='settings'; renderSettings(); window.scrollTo(0,0);
  }

  function settingsBack(){
    const target=state.settingsReturnScreen||'home'; state.screen=target;
    if(target==='detail') renderDetail(); else render();
    window.scrollTo(0,0);
  }

  function isDriveInternalSetting(value){
    const key=String(value?.key||'');
    return key.startsWith('drive');
  }

  function isAutoDriveMode(){
    return !IS_VIEW_BUILD && DRIVE_SYNC_ENABLED && state.settings.mode==='personal_management' && state.settings.driveBackupMode==='auto';
  }

  function driveBackupDirty(){
    return !!localStorage.getItem(DRIVE_DIRTY_KEY);
  }

  function markDriveBackupDirty(store,value){
    if(IS_VIEW_BUILD || driveAutoBackupSuspended) return;
    if(!PERSONAL_STORES.includes(store)) return;
    if(store==='settings' && isDriveInternalSetting(value)) return;
    try{localStorage.setItem(DRIVE_DIRTY_KEY,new Date().toISOString())}catch(_){}
    scheduleAutoDriveBackup();
  }

  function clearDriveBackupDirty(){
    try{localStorage.removeItem(DRIVE_DIRTY_KEY)}catch(_){}
  }

  function meaningfulPersonalCount(){
    return Object.values(state.userPlans).filter(x=>!x.deleted).length
      + state.todos.filter(x=>!x.deleted).length
      + state.personalSchedules.filter(x=>!x.deleted).length
      + state.travelBookings.filter(x=>!x.deleted).length
      + state.setlists.filter(x=>!x.deleted).length
      + state.talkMemos.filter(x=>!x.deleted).length;
  }

  function scheduleAutoDriveBackup(delay=DRIVE_AUTO_DELAY){
    if(!isAutoDriveMode() || driveAutoBackupSuspended || !navigator.onLine) return;
    clearTimeout(driveAutoTimer);
    driveAutoTimer=setTimeout(()=>runAutoDriveBackup(),delay);
  }

  async function runAutoDriveBackup(){
    if(!isAutoDriveMode() || driveAutoBackupSuspended || !driveBackupDirty() || state.drive.busy || !navigator.onLine) return;
    if(!driveConnected()){
      state.drive.needsReconnect=true;
      if(!driveReconnectToastShown){
        driveReconnectToastShown=true;
        showToast('Drive自動バックアップは再接続後に続行します');
      }
      if(state.screen==='settings') renderSettings();
      return;
    }
    await uploadDriveBackup({silent:true});
  }

  async function resumeAutoDriveBackup(){
    if(!isAutoDriveMode() || !navigator.onLine) return;
    if(!driveConnected()){
      state.drive.needsReconnect=true;
      if(state.screen==='settings') renderSettings();
      return;
    }
    try{
      await findDriveBackup();
      state.drive.needsReconnect=false;
      driveReconnectToastShown=false;
      if(driveBackupDirty()) scheduleAutoDriveBackup(1200);
    }catch(_){
      state.drive.needsReconnect=true;
      if(state.screen==='settings') renderSettings();
    }
  }

  function shouldShowNewDeviceLogin(){
    return !IS_VIEW_BUILD
      && DRIVE_SYNC_ENABLED
      && !state.hadStoredSettings
      && !state.settings.driveBackupMode
      && meaningfulPersonalCount()===0;
  }

  function showStartupLoginGate(){
    if(!shouldShowNewDeviceLogin()) return;

    sheetRoot.innerHTML=`<div class="startup-login-backdrop">
      <div class="startup-login-card" data-startup-login>
        <div class="startup-login-brand">MaaNote <span>♥</span></div>
        <div class="startup-login-title">MaaNoteをはじめる</div>
        <div class="startup-login-text">別の端末で使っていたデータがある場合は、同じGoogleアカウントでログインするとGoogle Driveのバックアップから引き継げます。</div>

        <button class="startup-login-primary" data-startup-google>
          <span class="startup-google-mark">G</span>
          <span><strong>Googleでログイン</strong><small>データを引き継ぐ・自動バックアップ</small></span>
        </button>

        <div class="startup-login-divider"><span>または</span></div>

        <button class="startup-login-secondary" data-startup-new>
          <strong>新しく入力を始める</strong>
          <small>この端末だけに保存して開始</small>
        </button>

        <button class="startup-login-view" data-startup-view>情報を見るだけ</button>

        <div class="startup-login-note">Googleログインは個人データのバックアップ／復元にだけ使用します。最初の認証後はMaaNote側で接続を維持するため、ページ更新やGoogleの短いアクセストークン期限ごとにログインし直す必要はありません。</div>
      </div>
    </div>`;

    const googleBtn=sheetRoot.querySelector('[data-startup-google]');
    googleBtn.onclick=async()=>{
      if(!navigator.onLine){
        showToast('Googleログインはオンライン時に利用できます');
        return;
      }
      googleBtn.disabled=true;
      const original=googleBtn.innerHTML;
      googleBtn.innerHTML='<span class="startup-google-mark">G</span><span><strong>Googleを開いています…</strong><small>アカウントを選択してください</small></span>';
      try{
        await connectDrive({enableAuto:true,firstSetup:true});
        // If no cloud backup existed, connectDrive does not replace the gate.
        // Successful authorization means auto mode is now stored.
        if(state.settings.driveBackupMode==='auto' && driveConnected() && sheetRoot.querySelector('[data-startup-login]')){
          closeSheet();
          render();
        }
      }finally{
        const btn=sheetRoot.querySelector('[data-startup-google]');
        if(btn){
          btn.disabled=false;
          btn.innerHTML=original;
        }
      }
    };

    sheetRoot.querySelector('[data-startup-new]').onclick=async()=>{
      await saveSetting('mode','personal_management');
      await saveSetting('driveBackupMode','local');
      state.hadStoredSettings=true;
      closeSheet();
      render();
      showToast('この端末だけに保存して開始します');
    };

    sheetRoot.querySelector('[data-startup-view]').onclick=async()=>{
      await saveSetting('mode','view_only');
      await saveSetting('driveBackupMode',null);
      state.hadStoredSettings=true;
      closeSheet();
      render();
      showToast('見るだけモードで開始します');
    };
  }

  function maybeOfferBackupChoice(){
    if(IS_VIEW_BUILD || !DRIVE_SYNC_ENABLED || state.settings.mode!=='personal_management' || state.settings.driveBackupMode) return;
    showSheet(`<div class="sheet-head"><div class="sheet-title">データのバックアップ</div></div>
      <div class="settings-info-text">個人データの保存方法を選んでください。あとから設定で変更できます。</div>
      <button class="sheet-card-btn primary full-width-btn" data-backup-choice-auto>
        Google Driveに自動バックアップ
        <small style="display:block;margin-top:3px;font-weight:500">おすすめ・普段は操作不要</small>
      </button>
      <button class="sheet-card-btn full-width-btn" data-backup-choice-local>
        この端末だけに保存
        <small style="display:block;margin-top:3px;font-weight:500">Google連携なしで利用</small>
      </button>
      <div class="form-help">どちらを選んでも、普段の入力はまずこの端末へ保存されるので、圏外でも使えます。</div>`);
    sheetRoot.querySelector('[data-backup-choice-auto]').onclick=async()=>{
      await saveSetting('driveBackupMode','auto');
      closeSheet();
      await connectDrive({enableAuto:true,firstSetup:true});
    };
    sheetRoot.querySelector('[data-backup-choice-local]').onclick=async()=>{
      await saveSetting('driveBackupMode','local');
      closeSheet();
      showToast('この端末だけに保存します');
    };
  }

  function showExistingDriveBackupChoice(){
    showSheet(`<div class="sheet-head"><div class="sheet-title">Driveにバックアップがあります</div></div>
      <div class="settings-info-text">このGoogleアカウントには、すでにMaaNoteのバックアップがあります。安全のため自動上書きせず、どちらを使うか確認します。</div>
      <button class="sheet-card-btn primary full-width-btn" data-drive-use-local>この端末のデータをDriveへ保存</button>
      <button class="sheet-card-btn full-width-btn" data-drive-use-cloud>Driveのデータをこの端末へ復元</button>
      <button class="sheet-card-btn full-width-btn" data-sheet-close>今は何もしない</button>`);
    sheetRoot.querySelector('[data-drive-use-local]').onclick=async()=>{
      closeSheet();
      try{
        try{localStorage.setItem(DRIVE_DIRTY_KEY,new Date().toISOString())}catch(_){}
        await uploadDriveBackup({silent:false});
      }catch(_){}
    };
    sheetRoot.querySelector('[data-drive-use-cloud]').onclick=async()=>{
      closeSheet();
      await openDriveRestoreSheet();
    };
  }

  function driveSession(){
    try{return localStorage.getItem(DRIVE_BACKEND_SESSION_KEY)||''}catch(_){return ''}
  }

  function saveDriveSession(token){
    try{
      if(token) localStorage.setItem(DRIVE_BACKEND_SESSION_KEY,token);
      else localStorage.removeItem(DRIVE_BACKEND_SESSION_KEY);
    }catch(_){}
  }

  function driveConnected(){
    return !!driveSession() && !state.drive.needsReconnect;
  }

  async function driveApi(path,options={}){
    const token=driveSession();
    if(!token) throw Object.assign(new Error('Google Driveへログインしてください'),{status:401});
    const headers={...(options.headers||{}),Authorization:`Bearer ${token}`};
    const res=await fetch(`${API_BASE}${path}`,{...options,headers});
    if(res.status===401){
      saveDriveSession('');
      state.drive.needsReconnect=true;
      state.drive.user=null;
      throw Object.assign(new Error('Google Driveへのログインが必要です'),{status:401});
    }
    if(!res.ok){
      const detail=await res.json().catch(()=>null);
      throw Object.assign(new Error(detail?.error||`バックアップAPI ${res.status}`),{status:res.status});
    }
    return res;
  }

  async function exchangeDriveLoginTicket(code){
    const res=await fetch(`${API_BASE}/api/drive/session/exchange`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code})
    });
    if(!res.ok){
      const detail=await res.json().catch(()=>null);
      throw new Error(detail?.error||'Googleログインを完了できませんでした');
    }
    const data=await res.json();
    if(!data.sessionToken) throw new Error('ログインセッションを作成できませんでした');
    saveDriveSession(data.sessionToken);
    state.drive.user=data.user||null;
    state.drive.needsReconnect=false;
    return data;
  }

  async function handleDriveAuthReturn(){
    if(IS_VIEW_BUILD || !DRIVE_SYNC_ENABLED) return null;
    const url=new URL(location.href);
    const code=url.searchParams.get('drive_auth');
    const error=url.searchParams.get('drive_auth_error');
    if(!code && !error) return null;

    url.searchParams.delete('drive_auth');
    url.searchParams.delete('drive_auth_error');
    history.replaceState(null,'',url.pathname+(url.search?url.search:'')+url.hash);

    if(error){
      showToast('Googleログインを完了できませんでした');
      return {connected:false,error};
    }

    const firstSetup=localStorage.getItem(DRIVE_FIRST_SETUP_KEY)==='1';
    try{
      const data=await exchangeDriveLoginTicket(code);
      await saveSetting('driveBackupMode','auto');
      state.hadStoredSettings=true;
      let status=null;
      try{status=await refreshDriveStatus()}catch(_){}
      return {connected:true,firstSetup,status,data};
    }catch(err){
      console.error(err);
      showToast(err.message||'Googleログインを完了できませんでした');
      return {connected:false,error:err.message};
    }finally{
      try{localStorage.removeItem(DRIVE_FIRST_SETUP_KEY)}catch(_){}
    }
  }

  async function refreshDriveStatus(){
    const res=await driveApi('/api/drive/status');
    const data=await res.json();
    state.drive.user=data.user||state.drive.user;
    state.drive.file=data.file||null;
    state.drive.statusChecked=true;
    state.drive.needsReconnect=false;
    return data;
  }

  async function findDriveBackup(){
    const data=await refreshDriveStatus();
    return data.file||null;
  }

  async function buildPersonalBackup(includeImages=true){
    const travel=state.travelBookings.filter(x=>!x.deleted).map(x=>includeImages?structuredClone(x):{...x,images:(x.images||[]).map(img=>({id:img.id,name:img.name,createdAt:img.createdAt,dataUrl:null}))});
    const settings={...state.settings};
    if(!includeImages) settings.headerImage=null;
    delete settings.driveLastBackupAt;
    delete settings.driveLastRestoreAt;
    const rawLegacyData=await idbGetAll('legacyData').catch(()=>[]);
    const legacyData=includeImages?rawLegacyData:rawLegacyData.map(x=>({...x,orphanBookingImages:(x.orphanBookingImages||[]).map(img=>({...img,dataUrl:null}))}));
    const migrationInfo=await idbGetAll('migrationInfo').catch(()=>[]);
    return {
      format:'MaaNote-export',
      version:1,
      appVersion:APP_VERSION,
      exportedAt:new Date().toISOString(),
      includeImages,
      userEventPlans:Object.values(state.userPlans).filter(x=>!x.deleted),
      todos:state.todos.filter(x=>!x.deleted),
      personalSchedules:state.personalSchedules.filter(x=>!x.deleted),
      travelBookings:travel,
      setlists:state.setlists.filter(x=>!x.deleted),
      talkMemos:state.talkMemos.filter(x=>!x.deleted),
      settings,
      legacyData,
      migrationInfo
    };
  }

  function backupSummary(payload){
    return {
      plans:Array.isArray(payload?.userEventPlans)?payload.userEventPlans.length:0,
      todos:Array.isArray(payload?.todos)?payload.todos.length:0,
      travel:Array.isArray(payload?.travelBookings)?payload.travelBookings.length:0,
      schedules:Array.isArray(payload?.personalSchedules)?payload.personalSchedules.length:0
    };
  }

  function downloadBackupPayload(payload,filename){
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  async function uploadDriveBackup({silent=false}={}){
    if(state.drive.busy) return false;
    if(!navigator.onLine){
      if(!silent) showToast('Google Driveはオンライン時に利用できます');
      return false;
    }
    if(!driveConnected()){
      state.drive.needsReconnect=true;
      if(!silent) showToast('Google Driveへログインしてください');
      return false;
    }

    state.drive.busy=true;
    try{
      const payload=await buildPersonalBackup(true);
      const res=await driveApi('/api/drive/backup',{
        method:'PUT',
        headers:{'Content-Type':'application/json; charset=UTF-8'},
        body:JSON.stringify(payload)
      });
      const data=await res.json();
      state.drive.file=data.file||state.drive.file;
      state.drive.user=data.user||state.drive.user;
      clearDriveBackupDirty();
      await saveSetting('driveLastBackupAt',new Date().toISOString());
      state.drive.error=null;
      state.drive.needsReconnect=false;
      if(state.screen==='settings') renderSettings();
      if(!silent) showToast('✓ Google Driveへバックアップしました');
      return true;
    }catch(err){
      console.error(err);
      state.drive.error=err.message;
      if(err.status===401) state.drive.needsReconnect=true;
      if(!silent) showToast(err.message||'Google Driveへバックアップできませんでした');
      return false;
    }finally{
      state.drive.busy=false;
    }
  }

  function driveReturnUrl(){
    const u=new URL(location.href);
    u.searchParams.delete('drive_auth');
    u.searchParams.delete('drive_auth_error');
    return u.href;
  }

  async function connectDrive({enableAuto=false,firstSetup=false}={}){
    if(!DRIVE_SYNC_ENABLED){openSettingsInfo('driveSetup');return;}
    if(!navigator.onLine){showToast('Google Driveはオンライン時に利用できます');return;}
    if(enableAuto && state.settings.driveBackupMode!=='auto') await saveSetting('driveBackupMode','auto');
    try{
      if(firstSetup) localStorage.setItem(DRIVE_FIRST_SETUP_KEY,'1');
      else localStorage.removeItem(DRIVE_FIRST_SETUP_KEY);
    }catch(_){}
    const target=`${API_BASE}/api/drive/auth/start?return_url=${encodeURIComponent(driveReturnUrl())}`;
    location.assign(target);
  }

  async function disconnectDrive(){
    const token=driveSession();
    if(token){
      try{
        await fetch(`${API_BASE}/api/drive/session`,{
          method:'DELETE',
          headers:{Authorization:`Bearer ${token}`}
        });
      }catch(_){}
    }
    saveDriveSession('');
    state.drive.file=null;
    state.drive.user=null;
    state.drive.error=null;
    state.drive.needsReconnect=false;
    state.drive.statusChecked=false;
    clearTimeout(driveAutoTimer);
    await saveSetting('driveBackupMode','local');
    if(state.screen==='settings') renderSettings();
    showToast('この端末だけに保存する設定へ変更しました');
  }

  async function downloadDriveBackup(){
    if(!navigator.onLine){showToast('Google Driveはオンライン時に利用できます');return null;}
    const res=await driveApi('/api/drive/backup');
    const data=await res.json();
    if(!data?.backup || data.backup.format!=='MaaNote-export' || !Array.isArray(data.backup.userEventPlans)){
      throw new Error('MaaNoteのバックアップとして読み込めません');
    }
    state.drive.file=data.file||state.drive.file;
    state.drive.user=data.user||state.drive.user;
    return data.backup;
  }

  async function importPersonalBackup(payload){
    if(payload?.format!=='MaaNote-export') throw new Error('MaaNoteバックアップではありません');

    const keepBackupMode=state.settings.driveBackupMode||'auto';
    driveAutoBackupSuspended=true;
    const arrays={
      userEventPlans:payload.userEventPlans||[],
      todos:payload.todos||[],
      personalSchedules:payload.personalSchedules||[],
      travelBookings:payload.travelBookings||[],
      setlists:payload.setlists||[],
      talkMemos:payload.talkMemos||[],
      migrationInfo:payload.migrationInfo||[],
      legacyData:payload.legacyData||[]
    };

    await writeEmergencyBackup();
    emergencyBackupSuspended=true;
    try{
      for(const store of PERSONAL_STORES) await idbClear(store);
      for(const [store,rows] of Object.entries(arrays)){
        for(const row of rows) await idbPut(store,structuredClone(row),{skipEmergencyBackup:true,skipAutoDriveBackup:true});
      }
      const settings=payload.settings&&typeof payload.settings==='object'?payload.settings:{};
      for(const [key,value] of Object.entries(settings)){
        await idbPut('settings',{key,value},{skipEmergencyBackup:true,skipAutoDriveBackup:true});
      }
      await idbPut('settings',{key:'driveBackupMode',value:keepBackupMode},{skipEmergencyBackup:true,skipAutoDriveBackup:true});
      await idbPut('settings',{key:'driveLastRestoreAt',value:new Date().toISOString()},{skipEmergencyBackup:true,skipAutoDriveBackup:true});
      await idbPut('settings',{key:'driveLastBackupAt',value:payload.exportedAt||new Date().toISOString()},{skipEmergencyBackup:true,skipAutoDriveBackup:true});
      clearDriveBackupDirty();
    }finally{
      emergencyBackupSuspended=false;
      driveAutoBackupSuspended=false;
    }
    await writeEmergencyBackup();
  }

  async function openDriveRestoreSheet(){
    if(state.drive.busy) return;
    state.drive.busy=true;
    try{
      const payload=await downloadDriveBackup();
      const s=backupSummary(payload);
      const date=payload.exportedAt?new Date(payload.exportedAt).toLocaleString('ja-JP'):'不明';
      showSheet(`<div class="sheet-head"><div class="sheet-title">Google Driveから復元</div><button class="text-btn" data-sheet-close>閉じる</button></div>
        <div class="settings-info-text">Driveのバックアップで、この端末の個人データを置き換えます。</div>
        <div class="card section-card">
          <div class="settings-status-row"><span><strong>バックアップ日時</strong></span><b>${escapeHTML(date)}</b></div>
          <div class="settings-status-row"><span><strong>イベント入力</strong></span><b>${s.plans}件</b></div>
          <div class="settings-status-row"><span><strong>TODO</strong></span><b>${s.todos}件</b></div>
          <div class="settings-status-row"><span><strong>旅程</strong></span><b>${s.travel}件</b></div>
        </div>
        <div class="form-help">復元前に、現在の端末データを画像込みJSONとして自動で書き出します。管理者配信情報は置き換えません。</div>
        <button class="sheet-card-btn primary full-width-btn" data-drive-restore-confirm>このバックアップから復元</button>`);
      sheetRoot.querySelector('[data-drive-restore-confirm]').onclick=async()=>{
        try{
          const current=await buildPersonalBackup(true);
          downloadBackupPayload(current,`MaaNote_before_drive_restore_${fmtISODate(new Date())}.json`);
          await importPersonalBackup(payload);
          showToast('✓ Google Driveから復元しました');
          setTimeout(()=>location.reload(),500);
        }catch(err){
          console.error(err);
          showToast(err.message||'復元できませんでした');
        }
      };
    }catch(err){
      console.error(err);
      showToast(err.message||'Google Driveから読み込めませんでした');
    }finally{
      state.drive.busy=false;
    }
  }

  function renderSettings(){
    const h=state.settings.headerImage;
    const swReady=!!navigator.serviceWorker?.controller;

    if(IS_VIEW_BUILD){
      app.innerHTML=`<main class="screen settings-screen">
        <header class="topbar"><div class="topbar-inner"><button data-settings-back aria-label="戻る">${icon('back')}</button><div class="topbar-title">設定</div><div></div></div></header>
        <div class="content settings-content">
          <div class="settings-section-title">表示</div>
          <section class="card settings-card">
            <label class="settings-field"><span><strong>文字サイズ</strong><small>この端末だけに保存されます</small></span><select class="settings-select" data-setting-font-size><option value="small" ${state.settings.fontSize==='small'?'selected':''}>小さめ 90%</option><option value="standard" ${!state.settings.fontSize||state.settings.fontSize==='standard'?'selected':''}>標準 100%</option><option value="large" ${state.settings.fontSize==='large'?'selected':''}>大きめ 120%</option><option value="xlarge" ${state.settings.fontSize==='xlarge'?'selected':''}>特大 140%</option></select></label>
            <div class="font-size-preview"><small>表示例</small><strong>11/2(月) 千葉　イオンモール幕張新都心</strong></div>
          </section>

          <div class="settings-section-title">配信情報</div>
          <section class="card settings-card">
            <div class="settings-status-row"><span><strong>イベント情報</strong><small>管理者から配信された共通データ</small></span><b>v${state.commonMeta?.version||'—'}</b></div>
            <div class="settings-status-row"><span><strong>最終更新</strong><small>${state.commonMeta?.summary?escapeHTML(state.commonMeta.summary):'—'}</small></span><b>${state.commonMeta?.updatedAt?new Date(state.commonMeta.updatedAt).toLocaleDateString('ja-JP'):'—'}</b></div>
            <button class="settings-nav-row" data-refresh-common><span><strong>最新情報を確認</strong><small>オンラインで配信情報を更新</small></span><span class="chev">›</span></button>
          </section>

          <div class="settings-section-title">ヘルプ・情報</div>
          <section class="card settings-card">
            <button class="settings-nav-row" data-settings-info="offline"><span><strong>オフラインでできること</strong><small>圏外時の動作を確認</small></span><span class="chev">›</span></button>
            <button class="settings-nav-row" data-settings-info="privacy"><span><strong>データの取り扱い</strong><small>見るだけ版では個人の予定を保存しません</small></span><span class="chev">›</span></button>
            <button class="settings-nav-row" data-settings-info="unofficial"><span><strong>非公式アプリについて</strong><small>参加前は必ず公式情報をご確認ください</small></span><span class="chev">›</span></button>
          </section>

          <div class="settings-section-title">アプリ情報</div>
          <section class="card settings-card">
            <div class="settings-status-row"><span><strong>MaaNote View</strong><small>見るだけ版 · 非公式</small></span><b>${APP_VERSION_LABEL}</b></div>
            <div class="settings-status-row"><span><strong>オフライン利用</strong><small>初回読込後は主要情報を閲覧可能</small></span><b class="${swReady?'ok':'muted'}">${swReady?'利用可能':'初回読込後'}</b></div>
            <button class="settings-nav-row" data-check-update><span><strong>更新を確認</strong><small>アプリ本体の更新を確認</small></span><span class="chev">›</span></button>
          </section>
          <div class="settings-footnote">MaaNote Viewは公開情報を見るためのURLです。参加状況・CD・TODO・旅程などの個人管理機能はありません。</div>
        </div>
      </main>`;
      bindSettings();
      return;
    }
    app.innerHTML=`<main class="screen settings-screen">
      <header class="topbar"><div class="topbar-inner"><button data-settings-back aria-label="戻る">${icon('back')}</button><div class="topbar-title">設定</div><div></div></div></header>
      <div class="content settings-content">
        <div class="settings-section-title">利用</div>
        <section class="card settings-card">
          <label class="settings-field"><span><strong>利用モード</strong><small>見るだけにしても個人データは削除されません</small></span><select class="settings-select" data-setting-mode><option value="personal_management" ${state.settings.mode==='personal_management'?'selected':''}>自分の予定も管理</option><option value="view_only" ${state.settings.mode==='view_only'?'selected':''}>情報を見るだけ</option></select></label>
          <label class="settings-field"><span><strong>ホームの直近イベント</strong><small>NEXT EVENT の対象</small></span><select class="settings-select" data-setting-home-filter><option value="all" ${state.settings.homeEventFilter==='all'?'selected':''}>すべて</option><option value="exclude_not_attending" ${state.settings.homeEventFilter==='exclude_not_attending'?'selected':''}>不参加を除く</option><option value="confirmed_only" ${state.settings.homeEventFilter==='confirmed_only'?'selected':''}>参加確定のみ</option></select></label>
          <label class="settings-switch-row"><span><strong>イベント絞り込みを記憶</strong><small>前回選んだフィルターを次回も使う</small></span><input type="checkbox" data-setting-remember-filter ${state.settings.rememberEventFilter!==false?'checked':''}></label>
        </section>

        <div class="settings-section-title">表示</div>
        <section class="card settings-card">
          <label class="settings-field"><span><strong>文字サイズ</strong><small>この端末だけに保存されます</small></span><select class="settings-select" data-setting-font-size><option value="small" ${state.settings.fontSize==='small'?'selected':''}>小さめ 90%</option><option value="standard" ${!state.settings.fontSize||state.settings.fontSize==='standard'?'selected':''}>標準 100%（初期値）</option><option value="large" ${state.settings.fontSize==='large'?'selected':''}>大きめ 120%</option><option value="xlarge" ${state.settings.fontSize==='xlarge'?'selected':''}>特大 140%</option></select></label>
          <div class="font-size-preview"><small>表示例</small><strong>11/2(月) 千葉　イオンモール幕張新都心</strong></div>
        </section>

        <div class="settings-section-title">ホーム・画像</div>
        <section class="card settings-card">
          <div class="settings-image-block"><div><strong>ホームヘッダー画像</strong><small>イベントにはサムネイルを表示しません</small></div><div class="header-preview settings-header-preview" ${h?`style="background-image:url('${h.replace(/'/g,"%27")}')"`:''}></div><div class="settings-action-grid"><button data-pick-header>画像を変更</button><button data-delete-header ${h?'':'disabled'}>削除</button></div><input type="file" accept="image/*" hidden data-header-file></div>
          <label class="settings-field"><span><strong>保存する画像の画質</strong><small>ヘッダー・予約画像の端末容量に影響</small></span><select class="settings-select" data-setting-image-quality><option value="low" ${state.settings.imageQuality==='low'?'selected':''}>軽量</option><option value="standard" ${!state.settings.imageQuality||state.settings.imageQuality==='standard'?'selected':''}>標準</option><option value="high" ${state.settings.imageQuality==='high'?'selected':''}>高画質</option></select></label>
        </section>

        <div class="settings-section-title">オフライン・データ</div>
        <section class="card settings-card">
          <div class="settings-status-row"><span><strong>個人データの保存先</strong><small>この端末内に保存</small></span><b>端末保存</b></div>
          <div class="settings-status-row"><span><strong>オフライン利用</strong><small>ホーム・イベント・予定・旅程など</small></span><b class="${swReady?'ok':'muted'}">${swReady?'利用可能':'初回読込後'}</b></div>
          <button class="settings-nav-row" data-export-data="data"><span><strong>データを書き出す</strong><small>予約画像・ヘッダー画像を除くJSON</small></span><span class="chev">›</span></button>
          <button class="settings-nav-row" data-export-data="all"><span><strong>画像込みで書き出す</strong><small>ファイルサイズが大きくなる場合があります</small></span><span class="chev">›</span></button>
        </section>

        <div class="settings-section-title">バックアップ</div>
        <section class="card settings-card">
          <div class="settings-status-row"><span><strong>保存方法</strong><small>普段の入力はまず端末へ保存されます</small></span><b>${state.settings.driveBackupMode==='auto'?'Google Drive自動':'この端末だけ'}</b></div>
          ${state.settings.driveBackupMode==='auto'?`
            <div class="settings-status-row"><span><strong>自動バックアップ</strong><small>${state.drive.needsReconnect?'Googleで再ログインしてください':driveBackupDirty()?'次回オンライン時に自動保存':'変更時に自動保存'}</small></span><b class="${driveConnected()?'ok':''}">${!DRIVE_SYNC_ENABLED?'設定待ち':driveConnected()?'接続中':state.drive.needsReconnect?'要ログイン':'待機中'}</b></div>
            <div class="settings-status-row"><span><strong>最終バックアップ</strong><small>MaaNote専用のDrive領域</small></span><b>${state.drive.file?.modifiedTime?new Date(state.drive.file.modifiedTime).toLocaleDateString('ja-JP'):state.settings.driveLastBackupAt?new Date(state.settings.driveLastBackupAt).toLocaleDateString('ja-JP'):'—'}</b></div>
          `:''}
          ${!DRIVE_SYNC_ENABLED
            ?`<button class="settings-nav-row" data-drive-setup><span><strong>Google Drive連携を設定</strong><small>Google OAuth設定後に利用できます</small></span><span class="chev">›</span></button>`
            :state.settings.driveBackupMode!=='auto'
              ?`<button class="settings-nav-row" data-drive-enable-auto><span><strong>Google Driveに自動バックアップ</strong><small>初回だけGoogleアカウントを選択</small></span><span class="chev">›</span></button>`
              :!driveConnected()
                ?`<button class="settings-nav-row" data-drive-connect><span><strong>Googleで再ログイン</strong><small>通常は初回ログイン後、そのまま接続を維持します</small></span><span class="chev">›</span></button>`
                :`<button class="settings-nav-row" data-drive-backup><span><strong>今すぐバックアップ</strong><small>通常は押さなくても自動保存されます</small></span><span class="chev">›</span></button>
                  <button class="settings-nav-row" data-drive-restore><span><strong>Google Driveから復元</strong><small>端末変更・データ復旧用</small></span><span class="chev">›</span></button>
                  <button class="settings-nav-row" data-drive-disconnect><span><strong>この端末だけに保存する</strong><small>Drive上の既存バックアップは削除しません</small></span><span class="chev">›</span></button>`}
          <div class="drive-sync-note">Google Driveを選んだ場合、初回にGoogleアカウントを選ぶと、その後はCD・TODO・旅程などの変更を自動バックアップします。Googleの短いアクセストークン更新はMaaNote側で処理するため、通常は再ログイン不要です。</div>
        </section>

        <div class="settings-section-title">ヘルプ・情報</div>
        <section class="card settings-card">
          <button class="settings-nav-row" data-settings-info="offline"><span><strong>オフラインでできること</strong><small>圏外時の動作を確認</small></span><span class="chev">›</span></button>
          <button class="settings-nav-row" data-settings-info="privacy"><span><strong>データの取り扱い</strong><small>端末保存・画像について</small></span><span class="chev">›</span></button>
          <button class="settings-nav-row" data-settings-info="unofficial"><span><strong>非公式アプリについて</strong><small>参加前は必ず公式情報をご確認ください</small></span><span class="chev">›</span></button>
        </section>

        <div class="settings-section-title">配信情報</div>
        <section class="card settings-card">
          <div class="settings-status-row"><span><strong>管理者配信データ</strong><small>個人データとは別領域で保存</small></span><b>v${state.commonMeta?.version||'—'}</b></div>
          <div class="settings-status-row"><span><strong>最終更新</strong><small>${state.commonMeta?.summary?escapeHTML(state.commonMeta.summary):'—'}</small></span><b>${state.commonMeta?.updatedAt?new Date(state.commonMeta.updatedAt).toLocaleDateString('ja-JP'):'—'}</b></div>
          <button class="settings-nav-row" data-refresh-common><span><strong>配信情報を更新</strong><small>オンラインで最新の共通データを確認</small></span><span class="chev">›</span></button>
        </section>

        ${IS_TEST_MODE?`<div class="settings-section-title">TEST</div>
        <section class="card settings-card">
          <label class="settings-field"><span><strong>ホーム表示日</strong><small>通常日・前日・当日の表示確認用</small></span><select class="settings-select" data-setting-preview><option value="" ${!state.settings.previewDate?'selected':''}>実際の日付</option><option value="2026-11-10" ${state.settings.previewDate==='2026-11-10'?'selected':''}>通常日 11/10</option><option value="2026-11-14" ${state.settings.previewDate==='2026-11-14'?'selected':''}>前日 11/14</option><option value="2026-11-15" ${state.settings.previewDate==='2026-11-15'?'selected':''}>当日 11/15</option></select></label>
        </section>`:''}

        <div class="settings-section-title">アプリ情報</div>
        <section class="card settings-card">
          <div class="settings-status-row"><span><strong>MaaNote</strong><small>3rd Single イベントまとめ · 非公式</small></span><b>${APP_VERSION_LABEL}</b></div>
          <button class="settings-nav-row" data-check-update><span><strong>更新を確認</strong><small>アプリ本体の更新のみ確認します</small></span><span class="chev">›</span></button>
        </section>
        <div class="settings-footnote">設定変更は自動保存されます。アプリ本体の更新やキャッシュ更新で、IndexedDBの個人データを削除しない設計です。</div>
      </div>
    </main>`;
    bindSettings();
  }

  function bindSettings(){
    document.querySelector('[data-settings-back]').onclick=settingsBack;
    const mode=document.querySelector('[data-setting-mode]'); if(mode)mode.onchange=async()=>{await saveSetting('mode',mode.value);showToast('✓ 利用モードを変更しました');if(mode.value==='personal_management')setTimeout(maybeOfferBackupChoice,150);};
    const hf=document.querySelector('[data-setting-home-filter]'); if(hf)hf.onchange=async()=>{await saveSetting('homeEventFilter',hf.value);showToast('✓ 保存しました');};
    const rf=document.querySelector('[data-setting-remember-filter]'); if(rf)rf.onchange=async()=>{await saveSetting('rememberEventFilter',rf.checked);if(rf.checked)await saveSetting('lastEventFilter',state.eventFilter);showToast('✓ 保存しました');};
    const fs=document.querySelector('[data-setting-font-size]'); if(fs)fs.onchange=async()=>{await saveSetting('fontSize',fs.value);showToast('✓ 文字サイズを変更しました');};
    const iq=document.querySelector('[data-setting-image-quality]'); if(iq)iq.onchange=async()=>{await saveSetting('imageQuality',iq.value);showToast('✓ 画像画質を変更しました');};
    const pv=document.querySelector('[data-setting-preview]'); if(pv)pv.onchange=async()=>{await saveSetting('previewDate',pv.value||null);state.calendarCursor=null;showToast('✓ TEST表示日を変更しました');};
    const refreshCommon=document.querySelector('[data-refresh-common]'); if(refreshCommon)refreshCommon.onclick=async()=>{
      if(!navigator.onLine){showToast('配信情報の更新はオンライン時に利用できます');return;}
      const result=await syncPublishedCommonData();
      await loadCommonData();
      renderSettings();
      showToast(result.updated?'✓ 配信情報を更新しました':'✓ 配信情報は最新です');
    };
    const file=document.querySelector('[data-header-file]'); const pickHeader=document.querySelector('[data-pick-header]'); if(file&&pickHeader)pickHeader.onclick=()=>file.click();
    if(file)file.onchange=async()=>{if(!file.files?.[0])return;const data=await resizeImage(file.files[0]);await saveSetting('headerImage',data);renderSettings();showToast('✓ ヘッダー画像を保存しました');};
    const del=document.querySelector('[data-delete-header]'); if(del)del.onclick=async()=>{if(!state.settings.headerImage)return;await saveSetting('headerImage',null);renderSettings();showToast('✓ ヘッダー画像を削除しました');};
    document.querySelectorAll('[data-export-data]').forEach(b=>b.onclick=()=>exportPersonalData(b.dataset.exportData==='all'));
    document.querySelector('[data-drive-setup]')?.addEventListener('click',()=>openSettingsInfo('driveSetup'));
    document.querySelector('[data-drive-connect]')?.addEventListener('click',()=>connectDrive({enableAuto:true,firstSetup:false}));
    document.querySelector('[data-drive-enable-auto]')?.addEventListener('click',async()=>{await saveSetting('driveBackupMode','auto');await connectDrive({enableAuto:true,firstSetup:true});});
    document.querySelector('[data-drive-backup]')?.addEventListener('click',uploadDriveBackup);
    document.querySelector('[data-drive-restore]')?.addEventListener('click',openDriveRestoreSheet);
    document.querySelector('[data-drive-disconnect]')?.addEventListener('click',disconnectDrive);
    document.querySelectorAll('[data-settings-info]').forEach(b=>b.onclick=()=>openSettingsInfo(b.dataset.settingsInfo));
    const checkUpdate=document.querySelector('[data-check-update]'); if(checkUpdate)checkUpdate.onclick=checkForAppUpdate;
  }

  async function exportPersonalData(includeImages=false){
    const payload=await buildPersonalBackup(includeImages);
    downloadBackupPayload(payload,`MaaNote_backup_${fmtISODate(new Date())}${includeImages?'_with_images':''}.json`);
    showToast(includeImages?'画像込みデータを書き出しました':'データを書き出しました');
  }

  function openSettingsInfo(kind){
    const map={
      offline:['オフラインでできること','一度オンラインでMaaNoteを読み込んだ後は、ホーム・イベント・予定・TODO・旅程・セトリ・話したいことメモ・集計を端末保存データで確認できます。圏外でも入力内容は端末へ保存されます。公式ページ、地図、Google Driveバックアップなど通信が必要な機能はオンライン時のみ利用できます。'],
      privacy:['データの取り扱い','個人データはこの端末のIndexedDBを基本保存先にします。Google Driveを接続した場合だけ、MaaNote専用バックアップをGoogle Driveのアプリ専用データ領域へ保存します。Drive内の通常ファイルを一覧表示・読み取りする権限は要求しません。'],
      driveSetup:['Google Drive連携の設定','Google CloudのDrive APIとCloudflare Worker側のOAuth設定を有効にし、runtime-config.jsの API_BASE と DRIVE_SYNC_ENABLED を設定すると利用できます。利用者は初回にGoogleアカウントを選ぶだけで、以後の変更は自動バックアップされます。'],
      unofficial:['非公式アプリについて','MaaNoteは非公式のファン向けアプリです。佐藤優樹さん、所属事務所、レコード会社、イベント主催者・会場とは関係ありません。情報の反映・訂正に時間がかかる場合があります。イベント参加前には必ず公式サイト・公式SNS等で最新情報をご確認ください。']
    };
    const [title,body]=map[kind]||['情報','']; showSheet(`<div class="sheet-head"><div class="sheet-title">${escapeHTML(title)}</div><button class="text-btn" data-sheet-close>閉じる</button></div><div class="settings-info-text">${escapeHTML(body)}</div>`);
  }

  async function checkForAppUpdate(){
    if(!navigator.onLine){showToast('更新確認はオンライン時に利用できます');return;}
    try{
      const res=await fetch(`${VERSION_URL}?t=${Date.now()}`,{cache:'no-store'}); if(!res.ok)throw new Error('version'); const data=await res.json();
      if(data.version && data.version!==APP_VERSION) showToast(`新しい版があります：${data.version}`); else showToast('✓ この版は最新です');
      if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration();await reg?.update();}
    }catch(err){showToast('更新を確認できませんでした');}
  }

  function openQuickAddSheet(){
    const ev=homeEventCandidates()[0]||officialEvents[0];
    showSheet(`<div class="sheet-head"><div class="sheet-title">＋ 追加</div><button class="text-btn" data-sheet-close>閉じる</button></div><div class="sheet-actions-grid"><button class="sheet-card-btn primary" data-quick-schedule>今日の予定</button><button class="sheet-card-btn primary" data-quick-todo>TODO</button><button class="sheet-card-btn primary" data-quick-travel>旅程</button><button class="sheet-card-btn primary" data-quick-setlist>セトリ</button><button class="sheet-card-btn" data-quick-talk>話したいことメモ</button></div><div class="form-help">すべて端末へ自動保存され、オフラインでも確認できます。</div>`);
    sheetRoot.querySelector('[data-quick-schedule]').onclick=()=>openScheduleEditSheet(null,{date:fmtISODate(currentDate()),eventId:ev?.id||null});
    sheetRoot.querySelector('[data-quick-todo]').onclick=()=>openTodoEditSheet(null,{eventId:ev?.id||null});
    sheetRoot.querySelector('[data-quick-travel]').onclick=()=>openTravelAddSheet(ev?.id||null);
    sheetRoot.querySelector('[data-quick-setlist]').onclick=()=>openSetlistSheet(ev.id);
    sheetRoot.querySelector('[data-quick-talk]').onclick=()=>openTalkMemoSheet(ev.id);
  }

  function showSheet(html,sheetClass=''){
    const extraClass=sheetClass?` ${sheetClass}`:'';
    sheetRoot.innerHTML=`<div class="sheet-backdrop"><div class="sheet${extraClass}"><div class="sheet-grabber"></div>${html}</div></div>`;
    const backdrop=sheetRoot.querySelector('.sheet-backdrop');
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeSheet();});
    sheetRoot.querySelectorAll('[data-sheet-close]').forEach(b=>b.onclick=closeSheet);
  }
  function closeSheet(){ sheetRoot.innerHTML=''; if(state.screen==='detail')renderDetail(); else if(state.screen==='schedule')renderSchedule(); else if(state.screen==='travel')renderTravel(); else if(state.screen==='home')renderHome(); else if(state.screen==='settings')renderSettings(); }

  function activateExampleInputs(root){
    root.querySelectorAll('.example-input').forEach(el=>{
      const example=el.dataset.example||el.placeholder||'';
      el.addEventListener('focus',()=>{ el.placeholder=''; });
      el.addEventListener('blur',()=>{ if(!el.value) el.placeholder=example; });
    });
  }

  function resizeImage(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=reject;
      reader.onload=()=>{
        const img=new Image();
        img.onerror=reject;
        img.onload=()=>{
          const quality=state.settings.imageQuality||'standard';
          const cfg=quality==='low'?{maxW:1000,jpeg:.72}:quality==='high'?{maxW:2200,jpeg:.90}:{maxW:1600,jpeg:.82};
          const scale=Math.min(1,cfg.maxW/img.width); const canvas=document.createElement('canvas'); canvas.width=Math.round(img.width*scale); canvas.height=Math.round(img.height*scale);
          canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height); resolve(canvas.toDataURL('image/jpeg',cfg.jpeg));
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function updateConnectivity({announce=false}={}){
    const offline=!navigator.onLine;
    if(networkStatusEl){
      networkStatusEl.hidden=!offline;
      networkStatusEl.textContent='オフライン：端末保存データで表示中';
    }
    if(announce){
      if(offline) showToast('オフラインになりました。入力は端末に保存されます');
      else if(wasOffline) showToast('オンラインに戻りました');
    }
    wasOffline=offline;
  }

  let toastTimer=null;
  function showToast(msg){ clearTimeout(toastTimer); toastEl.textContent=msg; toastEl.classList.add('show'); toastTimer=setTimeout(()=>toastEl.classList.remove('show'),1500); }
  function escapeAttr(s){ return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  window.addEventListener('storage',async ev=>{
    if(ev.key!==SHARED_LOCAL_COMMON_KEY || API_BASE || !state.db) return;
    try{
      const result=await applySharedLocalCommonData();
      if(result.updated){
        await loadCommonData();
        if(state.screen==='home') renderHome();
        else if(state.screen==='events') renderEvents();
        else if(state.screen==='plans') renderPlans();
        else if(state.screen==='detail') renderDetail();
        else if(state.screen==='settings') renderSettings();
        showToast('✓ 管理者の更新を反映しました');
      }
    }catch(err){console.warn('shared common preview refresh failed',err)}
  });

  async function boot(){
    try { await initData(); }
    catch(err){ console.error(err); state.userPlans={}; showToast('端末保存の初期化に失敗しました'); }
    let driveAuthResult=null;
    if(!IS_VIEW_BUILD && DRIVE_SYNC_ENABLED){
      try{driveAuthResult=await handleDriveAuthReturn()}catch(err){console.warn('Drive auth return failed',err)}
    }
    render();
    if(!IS_VIEW_BUILD && DRIVE_SYNC_ENABLED){
      setTimeout(async()=>{
        if(driveAuthResult?.connected){
          const hasBackup=!!driveAuthResult.status?.file;
          const localCount=meaningfulPersonalCount();
          if(hasBackup && driveAuthResult.firstSetup){
            if(localCount===0) await openDriveRestoreSheet();
            else showExistingDriveBackupChoice();
          }else if(!hasBackup){
            try{localStorage.setItem(DRIVE_DIRTY_KEY,new Date().toISOString())}catch(_){}
            scheduleAutoDriveBackup(500);
            showToast('✓ Googleログインが完了しました');
          }else{
            await resumeAutoDriveBackup();
            showToast('✓ Googleログインが完了しました');
          }
        }else if(shouldShowNewDeviceLogin()) showStartupLoginGate();
        else if(state.settings.driveBackupMode==='auto') resumeAutoDriveBackup();
        else maybeOfferBackupChoice();
      },350);
    }
    if(state.recoveredEmergencyBackup) setTimeout(()=>showToast('端末バックアップからデータを自動復旧しました'),250);
    updateConnectivity();
    window.addEventListener('online',()=>{updateConnectivity({announce:true});scheduleAutoDriveBackup(1200);});
    window.addEventListener('offline',()=>updateConnectivity({announce:true}));
    if('BroadcastChannel' in globalThis){
      const commonChannel=new BroadcastChannel('maanote-common-data');
      commonChannel.onmessage=async()=>{
        try{ await loadCommonData(); render(); showToast('📢 管理者配信データを更新しました'); }catch(err){ console.warn(err); }
      };
    }
    if('serviceWorker' in navigator && location.protocol.startsWith('http')){
      try {
        await navigator.serviceWorker.register(SW_URL);
        await navigator.serviceWorker.ready;
      } catch(err){ console.warn('Service Worker registration failed',err); }
    }
  }
  boot();
})();
