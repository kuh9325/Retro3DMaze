import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const src = await fs.readFile(new URL('../functions/api/leaderboard.js', import.meta.url),'utf8');
const {onRequestGet,onRequestPost}=await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
const valid={nickname:'테스트',playerId:'123e4567-e89b-42d3-a456-426614174000',score:190,stage:1,seconds:45,version:'v8'};
const rows = new Map();
const fakeDB = {
 prepare(sql) {
   let args=[];
   return {
     bind(...a){ args=a; return this; },
     async first(){ return rows.get(args[0]) || null; },
     async all(){ return {results:[...rows.values()].sort((a,b)=>b.score-a.score||b.stage-a.stage||a.seconds-b.seconds).slice(0,20)}; },
     async run(){ const [player_id,nickname,score,stage,seconds,updated_at]=args;rows.set(player_id,{nickname,score,stage,seconds,updated_at});return {success:true}; }
   };
 }
};
const post=async(body,env={RANKINGS_DB:fakeDB},headers={})=>onRequestPost({env,request:new Request('https://example.com/api/leaderboard',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)})});
let r=await post(valid);assert.equal(r.status,200);assert.equal((await r.json()).improved,true);
r=await onRequestGet({env:{RANKINGS_DB:fakeDB}});assert.equal(r.status,200);assert.equal((await r.json()).entries[0].nickname,'테스트');
r=await post({...valid,score:99999});assert.equal(r.status,400);
r=await post({...valid,nickname:'<img src=x>'});assert.equal(r.status,400);
r=await post(valid,undefined,{'Origin':'https://evil.invalid'});assert.equal(r.status,403);
r=await onRequestGet({env:{}});assert.equal(r.status,503);
console.log('BACKEND PASS: save, read, range, invalid name, origin, no binding');