/* Retro3DMaze leaderboard: opt-in global leaderboard; local history always works. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const nicknameInput = $('rankNickname');
  const consentInput = $('rankConsent');
  const onlineBody = $('rankOnlineRows');
  const localBody = $('rankLocalRows');
  const notice = $('rankNotice');
  const submitButton = $('rankSubmit');
  const refreshButton = $('rankRefresh');
  const KEYS = {
    player: 'retro3dmaze.player.v1',
    nickname: 'retro3dmaze.nickname.v1',
    local: 'retro3dmaze.local.v1'
  };
  const safeGet = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  let playerId = safeGet(KEYS.player);
  if (!/^[0-9a-f-]{36}$/.test(playerId || '')) {
    playerId = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3 | 8)).toString(16);
      });
    safeSet(KEYS.player, playerId);
  }
  const sanitizeName = name => String(name || '').trim().replace(/\s+/g, ' ').slice(0, 16);
  const isValidName = name => /^[\p{L}\p{N}_ -]{2,16}$/u.test(name);
  const secs = v => { const n = Math.max(0, Math.round(Number(v) || 0)); return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`; };
  const saved = safeGet(KEYS.local);
  let localEntries = [];
  try { const parsed = JSON.parse(saved || '[]'); if (Array.isArray(parsed)) localEntries = parsed.slice(0, 30); } catch {}
  let runEligible = true;
  let bestEligible = null;
  let isBusy = false;
  let cloudAvailable = false;
  let remoteEntries = [];

  function setNotice(message, type = 'info') {
    notice.textContent = message;
    notice.dataset.state = type;
  }
  function rankCompare(a,b) {
    return b.score-a.score || b.stage-a.stage || a.seconds-b.seconds;
  }
  function rowFor(entry, position, includeName) {
    const tr = document.createElement('tr');
    const values = [position, ...(includeName ? [entry.nickname || '나'] : []),
      Number(entry.score).toLocaleString('ko-KR'), entry.stage, secs(entry.seconds)];
    for(const v of values) { const td = document.createElement('td'); td.textContent = String(v); tr.appendChild(td); }
    return tr;
  }
  function renderTable(container, entries, includeName, emptyText) {
    container.replaceChildren();
    if(!entries.length) { const tr = document.createElement('tr'); const td=document.createElement('td');
      td.colSpan=includeName?5:4; td.className='rank-empty'; td.textContent=emptyText; tr.appendChild(td); container.appendChild(tr); return; }
    entries.forEach((entry,i)=>container.appendChild(rowFor(entry,i+1,includeName)));
  }
  function draw() {
    renderTable(localBody, [...localEntries].sort(rankCompare).slice(0,10), false, '아직 저장된 기록이 없습니다.');
    renderTable(onlineBody, remoteEntries, true, cloudAvailable ? '온라인 기록이 아직 없습니다.' : '서버 연결 전: 온라인 랭킹을 불러올 수 없습니다.');
    submitButton.disabled = !bestEligible || isBusy || !isValidName(sanitizeName(nicknameInput.value));
  }
  function noteLocal(record) {
    const key = `${record.stage}/${record.score}`;
    if(!localEntries.some(x => `${x.stage}/${x.score}`===key)) localEntries.unshift(record);
    localEntries = [...localEntries].sort(rankCompare).slice(0,30);
    safeSet(KEYS.local, JSON.stringify(localEntries));
    draw();
  }
  function difficultyEligible() {
    // The classic mode and custom reduced difficulty are intentionally unranked.
    return settings.mode === 'evade' && settings.rats === 5 && settings.chaser && settings.rocks === 6;
  }
  function toRecord() {
    if(!runEligible || !difficultyEligible() || autoplay || assistedStage || !cleared || !score) return null;
    return { nickname: sanitizeName(nicknameInput.value), playerId,
      score: Math.floor(score), stage: Math.floor(cleared), seconds: Math.max(1, Math.round(totalTime)),
      version: 'v8', runId: playerId };
  }
  async function requestJson(method, payload) {
    const options = {method, headers: {'Accept': 'application/json'}, cache: 'no-store'};
    if(payload) { options.headers['Content-Type']='application/json'; options.body=JSON.stringify(payload); }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    options.signal = controller.signal;
    try {
      const response = await fetch('api/leaderboard', options);
      if(!response.headers.get('content-type')?.includes('application/json')) throw new Error('온라인 랭킹 서버가 설치되지 않았습니다.');
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      return data;
    } finally { clearTimeout(timeout); }
  }
  async function refresh() {
    try {
      const data = await requestJson('GET');
      remoteEntries = Array.isArray(data.entries) ? data.entries.filter(e=>Number.isSafeInteger(e.score)&&Number.isSafeInteger(e.stage)).slice(0,20) : [];
      cloudAvailable = true;
      setNotice('공용 랭킹 연결됨 · 점수순 / 동점이면 최고 스테이지순', 'success');
    } catch(err) {
      cloudAvailable = false;
      remoteEntries=[];
      setNotice(`내 기록은 이 브라우저에 저장됩니다. ${err.message}`, 'warning');
    }
    draw();
  }
  async function submit() {
    if(isBusy || !bestEligible) return;
    const nickname = sanitizeName(nicknameInput.value);
    if(!isValidName(nickname)) { setNotice('닉네임은 2~16자의 한글·영문·숫자·공백·_·-만 사용할 수 있습니다.','warning'); return; }
    const payload = {...bestEligible, nickname};
    isBusy = true; draw();
    try {
      const response = await requestJson('POST', payload);
      cloudAvailable = true;
      setNotice(response.improved ? '온라인 랭킹에 기록을 반영했습니다.' : '이미 더 높은 개인 기록이 등록되어 있습니다.', 'success');
      await refresh();
    } catch(err) {
      setNotice(`온라인 제출 실패: ${err.message}. 내 기록은 브라우저에 보존됩니다.`, 'warning');
    } finally { isBusy=false; draw(); }
  }
  function stageCompleted() {
    if(assistedStage || autoplay || mapOpen) runEligible = false;
    const record = toRecord();
    if(!record) {
      if(settings.mode === 'evade') setNotice('이번 도전은 랭킹 제외(지도 보기·자동 탐험·난이도 변경). 클래식 게임은 랭킹에 등록되지 않습니다.', 'warning');
      return;
    }
    noteLocal(record);
    if(!bestEligible || rankCompare(record,bestEligible)<0) bestEligible=record;
    draw();
    if(consentInput.checked) void submit();
  }
  function newRun() {
    runEligible=true; bestEligible=null;
    setNotice('새 도전이 시작되었습니다. 직접 조작으로 클리어한 기록만 등록할 수 있습니다.');
    draw();
  }
  function markMapAssisted() {
    if(!runEligible) return;
    runEligible = false;
    setNotice('지도를 열어 이번 도전은 개인 최고 기록과 온라인 랭킹에서 제외됩니다. 지도를 닫아도 해제되지 않으며, 새 게임(N)부터 다시 기록할 수 있습니다.', 'warning');
    draw();
  }
  function markAssisted() {
    runEligible = false;
    setNotice('자동 탐험을 이용한 주행은 공용 랭킹에서 제외됩니다. 새 게임(N)으로 새 도전을 시작할 수 있습니다.', 'warning');
    draw();
  }
  function invalidateDifficulty() {
    if(!stopped || cleared > 0 || elapsed > 0) {
      runEligible=false;
      setNotice('게임 도중 난이도를 변경해 이번 주행은 랭킹에서 제외됩니다. 새 게임(N)으로 다시 시작하세요.', 'warning');
    }
    draw();
  }
  nicknameInput.value=sanitizeName(safeGet(KEYS.nickname)||'');
  nicknameInput.addEventListener('input',()=>{ safeSet(KEYS.nickname,sanitizeName(nicknameInput.value));draw(); });
  refreshButton.addEventListener('click',refresh);
  submitButton.addEventListener('click',submit);
  ['ratCount','rockCount','pursuerOn'].forEach(id=>$(id).addEventListener('change',invalidateDifficulty));
  window.RetroLeaderboard = {onWin:stageCompleted,newRun,markAssisted,markMapAssisted,refresh,getState:()=>({runEligible,bestEligible,cloudAvailable,remoteEntries,localEntries})};
  draw();
  if(location.protocol==='http:'||location.protocol==='https:') void refresh();
  else setNotice('파일 실행 모드: 내 기록은 저장되지만, 전 세계 랭킹은 서버에서 실행해야 사용할 수 있습니다.','warning');
})();
