const JSON_HEADERS = {'content-type':'application/json; charset=utf-8'};
const DRIVE_SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.appdata';
const DRIVE_FILE_NAME = 'MaaNote_prod_personal_backup_v1.json';
const DRIVE_SESSION_DAYS = 365;

function json(data,status=200,extra={}) {
  return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...extra}});
}
function normalizeEmail(v){return String(v||'').trim().toLowerCase()}
function now(){return new Date().toISOString()}
function addMs(ms){return new Date(Date.now()+ms).toISOString()}

function allowedOrigin(request,env){
  const origin=request.headers.get('Origin')||'';
  const allowed=String(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!origin) return allowed[0]||'*';
  return allowed.includes(origin)?origin:null;
}
function corsHeaders(request,env,{publicGet=false}={}){
  const origin=publicGet?'*':allowedOrigin(request,env);
  if(!origin) return null;
  return {
    'Access-Control-Allow-Origin':origin,
    'Vary':'Origin',
    'Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':'Authorization,Content-Type',
    'Access-Control-Max-Age':'86400'
  };
}

function bytesToB64url(bytes){
  let s=''; for(const b of bytes) s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64ToBytes(s){
  const raw=atob(String(s||'').replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function randomToken(bytes=32){
  const buf=new Uint8Array(bytes); crypto.getRandomValues(buf); return bytesToB64url(buf);
}
async function sha256(value){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value)));
  return bytesToB64url(new Uint8Array(digest));
}
async function aesKey(env){
  const raw=b64ToBytes(env.DRIVE_TOKEN_KEY||'');
  if(raw.length!==32) throw Object.assign(new Error('DRIVE_TOKEN_KEY が未設定です'),{status:500});
  return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function encryptSecret(value,env){
  const iv=new Uint8Array(12); crypto.getRandomValues(iv);
  const key=await aesKey(env);
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(value));
  return `${bytesToB64url(iv)}.${bytesToB64url(new Uint8Array(cipher))}`;
}
async function decryptSecret(value,env){
  const [ivText,cipherText]=String(value||'').split('.');
  const key=await aesKey(env);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(ivText)},key,b64ToBytes(cipherText));
  return new TextDecoder().decode(plain);
}
function safeReturnUrl(raw,env){
  const fallback=String(env.APP_RETURN_URL||'').trim();
  const target=new URL(raw||fallback);
  const allowed=String(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(target.protocol!=='https:' || !allowed.includes(target.origin)) throw Object.assign(new Error('return_url is not allowed'),{status:400});
  target.searchParams.delete('drive_auth');
  target.searchParams.delete('drive_auth_error');
  return target.toString();
}
function redirectWithParam(returnUrl,key,value){
  const u=new URL(returnUrl);
  u.searchParams.set(key,value);
  return Response.redirect(u.toString(),302);
}
function oauthCallbackUrl(request){
  const u=new URL(request.url);
  return `${u.origin}/api/drive/oauth/callback`;
}

async function verifyGoogleIdToken(idToken,env){
  const res=await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if(!res.ok) throw Object.assign(new Error('Googleログインを確認できません'),{status:401});
  const info=await res.json();
  const validIssuer=info.iss==='accounts.google.com'||info.iss==='https://accounts.google.com';
  const validAudience=info.aud===env.GOOGLE_CLIENT_ID;
  const validExpiry=Number(info.exp||0)>Math.floor(Date.now()/1000);
  const verified=String(info.email_verified)==='true';
  if(!validIssuer||!validAudience||!validExpiry||!verified) throw Object.assign(new Error('Googleログインを確認できません'),{status:401});
  return {sub:String(info.sub||''),email:normalizeEmail(info.email),name:String(info.name||info.email||''),picture:String(info.picture||'')};
}

async function verifyGoogle(request,env){
  const auth=request.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer ')) throw Object.assign(new Error('ログインが必要です'),{status:401});
  const token=auth.slice(7).trim();
  if(!token) throw Object.assign(new Error('ログインが必要です'),{status:401});
  return verifyGoogleIdToken(token,env);
}

async function ensureOwner(env,user){
  const owner=normalizeEmail(env.OWNER_EMAIL);
  if(!owner||user.email!==owner) return;
  await env.DB.prepare(`
    INSERT INTO admins(email,google_sub,role,status,created_at,updated_at,added_by)
    VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(email) DO UPDATE SET google_sub=excluded.google_sub,role='owner',status='active',updated_at=excluded.updated_at
  `).bind(user.email,user.sub,'owner','active',now(),now(),user.email).run();
}
async function requireAdmin(request,env,{ownerOnly=false}={}){
  const user=await verifyGoogle(request,env);
  await ensureOwner(env,user);
  const row=await env.DB.prepare('SELECT email,role,status FROM admins WHERE email=?').bind(user.email).first();
  if(!row || row.status!=='active') throw Object.assign(new Error('管理者権限がありません'),{status:403});
  if(ownerOnly && row.role!=='owner') throw Object.assign(new Error('オーナー権限が必要です'),{status:403});
  return {user,role:row.role};
}
async function getCommon(env){
  const row=await env.DB.prepare("SELECT version,payload,updated_at,updated_by FROM common_data WHERE id='current'").first();
  if(!row) return null;
  return {row,payload:JSON.parse(row.payload)};
}
async function audit(env,{action,actor,target=null,detail=null}){
  await env.DB.prepare('INSERT INTO audit_log(id,action,actor_email,target_email,detail,created_at) VALUES(?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),action,actor,target,detail?JSON.stringify(detail):null,now()).run();
}

async function exchangeGoogleCode(code,request,env){
  if(!env.GOOGLE_CLIENT_SECRET) throw Object.assign(new Error('GOOGLE_CLIENT_SECRET が未設定です'),{status:500});
  const body=new URLSearchParams({
    code,
    client_id:env.GOOGLE_CLIENT_ID,
    client_secret:env.GOOGLE_CLIENT_SECRET,
    redirect_uri:oauthCallbackUrl(request),
    grant_type:'authorization_code'
  });
  const res=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw Object.assign(new Error(data.error_description||data.error||'Google認証コードを交換できません'),{status:400});
  if(!data.id_token) throw Object.assign(new Error('Google IDを確認できません'),{status:400});
  return data;
}
async function refreshGoogleAccessToken(userRow,env){
  const refreshToken=await decryptSecret(userRow.refresh_token_enc,env);
  const body=new URLSearchParams({
    client_id:env.GOOGLE_CLIENT_ID,
    client_secret:env.GOOGLE_CLIENT_SECRET,
    refresh_token:refreshToken,
    grant_type:'refresh_token'
  });
  const res=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok || !data.access_token){
    throw Object.assign(new Error('Google Drive連携が無効になっています。もう一度Googleでログインしてください'),{status:401});
  }
  return data.access_token;
}

async function requireDriveSession(request,env){
  const auth=request.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer ')) throw Object.assign(new Error('Google Driveへログインしてください'),{status:401});
  const raw=auth.slice(7).trim();
  if(!raw) throw Object.assign(new Error('Google Driveへログインしてください'),{status:401});
  const hash=await sha256(raw);
  const row=await env.DB.prepare(`
    SELECT s.session_hash,s.google_sub,s.expires_at,u.email,u.refresh_token_enc
    FROM drive_sessions s JOIN drive_users u ON u.google_sub=s.google_sub
    WHERE s.session_hash=?
  `).bind(hash).first();
  if(!row || row.expires_at<=now()){
    if(row) await env.DB.prepare('DELETE FROM drive_sessions WHERE session_hash=?').bind(hash).run();
    throw Object.assign(new Error('Google Driveへのログイン期限が切れています'),{status:401});
  }
  const extended=addMs(DRIVE_SESSION_DAYS*24*60*60*1000);
  await env.DB.prepare('UPDATE drive_sessions SET last_used_at=?,expires_at=? WHERE session_hash=?')
    .bind(now(),extended,hash).run();
  return {sessionHash:hash,sub:row.google_sub,email:row.email,refresh_token_enc:row.refresh_token_enc};
}

async function findDriveFile(accessToken){
  const params=new URLSearchParams({
    spaces:'appDataFolder',
    q:`name = '${DRIVE_FILE_NAME}' and trashed = false`,
    fields:'files(id,name,modifiedTime,size)',
    orderBy:'modifiedTime desc',
    pageSize:'10'
  });
  const res=await fetch(`https://www.googleapis.com/drive/v3/files?${params}`,{
    headers:{Authorization:`Bearer ${accessToken}`}
  });
  if(!res.ok){
    const d=await res.json().catch(()=>({}));
    throw Object.assign(new Error(d.error?.message||'Google Driveを確認できません'),{status:res.status===401?401:502});
  }
  const data=await res.json();
  return (data.files||[])[0]||null;
}
async function uploadDriveFile(accessToken,file,content){
  if(file?.id){
    const res=await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(file.id)}?uploadType=media&fields=id,name,modifiedTime,size`,{
      method:'PATCH',
      headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json; charset=UTF-8'},
      body:content
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw Object.assign(new Error(data.error?.message||'Google Driveへ保存できません'),{status:502});
    return data;
  }
  const boundary=`maanote_${crypto.randomUUID()}`;
  const metadata=JSON.stringify({name:DRIVE_FILE_NAME,parents:['appDataFolder'],mimeType:'application/json'});
  const multipart=[
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n`,
    `--${boundary}--`
  ].join('');
  const res=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size',{
    method:'POST',
    headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':`multipart/related; boundary=${boundary}`},
    body:multipart
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw Object.assign(new Error(data.error?.message||'Google Driveへ保存できません'),{status:502});
  return data;
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const path=url.pathname;

    if(request.method==='OPTIONS'){
      const headers=corsHeaders(request,env,{publicGet:path==='/api/common-data'});
      if(!headers) return new Response(null,{status:403});
      return new Response(null,{status:204,headers});
    }

    const publicHeaders=corsHeaders(request,env,{publicGet:true});
    const secureHeaders=corsHeaders(request,env);

    try{
      if(path==='/api/health' && request.method==='GET'){
        return json({ok:true,service:'maanote-api',driveAuth:'server-refresh-token'},200,publicHeaders||{});
      }

      if(path==='/api/common-data' && request.method==='GET'){
        const current=await getCommon(env);
        if(!current) return json({error:'common-data not initialized'},404,publicHeaders||{});
        return json(current.payload,200,publicHeaders||{});
      }

      // Drive OAuth navigation endpoints.
      if(path==='/api/drive/auth/start' && request.method==='GET'){
        const returnUrl=safeReturnUrl(url.searchParams.get('return_url'),env);
        const rawState=randomToken(32);
        const stateHash=await sha256(rawState);
        await env.DB.prepare('DELETE FROM drive_oauth_states WHERE expires_at<?').bind(now()).run();
        await env.DB.prepare('INSERT INTO drive_oauth_states(state_hash,return_url,created_at,expires_at) VALUES(?,?,?,?)')
          .bind(stateHash,returnUrl,now(),addMs(10*60*1000)).run();

        const authUrl=new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id',env.GOOGLE_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri',oauthCallbackUrl(request));
        authUrl.searchParams.set('response_type','code');
        authUrl.searchParams.set('scope',DRIVE_SCOPE);
        authUrl.searchParams.set('access_type','offline');
        authUrl.searchParams.set('include_granted_scopes','true');
        authUrl.searchParams.set('prompt','consent select_account');
        authUrl.searchParams.set('state',rawState);
        return Response.redirect(authUrl.toString(),302);
      }

      if(path==='/api/drive/oauth/callback' && request.method==='GET'){
        const rawState=url.searchParams.get('state')||'';
        const code=url.searchParams.get('code')||'';
        const stateHash=rawState?await sha256(rawState):'';
        const stateRow=stateHash?await env.DB.prepare('SELECT state_hash,return_url,expires_at FROM drive_oauth_states WHERE state_hash=?').bind(stateHash).first():null;

        if(!stateRow || stateRow.expires_at<=now()){
          return new Response('MaaNote: Google認証の有効期限が切れました。アプリからもう一度ログインしてください。',{status:400,headers:{'content-type':'text/plain; charset=utf-8'}});
        }
        await env.DB.prepare('DELETE FROM drive_oauth_states WHERE state_hash=?').bind(stateHash).run();

        if(url.searchParams.get('error')){
          return redirectWithParam(stateRow.return_url,'drive_auth_error',url.searchParams.get('error'));
        }
        if(!code) return redirectWithParam(stateRow.return_url,'drive_auth_error','missing_code');

        try{
          const tokens=await exchangeGoogleCode(code,request,env);
          const user=await verifyGoogleIdToken(tokens.id_token,env);
          const existing=await env.DB.prepare('SELECT refresh_token_enc FROM drive_users WHERE google_sub=?').bind(user.sub).first();

          let refreshEnc=existing?.refresh_token_enc||null;
          if(tokens.refresh_token) refreshEnc=await encryptSecret(tokens.refresh_token,env);
          if(!refreshEnc) throw new Error('Googleの更新トークンを取得できませんでした。もう一度許可してください。');

          await env.DB.prepare(`
            INSERT INTO drive_users(google_sub,email,refresh_token_enc,created_at,updated_at)
            VALUES(?,?,?,?,?)
            ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email,refresh_token_enc=excluded.refresh_token_enc,updated_at=excluded.updated_at
          `).bind(user.sub,user.email,refreshEnc,now(),now()).run();

          const ticket=randomToken(32);
          const ticketHash=await sha256(ticket);
          await env.DB.prepare('DELETE FROM drive_login_tickets WHERE expires_at<?').bind(now()).run();
          await env.DB.prepare('INSERT INTO drive_login_tickets(ticket_hash,google_sub,created_at,expires_at) VALUES(?,?,?,?)')
            .bind(ticketHash,user.sub,now(),addMs(5*60*1000)).run();

          return redirectWithParam(stateRow.return_url,'drive_auth',ticket);
        }catch(err){
          return redirectWithParam(stateRow.return_url,'drive_auth_error','token_exchange_failed');
        }
      }

      if(!secureHeaders) return json({error:'Origin not allowed'},403,{});

      if(path==='/api/drive/session/exchange' && request.method==='POST'){
        const body=await request.json().catch(()=>({}));
        const raw=String(body.code||'');
        const hash=raw?await sha256(raw):'';
        const ticket=hash?await env.DB.prepare(`
          SELECT t.ticket_hash,t.google_sub,t.expires_at,u.email
          FROM drive_login_tickets t JOIN drive_users u ON u.google_sub=t.google_sub
          WHERE t.ticket_hash=?
        `).bind(hash).first():null;
        if(!ticket || ticket.expires_at<=now()) return json({error:'ログイン確認の有効期限が切れました'},401,secureHeaders);

        await env.DB.prepare('DELETE FROM drive_login_tickets WHERE ticket_hash=?').bind(hash).run();
        const rawSession=randomToken(48);
        const sessionHash=await sha256(rawSession);
        const t=now();
        await env.DB.prepare('INSERT INTO drive_sessions(session_hash,google_sub,created_at,expires_at,last_used_at) VALUES(?,?,?,?,?)')
          .bind(sessionHash,ticket.google_sub,t,addMs(DRIVE_SESSION_DAYS*24*60*60*1000),t).run();

        return json({sessionToken:rawSession,user:{email:ticket.email}},200,secureHeaders);
      }

      if(path==='/api/drive/status' && request.method==='GET'){
        const session=await requireDriveSession(request,env);
        const access=await refreshGoogleAccessToken(session,env);
        const file=await findDriveFile(access);
        return json({connected:true,user:{email:session.email},file},200,secureHeaders);
      }

      if(path==='/api/drive/backup' && request.method==='GET'){
        const session=await requireDriveSession(request,env);
        const access=await refreshGoogleAccessToken(session,env);
        const file=await findDriveFile(access);
        if(!file?.id) return json({error:'Google DriveにMaaNoteのバックアップがありません'},404,secureHeaders);
        const res=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,{
          headers:{Authorization:`Bearer ${access}`}
        });
        const text=await res.text();
        if(!res.ok) return json({error:'Google Driveからバックアップを取得できません'},502,secureHeaders);
        const backup=JSON.parse(text);
        return json({user:{email:session.email},file,backup},200,secureHeaders);
      }

      if(path==='/api/drive/backup' && request.method==='PUT'){
        const session=await requireDriveSession(request,env);
        const raw=await request.text();
        if(raw.length>15_000_000) return json({error:'バックアップが大きすぎます'},413,secureHeaders);
        let payload;
        try{payload=JSON.parse(raw)}catch(_){return json({error:'バックアップJSONが不正です'},400,secureHeaders)}
        if(payload?.format!=='MaaNote-export') return json({error:'MaaNoteバックアップではありません'},400,secureHeaders);

        const access=await refreshGoogleAccessToken(session,env);
        const current=await findDriveFile(access);
        const file=await uploadDriveFile(access,current,raw);
        return json({ok:true,user:{email:session.email},file},200,secureHeaders);
      }

      if(path==='/api/drive/session' && request.method==='DELETE'){
        const session=await requireDriveSession(request,env);
        await env.DB.prepare('DELETE FROM drive_sessions WHERE session_hash=?').bind(session.sessionHash).run();
        return json({ok:true},200,secureHeaders);
      }

      // Existing admin endpoints.
      if(path==='/api/me' && request.method==='GET'){
        const auth=await requireAdmin(request,env);
        return json({user:auth.user,role:auth.role},200,secureHeaders);
      }

      if(path==='/api/admins' && request.method==='GET'){
        await requireAdmin(request,env,{ownerOnly:true});
        const {results=[]}=await env.DB.prepare('SELECT email,role,status,created_at,updated_at,added_by FROM admins ORDER BY role DESC,email ASC').all();
        return json({admins:results},200,secureHeaders);
      }

      if(path==='/api/admins' && request.method==='POST'){
        const auth=await requireAdmin(request,env,{ownerOnly:true});
        const body=await request.json();
        const email=normalizeEmail(body.email);
        const role=body.role==='owner'?'owner':'admin';
        if(!email || !email.includes('@')) return json({error:'有効なメールアドレスを入力してください'},400,secureHeaders);
        await env.DB.prepare(`
          INSERT INTO admins(email,role,status,created_at,updated_at,added_by)
          VALUES(?,?,?,?,?,?)
          ON CONFLICT(email) DO UPDATE SET role=excluded.role,status='active',updated_at=excluded.updated_at,added_by=excluded.added_by
        `).bind(email,role,'active',now(),now(),auth.user.email).run();
        await audit(env,{action:'admin_upsert',actor:auth.user.email,target:email,detail:{role,status:'active'}});
        return json({ok:true},200,secureHeaders);
      }

      if(path.startsWith('/api/admins/') && request.method==='PATCH'){
        const auth=await requireAdmin(request,env,{ownerOnly:true});
        const email=normalizeEmail(decodeURIComponent(path.slice('/api/admins/'.length)));
        const body=await request.json();
        const status=body.status==='disabled'?'disabled':'active';
        const role=body.role==='owner'?'owner':(body.role==='admin'?'admin':null);
        if(email===normalizeEmail(env.OWNER_EMAIL) && status==='disabled') return json({error:'初期オーナーは停止できません'},400,secureHeaders);
        const current=await env.DB.prepare('SELECT email,role,status FROM admins WHERE email=?').bind(email).first();
        if(!current) return json({error:'管理者が見つかりません'},404,secureHeaders);
        await env.DB.prepare('UPDATE admins SET status=?,role=?,updated_at=? WHERE email=?')
          .bind(status,role||current.role,now(),email).run();
        await audit(env,{action:'admin_update',actor:auth.user.email,target:email,detail:{status,role:role||current.role}});
        return json({ok:true},200,secureHeaders);
      }

      if(path==='/api/publish' && request.method==='POST'){
        const auth=await requireAdmin(request,env);
        const raw=await request.text();
        if(raw.length>1_000_000) return json({error:'配信データが大きすぎます'},413,secureHeaders);
        const body=JSON.parse(raw||'{}');
        if(!Array.isArray(body.events)||!Array.isArray(body.otherItems)) return json({error:'events / otherItems が必要です'},400,secureHeaders);
        if(body.events.length>500 || body.otherItems.length>1000) return json({error:'配信件数が多すぎます'},400,secureHeaders);

        const current=await getCommon(env);
        const baseVersion=Number(body.baseVersion||0);
        if(current && Number(current.row.version)!==baseVersion) return json({error:'他の管理者が先に更新しています',currentVersion:Number(current.row.version)},409,secureHeaders);

        const nextVersion=current ? Number(current.row.version)+1 : Math.max(0,baseVersion)+1;
        const updatedAt=now();
        const summary=String(body.summary||'管理者情報を更新しました').slice(0,300);
        const publicHistory=Array.isArray(current?.payload?.history)?current.payload.history.slice(-99):[];
        publicHistory.push({id:crypto.randomUUID(),version:nextVersion,publishedAt:updatedAt,entityType:'batch',entityId:'common',summary});
        const payload={
          format:'MaaNote-common-data',version:1,
          publishMeta:{key:'publish',version:nextVersion,updatedAt,summary},
          events:body.events,otherItems:body.otherItems,history:publicHistory,exportedAt:updatedAt
        };
        const payloadText=JSON.stringify(payload);

        if(current){
          const result=await env.DB.prepare("UPDATE common_data SET version=?,payload=?,updated_at=?,updated_by=? WHERE id='current' AND version=?")
            .bind(nextVersion,payloadText,updatedAt,auth.user.email,Number(current.row.version)).run();
          if(!result.meta?.changes) return json({error:'他の管理者が先に更新しています'},409,secureHeaders);
        }else{
          const result=await env.DB.prepare("INSERT OR IGNORE INTO common_data(id,version,payload,updated_at,updated_by) VALUES('current',?,?,?,?)")
            .bind(nextVersion,payloadText,updatedAt,auth.user.email).run();
          if(!result.meta?.changes) return json({error:'初期公開が競合しました。再読み込みしてください'},409,secureHeaders);
        }

        await audit(env,{action:'publish',actor:auth.user.email,detail:{version:nextVersion,summary}});
        return json({ok:true,commonData:payload},200,secureHeaders);
      }

      return json({error:'not found'},404,secureHeaders);
    }catch(err){
      console.error(err);
      const status=Number(err.status)||500;
      const headers=secureHeaders||publicHeaders||{};
      return json({error:status>=500?'サーバー処理に失敗しました':err.message},status,headers);
    }
  }
};
