// script.js — Stable v7+ (sidebar + visual feedback + auto-advance 5s when 1 per page)
(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;

  // ---------- Data loading (robust) ----------
  let data = [];
  function loadData(){
    try{
      const el = $('#data');
      if(el && el.textContent.trim()) data = JSON.parse(el.textContent);
    }catch{}
    try{
      if(!Array.isArray(data) || !data.length){
        if(Array.isArray(window.__QUESTIONS)) data = window.__QUESTIONS;
        else if(Array.isArray(window.__BANK)) data = window.__BANK;
      }
    }catch{}
    try{
      if(!Array.isArray(data) || !data.length){
        const raw = localStorage.getItem('quiz-upload');
        if(raw) data = JSON.parse(raw);
      }
    }catch{}
    if(!Array.isArray(data)) data = [];
    data.forEach((q,i)=> { if(typeof q.num!=='number') q.num=i+1; });
  }
  loadData();

  // ---------- State ----------
  const state = {
    idx: 0,
    answers: {},     // num -> key
    locked: {},      // num -> true
    finished: false,
    filter: 'all',   // all | pending | answered | wrong
  };

  // ---------- Refs ----------
  const elQS   = $('#qs');
  const elSum  = $('#sum');
  const bar    = $('#bar');
  const status = $('#status');

  const grid   = $('#grid');
  const chips  = $$('.side-controls .chip');

  const btnPrev   = $('#prev');
  const btnNext   = $('#next');
  const btnReveal = $('#reveal');
  const btnReset  = $('#reset');
  const btnFinish = $('#finish');
  const btnPause  = $('#pause');

  const pageSizeSel = $('#pageSize');
  const themeBtn    = $('#theme');
  const fontSel     = $('#fontSel');

  
  // Ensure Pause button (left of Reset) and Timed toggle near timer
  function ensurePauseButton(){
    const reset = document.getElementById('reset');
    if(!reset) return null;
    let p = document.getElementById('pause');
    if(!p){
      p = document.createElement('button');
      p.id='pause'; p.className='btn'; p.title='Pausar/Continuar'; p.textContent='⏸ Pausa';
      reset.parentNode.insertBefore(p, reset);
    }
    return p;
  }
  function ensureTimedToggle(){
    const timer = document.getElementById('timer');
    if(!timer || document.getElementById('timedToggle')) return;
    const t = document.createElement('button');
    t.id='timedToggle'; t.className='chip'; t.style.marginLeft='8px';
    timer.parentNode.insertBefore(t, timer.nextSibling);
  }
  function syncTimedUI(){
    ensureTimedToggle();
    const t = document.getElementById('timedToggle');
    const p = ensurePauseButton();
    if(t) t.textContent = state.timed ? '⏱ Tiempo: ON' : '⏱ Tiempo: OFF';
    if(p){ p.style.display = state.timed ? '' : 'none'; p.disabled = !state.timed; }
  }

  // ---------- Theme / font ----------
  themeBtn?.addEventListener('click', () => {
    const cur = root.getAttribute('data-theme') || 'dark';
    const next = cur==='dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try{ localStorage.setItem('quiz-theme', next); }catch{}
  });
  try{ const t=localStorage.getItem('quiz-theme'); if(t) root.setAttribute('data-theme', t);}catch{}
  fontSel?.addEventListener('change', (e)=> root.style.setProperty('--ff', e.target.value));
  $('#bigger')?.addEventListener('click', ()=>{
    const fs = parseFloat(getComputedStyle(root).getPropertyValue('--fs')||'16');
    root.style.setProperty('--fs', (fs+1)+'px');
  });
  $('#smaller')?.addEventListener('click', ()=>{
    const fs = parseFloat(getComputedStyle(root).getPropertyValue('--fs')||'16');
    root.style.setProperty('--fs', Math.max(12, fs-1)+'px');
  });

  // ---------- Timer + Pause ----------
  let start = Date.now(), paused=false, pausedAt=0, accPaused=0;
  const totalSecs = (data.length||0) * 60;
  const fmt = t => { const m=String(Math.floor(t/60)).padStart(2,'0'); const s=String(t%60).padStart(2,'0'); return `${m}:${s}`; };
  const elapsed = () => { const now=Date.now(); const live=paused?(now-pausedAt):0; return Math.max(0, Math.floor((now-start-accPaused-live)/1000)); };
  function refreshTimer(){ const el=$('#timer'); if(!el) return; if(!state.timed){ el.textContent='⏱ — / —'; return;} el.textContent = `⏱ ${fmt(elapsed())} / ${fmt(totalSecs)}` + (paused?' (en pausa)':''); }
  setInterval(()=>{ if(!paused){ refreshTimer(); if(state.timed && elapsed()>=totalSecs){ document.querySelectorAll('input[type=radio]').forEach(x=>x.disabled=true); const p=document.getElementById('pause'); if(p) p.disabled=true; const r=document.getElementById('reveal'); if(r) r.disabled=true; state.finished=true; } } }, 1000); refreshTimer();
  btnPause?.addEventListener('click', ()=>{
    if(!paused){ paused=true; pausedAt=Date.now(); btnPause.textContent='▶️ Reanudar'; }
    else { paused=false; accPaused += Date.now()-pausedAt; pausedAt=0; btnPause.textContent='⏸ Pausa'; refreshTimer(); }
  });


  try{ state.timed = JSON.parse(localStorage.getItem('quiz-timed')||'true'); }catch(e){ state.timed = true; }
  ensureTimedToggle(); syncTimedUI();
  document.getElementById('timedToggle')?.addEventListener('click', ()=>{
    state.timed = !state.timed;
    try{ localStorage.setItem('quiz-timed', JSON.stringify(state.timed)); }catch(e){}
    if(!state.timed){ paused=false; const p=document.getElementById('pause'); if(p) p.textContent='⏸ Pausa'; }
    syncTimedUI(); refreshTimer();
  });
  (ensurePauseButton())?.addEventListener('click', ()=>{
    if(!state.timed) return;
    if(!paused){ paused=true; pausedAt=Date.now(); const p=document.getElementById('pause'); if(p) p.textContent='▶️ Reanudar'; }
    else{ paused=false; accPaused += Date.now()-pausedAt; pausedAt=0; const p=document.getElementById('pause'); if(p) p.textContent='⏸ Pausa'; refreshTimer(); }
  });

  // ---------- Pagination ----------
  const getPageSize = ()=> parseInt(pageSizeSel?.value || '1', 10) || 1;
  function bounds(){
    const size=getPageSize();
    const start = Math.floor(state.idx/size)*size;
    const end   = Math.min(data.length, start+size);
    return {start, end};
  }
  pageSizeSel?.addEventListener('change', ()=> render(bounds().start));

  // ---------- Cleaning footer noise ----------
  function cleanFooterNoise(s){
    if(!s) return s;
    s = s.replace(/B\s*\d+\s*T\s*\d+[\s\S]*$/u, '');
    s = s.replace(/\bB(?:\s*[A-ZÁÉÍÓÚÑ0-9\.]){8,}[\s\S]*$/u, '');
    s = s.replace(/https?:\/\/\S+|www\.\S+/gi,'').replace(/Página\s+\d+/gi,'');
    return s.replace(/\s{2,}/g,' ').trim();
  }
  function getOptionText(q, key){
    const o = (q.options||[]).find(x=>x.key===key);
    return o ? (o.text||'') : '';
  }

  // ---------- Progress + sidebar ----------
  function stats(){
    let c=0,w=0,a=0;
    for(const q of data){ const g=state.answers[q.num]; if(!g) continue; a++; if(g===q.answer) c++; else w++; }
    return {c,w,a};
  }
  function progress(){
    const {a}=stats(); const total=data.length||0; const pct = total? Math.round(a*100/total):0;
    if(bar) bar.style.width = pct+'%';
    if(status){ const {start,end}=bounds(); status.textContent = `${a}/${total} respondidas · viendo ${total? (start+1)+'–'+end : '—'}`; }
  }
  chips.forEach(ch=>{
    ch.addEventListener('click', ()=>{
      chips.forEach(x=>x.classList.remove('active'));
      ch.classList.add('active');
      state.filter = ch.dataset.filter || 'all';
      refreshGrid();
    });
  });
  function refreshGrid(){
    if(!grid) return;
    grid.innerHTML='';
    const {start,end}=bounds();
    data.forEach((q,i)=>{
      const g = state.answers[q.num];
      const pending = !g, wrong = g && g!==q.answer, answered = !!g;
      if(state.filter==='pending' && !pending) return;
      if(state.filter==='answered' && !answered) return;
      if(state.filter==='wrong' && !wrong) return;
      const b = document.createElement('button');
      b.className = 'qbtn' + (answered?' ans':'') + (wrong?' ko':'') + (!wrong && answered ? ' ok':'') + (i>=start&&i<end?' active':'');
      b.textContent = q.num;
      b.addEventListener('click', ()=>{ state.idx=i; render(state.idx); });
      grid.appendChild(b);
    });
  }

  // ---------- Render ----------
  function render(i){
    if(!Array.isArray(data) || !data.length){
      elQS.innerHTML = `<div class="card">No hay preguntas cargadas.</div>`; progress(); refreshGrid(); return;
    }
    state.idx = Math.max(0, Math.min(i, data.length-1));
    const {start,end} = bounds();
    elSum.style.display='none'; elQS.style.display='flex';
    if(btnPrev) btnPrev.disabled = start===0;
    if(btnNext) btnNext.disabled = end>=data.length;

    elQS.innerHTML='';
    for(let k=start; k<end; k++){
      const q = data[k];
      const given = state.answers[q.num];
      const locked = !!state.locked[q.num] || state.finished;
      const lockBadge = locked ? `<span class="lock-ico" title="Respondida">🔒</span>` : '';
      const card = document.createElement('div');
      card.className='card';
      card.innerHTML = `
        <div class="qhead"><div class="qid">#${q.num}</div><div>${cleanFooterNoise(q.question||'')}</div>${lockBadge}</div>
        <div class="opts"></div>
        <div class="feedback" id="fb-${q.num}"></div>`;
      const opts = card.querySelector('.opts');
      (q.options||[]).forEach(o=>{
        const row = document.createElement('label');
        row.className = 'opt' + (locked?' locked':'');
        row.innerHTML = `
          <input type="radio" name="q${q.num}" value="${o.key}" ${given===o.key?'checked':''} ${locked?'disabled':''}>
          <div class="opt-body">
            <span class="opt-key">${o.key})</span>
            <span class="opt-text"><code>${cleanFooterNoise(o.text||'')}</code></span>
            <span class="opt-mark"></span>
          </div>`;
        opts.appendChild(row);
      });
      elQS.appendChild(card);
      if(given){ paintResultForCard(card, q, given); } // si ya estaba contestada
    }

    // Listeners
    if(!state.finished){
      elQS.querySelectorAll('input[type=radio]').forEach(r=>{
        r.addEventListener('change', e=>{
          const num = parseInt(e.target.name.slice(1),10);
          if(state.locked[num]) return;
          const chosen = e.target.value;
          state.answers[num]=chosen;
          state.locked[num]=true;
          // deshabilitar
          elQS.querySelectorAll(`input[name="q${num}"]`).forEach(x=> x.disabled=true);
          // feedback visual
          const q = data.find(qq=> qq.num===num);
          const card = e.target.closest('.card');
          if(card && q) paintResultForCard(card, q, chosen);
          refreshGrid();
          // auto-advance si 1 por página
          if(getPageSize()===1){
            setTimeout(()=>{
              const nextIdx = Math.min(data.length-1, state.idx+1);
              render(nextIdx);
              window.scrollTo({top:0, behavior:'smooth'});
            }, 5000);
          }else{
            progress();
          }
        });
      });
    }

    progress();
    refreshGrid();
  }

  function paintResultForCard(card, q, chosen){
    if(!card || !q) return;
    const correctKey = q.answer;
    const ok = chosen === correctKey;
    // Marcar iconos en las opciones
    card.querySelectorAll('.opt').forEach(lbl=>{
      const input = lbl.querySelector('input[type=radio]'); if(!input) return;
      const mark = lbl.querySelector('.opt-mark'); if(mark) mark.textContent='';
      lbl.classList.remove('ok','ko');
      if(input.value === chosen){
        lbl.classList.add(ok ? 'ok' : 'ko');
        if(mark) mark.textContent = ok ? '✓' : '✕';
      }
      if(!ok && input.value === correctKey){
        lbl.classList.add('ok');
        const m2 = lbl.querySelector('.opt-mark'); if(m2 && !m2.textContent) m2.textContent='✓';
      }
    });
    // Explicación debajo
    const fb = card.querySelector('#fb-'+q.num);
    if(fb){
      const correctText = cleanFooterNoise(getOptionText(q, correctKey));
      fb.innerHTML = `<div class="explain">Respuesta correcta: <b>${correctKey}</b>) <code>${correctText}</code></div>`;
    }
  }

  
  // ----- Pretty Confirm Modal -----
  function showConfirm(opts){
    const {title='¿Finalizar?', message='¿Finalizar el test y ver estadísticas?', okText='Finalizar', cancelText='Cancelar'} = opts||{};
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-h">${title}</div>
        <div class="modal-b">${message}</div>
        <div class="modal-f">
          <button class="btn ghost" id="mCancel">${cancelText}</button>
          <button class="btn primary" id="mOk">${okText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    return new Promise(res=>{
      overlay.addEventListener('click', (e)=>{
        if(e.target.id==='mOk'){ res(true); overlay.remove(); }
        if(e.target.id==='mCancel' || e.target===overlay){ res(false); overlay.remove(); }
      });
    });
  }

  // Reveal
  btnReveal?.addEventListener('click', ()=>{
    const q = data[state.idx]; if(!q) return;
    const cards = $$('.card');
    const card = cards.find(c => c.querySelector('.qid')?.textContent.includes('#'+q.num)) || cards[0];
    if(card) paintResultForCard(card, q, state.answers[q.num] || '');
  });

  // Prev/Next
  btnPrev?.addEventListener('click', ()=>{ const {start}=bounds(); render(Math.max(0,start-1)); window.scrollTo({top:0,behavior:'smooth'}); });
  btnNext?.addEventListener('click', ()=>{ const {end}=bounds(); render(Math.min(data.length-1,end)); window.scrollTo({top:0,behavior:'smooth'}); });

  // Reset
  btnReset?.addEventListener('click', ()=>{
    if(!confirm('¿Reiniciar el test completo?')) return;
    state.idx=0; state.answers={}; state.locked={}; state.finished=false;
    start=Date.now(); accPaused=0; paused=false; if(btnPause) btnPause.textContent='⏸ Pausa';
    render(0);
  });

  // Finish
  btnFinish?.addEventListener('click', async ()=>{
    const proceed = await showConfirm({
      title: 'Finalizar test',
      message: 'Se guardarán tus respuestas y verás estadísticas detalladas.',
      okText: 'Ver estadísticas',
      cancelText: 'Seguir'
    });
    if(!proceed) return;
    const total = data.length||0;
    let correct=0, wrong=0, answered=0;
    const rows = [];
    (data||[]).forEach(q=>{
      const chosen = state.answers[q.num];
      const ok = chosen && chosen===q.answer;
      if(chosen){ answered++; if(ok) correct++; else wrong++; }
      rows.push({
        num: q.num,
        question: q.question,
        correct: q.answer,
        chosen: chosen || '',
        correct_text: (q.options||[]).find(o=>o.key===q.answer)?.text || '',
        chosen_text: (q.options||[]).find(o=>o.key===chosen)?.text || ''
      });
    });
    const score10 = Math.max(0, (correct - 0.33*wrong) * 10 / Math.max(1,total));
    const result = {
      timestamp: new Date().toISOString(),
      totals: { total, correct, wrong, answered, unanswered: total-answered },
      score10: Number(score10.toFixed(2)),
      elapsedSec: elapsed(),
      theme: root.getAttribute('data-theme') || 'dark',
      answers: state.answers,
      rows
    };
    try{ localStorage.setItem('quiz-result', JSON.stringify(result)); }catch(e){}
    // Go to stats with review mode marker
    location.href = 'stats.html#review=1';
  });// Go!
  render(0);
  refreshTimer();
  maybeEnterReview();
})();
