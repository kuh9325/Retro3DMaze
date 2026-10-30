/** Cloudflare Pages Function: public (trust-based) community leaderboard. */
const MAX_BODY_BYTES = 2048;
const JSON_HEADERS = { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff' };
const respond = (payload,status=200) => new Response(JSON.stringify(payload),{status,headers:JSON_HEADERS});
function validate(body) {
  if(!body || typeof body!=='object' || Array.isArray(body)) return '올바르지 않은 데이터입니다.';
  if(typeof body.nickname!=='string' || !/^[\p{L}\p{N}_ -]{2,16}$/u.test(body.nickname.trim())) return '닉네임 형식 오류';
  if(typeof body.playerId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(body.playerId)) return '플레이어 ID 오류';
  if(!Number.isSafeInteger(body.score) || !Number.isSafeInteger(body.stage) || !Number.isSafeInteger(body.seconds)) return '점수·스테이지·시간은 정수여야 합니다.';
  if(body.stage<1 || body.stage>999 || body.score<body.stage*100 || body.score>body.stage*210) return '점수와 스테이지 값이 허용 범위를 벗어났습니다.';
  if(body.seconds<body.stage || body.seconds>8640000) return '플레이 시간 범위 오류';
  if(body.version!=='v8') return '지원하지 않는 게임 버전';
  return null;
}
export async function onRequestGet({env}) {
  if(!env.RANKINGS_DB) return respond({error:'Cloudflare D1(RANKINGS_DB) 연결이 필요합니다.',entries:[]},503);
  try {
    const {results} = await env.RANKINGS_DB.prepare(`
      SELECT nickname, score, stage, seconds, updated_at AS updatedAt
      FROM leaderboard
      ORDER BY score DESC, stage DESC, seconds ASC, updated_at ASC
      LIMIT 20
    `).all();
    return respond({entries:results??[],order:'score DESC, stage DESC, seconds ASC'});
  } catch { return respond({error:'랭킹 데이터베이스를 초기화해야 합니다.'},503); }
}
export async function onRequestPost({request,env}) {
  if(!env.RANKINGS_DB) return respond({error:'Cloudflare D1(RANKINGS_DB) 연결이 필요합니다.'},503);
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin) return respond({error:'다른 사이트에서의 제출은 허용하지 않습니다.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json')) return respond({error:'JSON만 허용됩니다.'},415);
  const raw=await request.text();
  if(new TextEncoder().encode(raw).byteLength>MAX_BODY_BYTES) return respond({error:'요청이 너무 큽니다.'},413);
  let body;try{body=JSON.parse(raw);}catch{return respond({error:'JSON 형식 오류'},400);}
  const error=validate(body);if(error)return respond({error},400);
  const name=body.nickname.trim().replace(/\s+/g,' ');
  try {
    const db=env.RANKINGS_DB;
    const prior=await db.prepare('SELECT score,stage,seconds,updated_at FROM leaderboard WHERE player_id = ?').bind(body.playerId).first();
    // A modest spam throttle; for a competitive tournament, add Cloudflare Turnstile and server-side replay validation.
    if(prior && Date.now()-Date.parse(prior.updated_at)<3000) return respond({error:'잠시 후 다시 제출하세요.'},429);
    const improved=!prior || body.score>prior.score || (body.score===prior.score && (body.stage>prior.stage || (body.stage===prior.stage && body.seconds<prior.seconds)));
    if(improved){
      await db.prepare(`INSERT INTO leaderboard(player_id,nickname,score,stage,seconds,updated_at)
        VALUES(?,?,?,?,?,?)
        ON CONFLICT(player_id) DO UPDATE SET nickname=excluded.nickname,
         score=excluded.score,stage=excluded.stage,seconds=excluded.seconds,updated_at=excluded.updated_at
        WHERE excluded.score>leaderboard.score OR
         (excluded.score=leaderboard.score AND excluded.stage>leaderboard.stage) OR
         (excluded.score=leaderboard.score AND excluded.stage=leaderboard.stage AND excluded.seconds<leaderboard.seconds)`)
        .bind(body.playerId,name,body.score,body.stage,body.seconds,new Date().toISOString()).run();
    }
    return respond({ok:true,improved});
  } catch { return respond({error:'랭킹 저장에 실패했습니다. 관리자에게 문의하세요.'},503); }
}