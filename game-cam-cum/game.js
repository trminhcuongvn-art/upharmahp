// Upharma Pharmacy Rush v2 — DOM interactive game with screening step + refer + knowledge cards
(() => {
  const root = document.getElementById('stage');
  const startScreen = document.getElementById('startScreen');
  const endScreen = document.getElementById('endScreen');
  const startBtn = document.getElementById('startBtn');
  const againBtn = document.getElementById('againBtn');
  const endTitle = document.getElementById('endTitle');
  const endStats = document.getElementById('endStats');

  let DATA = null;
  let ACTIONS = []; // fallback only; v4 uses case-specific actions
  let state = 'idle';
  let queue = [], qi = 0;
  let score = 0, rep = 5, served = 0, streak = 0, level = 1;
  let totalMission = 10, earnedMilestones = new Set();
  let cur = null, phase = 'screen', screenedOk = 0, timeLeft = 0, timeMax = 0, timer = null;
  let metrics = { total: 0, correct: 0, refer_total: 0, refer_correct: 0, danger: 0 };

  function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;}

  function el(tag, cls, html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}

  function startGame(){
    score=0;rep=5;served=0;streak=0;level=1;
    metrics={total:0,correct:0,refer_total:0,refer_correct:0,danger:0};
    queue=shuffle(DATA.cases).slice(0, DATA.mission?.total_questions || 10);qi=0;totalMission=queue.length;earnedMilestones=new Set();
    state='play';
    startScreen.classList.add('hide');endScreen.classList.add('hide');
    nextCustomer();
  }

  function nextCustomer(){
    if(rep<=0)return gameOver(false);
    if(qi>=queue.length)return gameOver(true);
    cur=queue[qi];qi++;served++;
    level=1+Math.floor((served-1)/4);
    timeMax=Math.max(6,16-level*1.5);
    phase='screen';screenedOk=0;
    render();
    startTimer();
  }

  function startTimer(){
    stopTimer();timeLeft=timeMax;
    const bar=document.getElementById('timebar');
    timer=setInterval(()=>{
      timeLeft-=0.1;
      const frac=Math.max(0,timeLeft/timeMax);
      if(bar){bar.style.width=(frac*100)+'%';bar.style.background=frac>0.4?'#34d399':(frac>0.2?'#fbbf24':'#f87171');}
      if(timeLeft<=0){stopTimer();onTimeout();}
    },100);
  }
  function stopTimer(){if(timer){clearInterval(timer);timer=null;}}

  function onTimeout(){
    streak=0;rep-=1;
    flash('⌛ Hết giờ! Khách bỏ đi','#fbbf24');
    metrics.total++;
    setTimeout(()=>nextCustomer(),700);
  }

  function chooseScreen(item){
    if(item.good){screenedOk++;flash('👍 Hỏi tốt','#86efac');}
    else{flash('⚠️ Bỏ qua sàng lọc là rủi ro','#fca5a5');streak=0;}
    phase='decide';render();
  }

  function chooseAction(actId){
    stopTimer();
    metrics.total++;
    const correct=actId===cur.correct;
    const danger=(cur.danger_if||[]).includes(actId)||(cur.correct==='refer'&&actId!=='refer');
    if(cur.correct==='refer')metrics.refer_total++;
    if(correct){
      metrics.correct++;
      if(cur.correct==='refer')metrics.refer_correct++;
      streak++;
      const speed=Math.round((timeLeft/timeMax)*40);
      const screenBonus=screenedOk*15;
      const gain=80+speed+screenBonus+(streak>=3?30:0);
      score+=gain;
      flash('✅ +'+gain+(streak>=3?'  🔥x'+streak:''),'#86efac');
      awardMilestone();
      showCard(true);
    }else{
      streak=0;
      if(danger){rep-=2;metrics.danger++;flash('🚨 Sai nguy hiểm! -2 uy tín','#f87171');}
      else{rep-=1;flash('❌ Chưa đúng. -1 uy tín','#fca5a5');}
      awardMilestone();
      showCard(false);
    }
  }

  function showCard(ok){
    state='card';
    const c=cur.card||{};
    const d=cur.deep_explain||{};
    const overlay=el('div','overlay learnCard');
    const right=(cur.actions||ACTIONS).find(a=>a.id===cur.correct);
    const ms=(DATA.mission?.milestones||[]).find(m=>m.at===served && earnedMilestones.has(m.at));
    overlay.appendChild(el('div','small','Hoàn thành nhiệm vụ '+served+'/'+totalMission));
    if(ms){ overlay.appendChild(el('div','badgeBig',ms.badge+'<br><small>'+ms.reward+'</small>')); }
    overlay.appendChild(el('h1',null,(ok?'✅ ':'📕 ')+(c.title||'Thẻ kiến thức')));
    overlay.appendChild(el('div','answerBox','Đáp án chuẩn: <b>'+(right?right.emoji+' '+right.label:'')+'</b>'));
    const html =
      '<h3>Vì sao đúng?</h3><p>'+esc(d.why_correct||'')+'</p>'+
      '<h3>Vì sao các lựa chọn khác rủi ro?</h3><p>'+esc(d.why_wrong||'')+'</p>'+
      '<h3>Checklist hỏi tại quầy</h3><ul>'+(d.counter_checklist||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'+
      '<h3>Ghi nhớ nhanh</h3><p class="tip">'+esc(d.memory_tip||'')+'</p>'+
      '<h3>Điểm học chính</h3><ul>'+(c.bullets||[]).map(b=>'<li>'+esc(b)+'</li>').join('')+'</ul>';
    overlay.appendChild(el('div','lesson',html));
    const btn=el('button','btn', served>=totalMission?'Xem kết quả 🎓':'Nhiệm vụ tiếp theo ▶');
    btn.onclick=()=>{overlay.remove();state='play';nextCustomer();};
    overlay.appendChild(btn);
    overlay.id='cardOverlay';
    root.appendChild(overlay);
  }
  function esc(s){return String(s||'').replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));}

  function flash(text,color){
    const f=document.getElementById('flash');
    if(!f)return;
    f.textContent=text;f.style.color=color;f.style.opacity='1';
    setTimeout(()=>{if(f)f.style.opacity='0';},900);
  }

  function awardMilestone(){
    const ms=(DATA.mission?.milestones||[]).find(m=>m.at===served);
    if(ms && !earnedMilestones.has(ms.at)){earnedMilestones.add(ms.at);score += ms.at===3?50:(ms.at===6?100:200);return ms;}
    return null;
  }

  function gameOver(completed=false){
    state='over';stopTimer();
    const acc=metrics.total?Math.round(metrics.correct/metrics.total*100):0;
    const racc=metrics.refer_total?Math.round(metrics.refer_correct/metrics.refer_total*100):0;
    endTitle.textContent=completed?'🎓 Hoàn thành ca học!':'🏁 Hết ca làm!';
    endStats.innerHTML='Điểm: <b>'+score+'</b><br>Khách phục vụ: '+(served-1)+
      '<br>Độ chính xác: '+acc+'%'+
      '<br>Nhận diện ca cần refer: '+racc+'%'+
      '<br>Lỗi nguy hiểm: '+metrics.danger;
    endScreen.classList.remove('hide');
  }


  function progressHtml(){
    const done = Math.max(0, served-1);
    const pct = Math.round(done/totalMission*100);
    const ms = DATA.mission?.milestones || [];
    const chips = ms.map(m=>'<span class="mile '+(done>=m.at?'done':'')+'">'+m.at+' · '+m.badge+'</span>').join('');
    return '<div class="journey"><div class="journeyTop"><b>Nhiệm vụ cảm cúm</b><span>'+done+'/'+totalMission+'</span></div><div class="prog"><div style="width:'+pct+'%"></div></div><div class="miles">'+chips+'</div></div>';
  }

  function render(){
    let main=document.getElementById('main');
    if(!main){main=el('div','main');main.id='main';root.insertBefore(main,startScreen);}
    let hearts='';for(let i=0;i<5;i++)hearts+=i<rep?'❤️':'🤍';
    main.innerHTML=
      '<div class="hud"><span>💰 '+score+'</span><span>Lv '+level+'</span><span>'+hearts+'</span></div>'+
      progressHtml()+
      '<div class="timewrap"><div id="timebar" class="timebar"></div></div>'+
      '<div class="cust"><div class="avatar">🧑</div><div class="bubble">🗣️ '+cur.opening_line+'</div></div>'+
      '<div id="flash" class="flash"></div>'+
      '<div id="panel" class="panel"></div>';
    const panel=document.getElementById('panel');
    if(phase==='screen'){
      panel.appendChild(el('div','phaselabel','① Hỏi sàng lọc trước khi tư vấn:'));
      shuffle(cur.screening).forEach(s=>{
        const b=el('button','choice','❓ '+s.q+'<div class="ans">'+(s.a||'')+'</div>');
        b.onclick=()=>chooseScreen(s);
        panel.appendChild(b);
      });
      const skip=el('button','choice skip','➡️ Đủ thông tin, sang tư vấn');
      skip.onclick=()=>{phase='decide';render();};
      panel.appendChild(skip);
    }else{
      panel.appendChild(el('div','phaselabel','② Chọn hướng xử lý đúng:'));
      shuffle(cur.actions||ACTIONS).forEach(a=>{
        const b=el('button','choice act','<span class="emoji">'+(a.emoji||'👉')+'</span> '+a.label);
        b.style.borderColor=a.color||'#34d399';
        b.onclick=()=>chooseAction(a.id);
        panel.appendChild(b);
      });
    }
  }

  function boot(){
    fetch('cases.json').then(r=>r.json()).then(d=>{
      DATA=d;ACTIONS=d.actions_master;
      startBtn.disabled=false;
    }).catch(e=>{
      startScreen.querySelector('p').textContent='Lỗi tải dữ liệu game: '+e;
    });
  }
  startBtn.addEventListener('click',()=>{if(DATA)startGame();});
  againBtn.addEventListener('click',()=>startGame());
  boot();
})();
