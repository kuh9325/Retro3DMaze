import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const src = await fs.readFile(new URL('../public/leaderboard.js', import.meta.url), 'utf8');
const saved = new Map();
const localStorage = {
  getItem(key) { return saved.get(key) ?? null; },
  setItem(key, value) { saved.set(key, String(value)); }
};
const makeNode = () => ({
  value:'', checked:false, disabled:false, dataset:{}, children:[], textContent:'', handlers:{},
  addEventListener(name, fn) { this.handlers[name]=fn; },
  replaceChildren() { this.children=[]; },
  appendChild(child) { this.children.push(child); return child; }
});
function session() {
  const ids=['rankNickname','rankConsent','rankOnlineRows','rankLocalRows','rankNotice','rankSubmit','rankRefresh','ratCount','rockCount','pursuerOn'];
  const nodes=Object.fromEntries(ids.map(id=>[id,makeNode()]));
  const ctx={
    document:{
      getElementById(id) { assert.ok(nodes[id], 'Missing element: '+id); return nodes[id]; },
      createElement() { return makeNode(); }
    },
    localStorage, crypto:{randomUUID:()=> '123e4567-e89b-42d3-a456-426614174000'},
    window:{},location:{protocol:'file:'},
    settings:{mode:'evade',rats:5,chaser:true,rocks:6},
    autoplay:false,assistedStage:false,mapOpen:false,cleared:0,score:0,totalTime:0,stopped:false,elapsed:30,
    AbortController,TextEncoder,Response,Number,Math,Date,JSON,String,console,setTimeout,clearTimeout,
    async fetch(url,options={}) {
      if(options.method==='POST') {
        if(saved.get('fail')==='yes') return new Response(JSON.stringify({error:'Backend unavailable'}),{status:503,headers:{'content-type':'application/json'}});
        saved.set('submitted',options.body);
        return new Response(JSON.stringify({ok:true,improved:true}),{status:200,headers:{'content-type':'application/json'}});
      }
      const row=JSON.parse(saved.get('submitted')||'null');
      return new Response(JSON.stringify({entries:row?[row]:[]}),{status:200,headers:{'content-type':'application/json'}});
    }
  };
  vm.runInNewContext(src,ctx,{filename:'leaderboard.js'});
  return {nodes,ctx,board:ctx.window.RetroLeaderboard};
}
function win(s,score) {
  Object.assign(s.ctx,{cleared:1,score,totalTime:45,elapsed:45,autoplay:false,assistedStage:false});
  s.board.onWin();
}
let s=session();
s.nodes.rankNickname.value='테스트';
s.nodes.rankNickname.handlers.input();
s.board.markMapAssisted();
win(s,190);
assert.equal(s.board.getState().localEntries.length,0,'map-assisted win must not be recorded');
assert.equal(saved.has('retro3dmaze.pending.mapfree.v1'),false);
s.board.newRun();
win(s,195);
assert.equal(s.board.getState().localEntries.length,1);
assert.equal(s.nodes.rankSubmit.disabled,false);
assert.ok(saved.get('retro3dmaze.pending.mapfree.v1').includes('mapfree-v1'));
s=session();
assert.equal(s.board.getState().bestEligible.score,195,'reload restores certified record');
assert.equal(s.nodes.rankSubmit.disabled,false,'manual submit enabled after reload');
await s.nodes.rankSubmit.handlers.click();
assert.match(s.nodes.rankNotice.textContent,/온라인 저장 완료/);
assert.equal(JSON.parse(saved.get('submitted')).score,195);
saved.set('fail','yes');
await s.nodes.rankSubmit.handlers.click();
assert.match(s.nodes.rankNotice.textContent,/온라인 제출 실패/);
assert.equal(s.nodes.rankSubmit.disabled,false,'failed submit retryable');
s=session();
assert.equal(s.board.getState().bestEligible.score,195,'reload after failed submit retains score');
s.board.newRun();
assert.equal(s.board.getState().bestEligible.score,195,'new game does not clear previous best');
s.nodes.rankConsent.checked=true;
s.nodes.rankConsent.handlers.change();
s=session();
assert.equal(s.nodes.rankConsent.checked,true,'explicit auto submission consent persists');
console.log('RANKING PASS: map exclusion, local record, reload, POST, retry, consent');
