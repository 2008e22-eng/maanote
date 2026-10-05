const JSON_HEADERS = {'content-type':'application/json; charset=utf-8'};

function json(data,status=200,extra={}) {
  return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...extra}});
}

function normalizeEmail(v){return String(v||'').trim().toLowerCase()}
function now(){return new Date().toISOString()}

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
    'Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers':'Authorization,Content-Type',
    'Access-Control-Max-Age':'86400'
  };
}

async function verifyGoogle(request,env){
  const auth=request.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer ')) throw Object.assign(new Error('ログインが必要です'),{status:401});
  const token=auth.slice(7).trim();
  if(!token) throw Object.assign(new Error('ログインが必要です'),{status:401});

  const res=await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
  if(!res.ok) throw Object.assign(new Error('Googleログインを確認できません'),{status:401});
  const info=await res.json();

  const validIssuer=info.iss==='accounts.google.com'||info.iss==='https://accounts.google.com';
  const validAudience=info.aud===env.GOOGLE_CLIENT_ID;
  const validExpiry=Number(info.exp||0)>Math.floor(Date.now()/1000);
  const verified=String(info.email_verified)==='true';
  if(!validIssuer||!validAudience||!validExpiry||!verified) {
    throw Object.assign(new Error('Googleログインを確認できません'),{status:401});
  }
  return {
    sub:String(info.sub||''),
    email:normalizeEmail(info.email),
    name:String(info.name||info.email||''),
    picture:String(info.picture||'')
  };
}

async function ensureOwner(env,user){
  const owner=normalizeEmail(env.OWNER_EMAIL);
  if(!owner||user.email!==owner) return;
  await env.DB.prepare(`
    INSERT INTO admins(email,google_sub,role,status,created_at,updated_at,added_by)
    VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(email) DO UPDATE SET
      google_sub=excluded.google_sub,
      role='owner',
      status='active',
      updated_at=excluded.updated_at
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
  const payload=JSON.parse(row.payload);
  return {row,payload};
}

async function audit(env,{action,actor,target=null,detail=null}){
  await env.DB.prepare('INSERT INTO audit_log(id,action,actor_email,target_email,detail,created_at) VALUES(?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),action,actor,target,detail?JSON.stringify(detail):null,now()).run();
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
        return json({ok:true,service:'maanote-admin-api'},200,publicHeaders||{});
      }

      if(path==='/api/common-data' && request.method==='GET'){
        const current=await getCommon(env);
        if(!current) return json({error:'common-data not initialized'},404,publicHeaders||{});
        return json(current.payload,200,publicHeaders||{});
      }

      if(!secureHeaders) return json({error:'Origin not allowed'},403,{});

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

        if(email===normalizeEmail(env.OWNER_EMAIL) && status==='disabled'){
          return json({error:'初期オーナーは停止できません'},400,secureHeaders);
        }
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
        if(!Array.isArray(body.events)||!Array.isArray(body.otherItems)){
          return json({error:'events / otherItems が必要です'},400,secureHeaders);
        }
        if(body.events.length>500 || body.otherItems.length>1000){
          return json({error:'配信件数が多すぎます'},400,secureHeaders);
        }

        const current=await getCommon(env);
        const baseVersion=Number(body.baseVersion||0);
        if(current && Number(current.row.version)!==baseVersion){
          return json({error:'他の管理者が先に更新しています',currentVersion:Number(current.row.version)},409,secureHeaders);
        }

        const nextVersion=current ? Number(current.row.version)+1 : Math.max(0,baseVersion)+1;
        const updatedAt=now();
        const summary=String(body.summary||'管理者情報を更新しました').slice(0,300);
        const publicHistory=Array.isArray(current?.payload?.history)?current.payload.history.slice(-99):[];
        publicHistory.push({
          id:crypto.randomUUID(),
          version:nextVersion,
          publishedAt:updatedAt,
          entityType:'batch',
          entityId:'common',
          summary
        });

        const payload={
          format:'MaaNote-common-data',
          version:1,
          publishMeta:{key:'publish',version:nextVersion,updatedAt,summary},
          events:body.events,
          otherItems:body.otherItems,
          history:publicHistory,
          exportedAt:updatedAt
        };
        const payloadText=JSON.stringify(payload);

        if(current){
          const result=await env.DB.prepare(
            "UPDATE common_data SET version=?,payload=?,updated_at=?,updated_by=? WHERE id='current' AND version=?"
          ).bind(nextVersion,payloadText,updatedAt,auth.user.email,Number(current.row.version)).run();
          if(!result.meta?.changes){
            return json({error:'他の管理者が先に更新しています'},409,secureHeaders);
          }
        }else{
          const result=await env.DB.prepare(
            "INSERT OR IGNORE INTO common_data(id,version,payload,updated_at,updated_by) VALUES('current',?,?,?,?)"
          ).bind(nextVersion,payloadText,updatedAt,auth.user.email).run();
          if(!result.meta?.changes){
            return json({error:'初期公開が競合しました。再読み込みしてください'},409,secureHeaders);
          }
        }

        await audit(env,{action:'publish',actor:auth.user.email,detail:{version:nextVersion,summary}});
        return json({ok:true,commonData:payload},200,secureHeaders);
      }

      return json({error:'Not found'},404,secureHeaders||publicHeaders||{});
    }catch(err){
      console.error(err);
      return json({error:err?.message||'Server error'},err?.status||500,secureHeaders||publicHeaders||{});
    }
  }
};
