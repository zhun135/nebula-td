/* ===================================
   星云塔防 v1.0 · 游戏核心
   Canvas 2D · 纯 JS · 零依赖
   4塔 · 3敌 · Boss · 15波
   =================================== */

// ─── 画布 ────────────────────────────────────
let canvas, ctx, W, H;
const COLS = 12, ROWS = 8;
let CELL = 64;

// ─── 路径 waypoints (网格坐标) ───────────────
const WP = [
  [0,0],[5,0],[5,2],[11,2],[11,4],[6,4],[6,6],[0,6]
];
const EXIT = { col: 0, row: 7 };

// ─── 地图 (0=可建 1=路径 2=基地) ────────────
const MAP = Array.from({length:ROWS},()=>Array(COLS).fill(0));

function buildMap() {
  for (let i=0;i<WP.length-1;i++) {
    const [x1,y1]=WP[i],[x2,y2]=WP[i+1];
    if (y1===y2) for(let x=Math.min(x1,x2);x<=Math.max(x1,x2);x++) MAP[y1][x]=1;
    else for(let y=Math.min(y1,y2);y<=Math.max(y1,y2);y++) MAP[y][x1]=1;
  }
  // 最后到出口
  const [lx,ly]=WP[WP.length-1];
  for(let y=ly;y<ROWS;y++) MAP[y][lx]=1;
}
buildMap();

function pixelWP() {
  const out=[];
  for(const [c,r] of WP) out.push({x:c*CELL+CELL/2, y:r*CELL+CELL/2});
  // 出口点
  out.push({x:EXIT.col*CELL+CELL/2, y:(ROWS-1)*CELL+CELL/2});
  // 最后一个出界点
  out.push({x:EXIT.col*CELL+CELL/2, y:ROWS*CELL});
  return out;
}

// ─── 塔定义 ──────────────────────────────────
const T = {
  laser:  { name:'脉冲激光',icon:'🔫',cost:50, range:150,dmg:18,rate:350,  color:'#00e5ff',bullet:'beam'},
  ion:    { name:'离子炮',  icon:'💥',cost:80, range:130,dmg:14,rate:600,  color:'#ff3cac',bullet:'blast',splash:80,splashDmg:0.5},
  grav:   { name:'引力陷阱',icon:'🌀',cost:60, range:120,dmg:5, rate:900,  color:'#b44dff',bullet:'slow',slow:0.4,slowDur:1.5},
  dark:   { name:'暗物质炮',icon:'⚫',cost:120,range:200,dmg:65,rate:1200, color:'#ffffff',bullet:'beam'},
};

// ─── 敌人定义 ────────────────────────────────
const E = {
  scout:  {name:'侦察机', hp:50, speed:110,reward:12, color:'#ff6b6b',r:9},
  fighter:{name:'战斗机', hp:100,speed:80, reward:20, color:'#ff9800',r:11},
  bomber: {name:'轰炸机', hp:200,speed:50, reward:35, color:'#e040fb',r:13},
  boss:   {name:'母舰',   hp:800,speed:35, reward:150,color:'#ff1744',r:18},
};

// ─── 波次 (15波) ─────────────────────────────
const WAVES = [
  [{e:'scout',n:6, gap:700}],
  [{e:'scout',n:8, gap:650}],
  [{e:'scout',n:5, gap:600},{e:'fighter',n:3, gap:800}],
  [{e:'fighter',n:7, gap:550}],
  [{e:'scout',n:8, gap:400},{e:'bomber',n:2, gap:1000}],
  [{e:'fighter',n:6, gap:500},{e:'bomber',n:3, gap:900}],
  [{e:'scout',n:10,gap:350},{e:'fighter',n:5, gap:600}],
  [{e:'bomber',n:5, gap:700},{e:'fighter',n:8, gap:450}],
  [{e:'scout',n:12,gap:300},{e:'fighter',n:6, gap:450},{e:'bomber',n:4, gap:800}],
  [{e:'bomber',n:3, gap:500},{e:'boss',n:2, gap:1500},{e:'scout',n:15,gap:250}],
  [{e:'scout',n:10,gap:280},{e:'fighter',n:8, gap:400},{e:'bomber',n:5, gap:700}],
  [{e:'fighter',n:10,gap:350},{e:'bomber',n:6, gap:600},{e:'boss',n:2, gap:1200}],
  [{e:'scout',n:15,gap:220},{e:'fighter',n:8, gap:350},{e:'bomber',n:6, gap:500}],
  [{e:'bomber',n:8, gap:450},{e:'boss',n:2, gap:1000},{e:'fighter',n:10,gap:300}],
  [{e:'scout',n:20,gap:180},{e:'fighter',n:12,gap:250},{e:'bomber',n:8, gap:400},{e:'boss',n:3, gap:800}],
];

// ─── 状态 ────────────────────────────────────
const S = {
  credits:300, lives:20, kills:0, wave:0, maxWave:WAVES.length,
  enemies:[], towers:[], particles:[], bullets:[],
  selType:null, selTower:null, popup:null,
  mouse:{x:0,y:0}, hover:null,
  speed:1, phase:'idle', // idle|prep|active|between|over
  spawnQ:[], spawnTimer:0, betweenTimer:0,
  stars:[], shakeTimer:0, shakeAmt:0,
  animText:'', animAlpha:0,
};

// ─── 初始化 ──────────────────────────────────
function init() {
  canvas=document.getElementById('game-canvas');
  resize();
  window.addEventListener('resize',resize);
  ctx=canvas.getContext('2d');
  initStars();
  buildPanel();
  bindEvents();
  requestAnimationFrame(loop);
}

function resize() {
  const wrap=canvas.parentElement;
  const maxW=Math.min(wrap.clientWidth-8, 960);
  W=maxW; H=Math.round(W*2/3);
  CELL=W/COLS;
  canvas.width=W; canvas.height=H;
}

// ─── 星空 ────────────────────────────────────
function initStars() {
  for(let i=0;i<120;i++) S.stars.push({
    x:Math.random()*W,y:Math.random()*H,
    r:Math.random()*2+0.4, s:Math.random()*20+8,
    o:Math.random()*0.7+0.2, p:Math.random()*6.28,
  });
}

// ─── 塔面板 ──────────────────────────────────
function buildPanel() {
  const p=document.getElementById('tower-panel');
  p.innerHTML='';
  for(const [k,v] of Object.entries(T)) {
    const b=document.createElement('button');
    b.className='td-tower-btn'; b.dataset.t=k;
    const desc={laser:'单体·快射速',ion:'范围溅射',grav:'减速光环',dark:'远程·高伤'}[k];
    b.innerHTML=`<span class="td-tower-icon">${v.icon}</span><span class="td-tower-name">${v.name}</span><span class="td-tower-cost">💰${v.cost}</span><span class="td-tower-desc">${desc}</span>`;
    b.onclick=()=>selectTower(k);
    p.appendChild(b);
  }
}

function selectTower(k) {
  if(S.phase==='over') return;
  if(S.selType===k) { S.selType=null; } else {
    if(S.credits<T[k].cost) return;
    S.selType=k; S.selTower=null; S.popup=null;
  }
  refreshBtns();
}

function refreshBtns() {
  for(const b of document.querySelectorAll('.td-tower-btn')) {
    const k=b.dataset.t;
    b.classList.toggle('disabled', S.credits<T[k].cost);
    b.classList.toggle('selected', S.selType===k);
  }
  document.getElementById('btn-start').style.display = S.phase==='idle'?'inline-block':'none';
  document.getElementById('btn-wave').style.display = S.phase==='between'?'inline-block':'none';
  document.getElementById('btn-speed').textContent = `▶ ${S.speed}×`;
}

// ─── 事件 ────────────────────────────────────
function bindEvents() {
  canvas.addEventListener('mousemove',e=>{
    const r=canvas.getBoundingClientRect();
    S.mouse.x=(e.clientX-r.left)*(W/r.width);
    S.mouse.y=(e.clientY-r.top)*(H/r.height);
    const c=Math.floor(S.mouse.x/CELL),row=Math.floor(S.mouse.y/CELL);
    S.hover=(c>=0&&c<COLS&&row>=0&&row<ROWS)? {col:c,row} :null;
    canvas.style.cursor='default';
    if(S.selType&&S.hover&&MAP[S.hover.row][S.hover.col]===0&&!towerAt(S.hover.col,S.hover.row)) canvas.style.cursor='crosshair';
  });
  canvas.addEventListener('mouseleave',()=>{S.hover=null;});
  canvas.addEventListener('click',()=>{
    if(S.phase==='over') return;
    const mx=S.mouse.x,my=S.mouse.y;
    // 弹窗点击
    if(S.popup&&S.selTower) {
      const t=S.selTower,type=T[t.type];
      const px=S.popup.x,py=S.popup.y;
      // 升级
      if(mx>=px+8&&mx<=px+68&&my>=py+52&&my<=py+78) {
        const cost=Math.floor(type.cost*1.5*(t.lv+1));
        if(S.credits>=cost&&t.lv<3){S.credits-=cost;t.lv++;t.dmg=Math.floor(t.dmg*1.35);t.range=Math.floor(t.range*1.12);refresh();}
        S.selTower=null;S.popup=null;return;
      }
      // 出售
      if(mx>=px+78&&mx<=px+138&&my>=py+52&&my<=py+78) {
        S.credits+=Math.floor(type.cost*0.6); S.towers=S.towers.filter(x=>x!==t);
        S.selTower=null;S.popup=null;S.selType=null;refresh();return;
      }
      // 弹窗外
      if(mx<px||mx>px+146||my<py-5||my>py+85){S.selTower=null;S.popup=null;return;}
      return;
    }
    // 点击塔
    const ct=towerAtPixel(mx,my);
    if(ct&&!S.selType){S.selTower=ct;S.popup={x:Math.max(5,Math.min(W-155,ct.col*CELL+CELL/2-73)),y:Math.max(5,Math.min(H-90,ct.row*CELL+CELL/2-60))};return;}
    // 放置
    if(S.selType&&S.hover){
      const {col,row}=S.hover;
      if(MAP[row][col]===0&&!towerAt(col,row)){
        const base=T[S.selType];
        if(S.credits>=base.cost){
          S.credits-=base.cost;
          S.towers.push({type:S.selType,col,row,lv:0,dmg:base.dmg,range:base.range,cd:0,target:null,angle:0});
          refresh();
          if(S.credits<base.cost){S.selType=null;refreshBtns();}
        }
      }
    }
  });

  document.getElementById('btn-start').addEventListener('click',()=>{
    if(S.phase!=='idle') return;
    startWave();
  });
  document.getElementById('btn-speed').addEventListener('click',()=>{
    S.speed=S.speed===1?2:S.speed===2?1:1;refreshBtns();
  });
  document.getElementById('btn-wave').addEventListener('click',()=>{
    if(S.phase==='between') S.betweenTimer=0;
  });
}

function towerAt(c,r){return S.towers.some(t=>t.col===c&&t.row===r);}
function towerAtPixel(mx,my){
  const c=Math.floor(mx/CELL),r=Math.floor(my/CELL);
  return S.towers.find(t=>t.col===c&&t.row===r)||null;
}

// ─── 波次 ────────────────────────────────────
function startWave() {
  if(S.wave>=S.maxWave) return;
  S.wave++; S.phase='prep';
  S.animText=`第 ${S.wave} 波`; S.animAlpha=1;
  setTimeout(()=>{
    if(S.phase!=='prep') return;
    S.phase='active';
    const cfg=WAVES[S.wave-1];
    S.spawnQ=[];
    for(const g of cfg) for(let i=0;i<g.n;i++) S.spawnQ.push({e:g.e,gap:g.gap});
    S.spawnTimer=400;
    S.animText=''; S.animAlpha=0;
  },1800);
  refreshBtns();
}

function updateSpawn(dt) {
  if(S.phase!=='active'||S.spawnQ.length===0) return;
  S.spawnTimer-=dt*1000;
  while(S.spawnTimer<=0&&S.spawnQ.length>0) {
    const q=S.spawnQ.shift(),e=E[q.e];
    const start=pixelWP()[0];
    S.enemies.push({type:q.e,x:start.x,y:start.y,hp:e.hp,maxHp:e.hp,speed:e.speed,reward:e.reward,color:e.color,r:e.r,wpIdx:1,dead:false,slow:0,slowDur:0});
    if(S.spawnQ.length>0) S.spawnTimer+=q.gap;
  }
}

// ─── 敌人移动 ──────────────────────────────────
function updateEnemies(dt) {
  const wps=pixelWP();
  for(const e of S.enemies) {
    if(e.dead) continue;
    e.slowDur-=dt; const spd=e.speed*(e.slowDur>0?e.slow:1);
    const tgt=wps[e.wpIdx]; if(!tgt){e.dead=true;S.lives--;if(S.lives<=0)endGame(false);continue;}
    const dx=tgt.x-e.x,dy=tgt.y-e.y,dist=Math.hypot(dx,dy),mv=spd*dt;
    if(dist<=mv){e.x=tgt.x;e.y=tgt.y;e.wpIdx++;}
    else{e.x+=dx/dist*mv;e.y+=dy/dist*mv;}
  }
  S.enemies=S.enemies.filter(e=>!e.dead);
  // 波次结束
  if(S.phase==='active'&&S.spawnQ.length===0&&S.enemies.length===0&&S.spawnTimer<=0){
    if(S.wave>=S.maxWave){endGame(true);return;}
    S.phase='between'; S.betweenTimer=8;
  }
}

// ─── 塔攻击 ──────────────────────────────────
function updateTowers(dt) {
  for(const t of S.towers) {
    t.cd-=dt*1000;
    const cx=t.col*CELL+CELL/2,cy=t.row*CELL+CELL/2;
    let nearest=null,nd=Infinity;
    for(const e of S.enemies) {
      if(e.dead) continue;
      const d=Math.hypot(e.x-cx,e.y-cy);
      if(d<=t.range&&d<nd){nd=d;nearest=e;}
    }
    if(nearest){t.target=nearest;t.angle=Math.atan2(nearest.y-cy,nearest.x-cx);}
    else{t.target=null;}
    if(nearest&&t.cd<=0){
      t.cd=T[t.type].rate;
      fire(t,cx,cy,nearest);
    }
  }
}

function fire(tower,cx,cy,target){
  const type=T[tower.type];
  if(type.bullet==='beam'){
    S.bullets.push({kind:'beam',x1:cx,y1:cy,x2:target.x,y2:target.y,color:type.color,life:0.08});
    dealDmg(target,tower.dmg);
    spark(target.x,target.y,type.color,4);
  } else if(type.bullet==='blast'){
    const dx=target.x-cx,dy=target.y-cy,dd=Math.hypot(dx,dy);
    S.bullets.push({kind:'ball',x:cx+dx/dd*10,y:cy+dy/dd*10,tx:target.x,ty:target.y,color:type.color,life:dd/400,spd:400,r:4});
  } else if(type.bullet==='slow'){
    const dx=target.x-cx,dy=target.y-cy,dd=Math.hypot(dx,dy);
    S.bullets.push({kind:'ball',x:cx+dx/dd*10,y:cy+dy/dd*10,tx:target.x,ty:target.y,color:type.color,life:dd/300,spd:300,r:3});
  }
}

function dealDmg(e,dmg){e.hp-=dmg; if(e.hp<=0){e.dead=true;S.credits+=e.reward;S.kills++;boom(e.x,e.y,e.color);refresh();}}

function updateBullets(dt){
  for(const b of S.bullets){
    if(b.kind==='beam'){b.life-=dt;}
    else{
      const dx=b.tx-b.x,dy=b.ty-b.y,dd=Math.hypot(dx,dy),mv=b.spd*dt;
      if(dd<=mv+8){
        b.life=0;
        // 找最近敌人作为主目标
        let hit=null,hd=35;
        for(const e of S.enemies){if(e.dead)continue;const d=Math.hypot(e.x-b.tx,e.y-b.ty);if(d<hd){hd=d;hit=e;}}
        // 主目标伤害
        if(hit){
          if(b.color===T.ion.color) dealDmg(hit,14);
          if(b.color===T.grav.color) dealDmg(hit,5);
        }
        // 离子溅射
        if(b.color===T.ion.color){
          for(const e of S.enemies){
            if(e.dead||e===hit)continue;
            if(Math.hypot(e.x-b.tx,e.y-b.ty)<T.ion.splash){dealDmg(e,Math.floor(14*T.ion.splashDmg));spark(e.x,e.y,T.ion.color,3);}
          }
          if(hit) spark(hit.x,hit.y,T.ion.color,5);
        }
        // 引力减速
        if(b.color===T.grav.color){
          for(const e of S.enemies){
            if(e.dead)continue;
            if(Math.hypot(e.x-b.tx,e.y-b.ty)<45){e.slow=T.grav.slow;e.slowDur=T.grav.slowDur;spark(e.x,e.y,'#b44dff',6);}
          }
        }
      }else{b.x+=dx/dd*mv;b.y+=dy/dd*mv;}
    }
  }
  S.bullets=S.bullets.filter(b=>b.life>0);
}

// ─── 粒子 ────────────────────────────────────
function spark(x,y,c,n){for(let i=0;i<n;i++)S.particles.push({x,y,vx:(Math.random()-0.5)*120,vy:(Math.random()-0.5)*120,r:Math.random()*3+1,c,life:0.6});}
function boom(x,y,c){for(let i=0;i<14;i++)S.particles.push({x,y,vx:(Math.random()-0.5)*220,vy:(Math.random()-0.5)*220,r:Math.random()*5+2,c,life:0.8});S.shakeTimer=0.15;S.shakeAmt=4;}
function updateParticles(dt){
  for(const p of S.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt*1.6;}
  S.particles=S.particles.filter(p=>p.life>0);
}

// ─── 波次间 ──────────────────────────────────
function updateBetween(dt){
  if(S.phase!=='between') return;
  S.betweenTimer-=dt;
  if(S.betweenTimer<=0) startWave();
  const tip=document.getElementById('td-tip');
  tip.textContent=`下一波: 第 ${S.wave+1} 波 — ${Math.ceil(Math.max(0,S.betweenTimer))} 秒`;
  if(S.betweenTimer<3) tip.style.color='var(--accent)'; else tip.style.color='';
}

// ─── 结束 ────────────────────────────────────
function endGame(win){
  S.phase='over'; S.selType=null; S.selTower=null; S.popup=null;
  const o=document.getElementById('td-overlay'),c=document.getElementById('td-overlay-content');
  o.style.display='flex';
  c.innerHTML=win?
    `<h2 style="color:#00e5ff;font-size:2rem;margin-bottom:8px;">🏆 星系捍卫者</h2><p style="color:var(--text-secondary);margin-bottom:4px;">全部 ${S.maxWave} 波敌舰已被歼灭</p><p style="color:var(--text-secondary);margin-bottom:16px;">击杀: ${S.kills} | 生命剩余: ${S.lives}</p><button class="td-btn td-btn-big" onclick="restartGame()">🔄 再来一局</button>`:
    `<h2 style="color:#ff5252;font-size:2rem;margin-bottom:8px;">💀 防线失守</h2><p style="color:var(--text-secondary);margin-bottom:4px;">敌人突破了最后防线</p><p style="color:var(--text-secondary);margin-bottom:16px;">坚持到第 ${S.wave} 波 | 击杀: ${S.kills}</p><button class="td-btn td-btn-big" onclick="restartGame()">🔄 重新部署</button>`;
  refreshBtns();
}

function restartGame(){
  S.credits=300;S.lives=20;S.kills=0;S.wave=0;S.enemies=[];S.towers=[];S.particles=[];S.bullets=[];
  S.selType=null;S.selTower=null;S.popup=null;S.phase='idle';S.spawnQ=[];S.spawnTimer=0;
  document.getElementById('td-overlay').style.display='none';
  document.getElementById('td-tip').textContent='点击 🚀 开始游戏，然后布置防御塔';
  document.getElementById('td-tip').style.color='';
  refreshBtns(); refresh();
}

function refresh(){updateHUD();refreshBtns();}
function updateHUD(){
  document.getElementById('hud-wave').textContent=`${S.wave} / ${S.maxWave}`;
  document.getElementById('hud-credits').textContent=S.credits;
  document.getElementById('hud-lives').textContent=S.lives;
  document.getElementById('hud-kills').textContent=S.kills;
  // 10波+红色预警
  const we=document.getElementById('hud-wave');
  if(we) we.style.color=S.wave>=10?'#ff5252':'var(--text-primary)';
}

// ─── 绘制 ────────────────────────────────────
function loop(ts){
  if(!S._lt) S._lt=ts;
  let dt=(ts-S._lt)/1000; if(dt>0.1)dt=0.1; S._lt=ts; dt*=S.speed;

  if(S.phase!=='over'&&S.phase!=='idle'){
    updateSpawn(dt); updateBetween(dt); updateEnemies(dt);
    updateTowers(dt); updateBullets(dt); updateParticles(dt);
    // 星空
    for(const s of S.stars){s.y+=s.s*dt;if(s.y>H){s.y=-3;s.x=Math.random()*W;}s.p+=dt*4;}
    // 震屏衰减
    if(S.shakeTimer>0) S.shakeTimer-=dt;
  }

  // 动画文字衰减
  if(S.animAlpha>0){S.animAlpha-=dt*0.5;if(S.animAlpha<0)S.animAlpha=0;}

  ctx.clearRect(0,0,W,H);

  // 背景
  const bg=ctx.createRadialGradient(W*0.3,H*0.4,0,W*0.5,H*0.5,W);
  bg.addColorStop(0,'#0d1020'); bg.addColorStop(0.5,'#0a0c18'); bg.addColorStop(1,'#060810');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  // 震屏偏移
  let sx=0,sy=0;
  if(S.shakeTimer>0){sx=(Math.random()-0.5)*S.shakeAmt*2;sy=(Math.random()-0.5)*S.shakeAmt*2;}
  ctx.save();ctx.translate(sx,sy);

  // 星空
  for(const s of S.stars){
    const a=s.o*(0.5+0.5*Math.sin(s.p));
    ctx.fillStyle=`rgba(180,210,255,${a})`;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,6.28);ctx.fill();
  }

  // Nebula blobs
  ctx.fillStyle='rgba(0,229,255,0.015)';ctx.beginPath();ctx.arc(W*0.25,H*0.5,180,0,6.28);ctx.fill();
  ctx.fillStyle='rgba(180,77,255,0.012)';ctx.beginPath();ctx.arc(W*0.7,H*0.4,150,0,6.28);ctx.fill();

  drawPath();
  drawGrid();
  drawTowers();
  drawEnemies();
  drawBullets();
  drawParticles();
  drawPopup();
  drawPreview();
  ctx.restore();

  // 波次文字（不受震屏影响）
  if(S.animAlpha>0){
    ctx.fillStyle=`rgba(255,255,255,${S.animAlpha})`;
    ctx.font=`bold ${Math.floor(36+S.animAlpha*20)}px sans-serif`;
    ctx.textAlign='center';
    ctx.fillText(S.animText,W/2,H/2-20);
    ctx.textAlign='start';
  }
  // 波次间提示
  if(S.phase==='between'){
    ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(W/2-140,8,280,32);
    ctx.fillStyle='#00e5ff';ctx.font='bold 14px sans-serif';ctx.textAlign='center';
    ctx.fillText(`⏳ 准备 — 下一波 ${S.wave+1}/${S.maxWave} — ${Math.ceil(Math.max(0,S.betweenTimer))}s`,W/2,30);
    ctx.textAlign='start';
  }
  // 空闲提示
  if(S.phase==='idle'){
    ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(W/2-100,H/2-16,200,32);
    ctx.fillStyle='#00e5ff';ctx.font='bold 15px sans-serif';ctx.textAlign='center';
    ctx.fillText('点击 🚀 开始游戏',W/2,H/2+6);
    ctx.textAlign='start';
  }

  requestAnimationFrame(loop);
}

function drawPath(){
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(MAP[r][c]===1){
      const x=c*CELL,y=r*CELL;
      ctx.fillStyle='rgba(20,30,50,0.5)';ctx.fillRect(x,y,CELL,CELL);
      ctx.strokeStyle='rgba(0,180,220,0.1)';ctx.lineWidth=1;ctx.strokeRect(x+0.5,y+0.5,CELL-1,CELL-1);
    }
  }
  // 路径中心引导线
  const wps=pixelWP();
  ctx.strokeStyle='rgba(0,229,255,0.15)';ctx.lineWidth=2;ctx.setLineDash([8,12]);
  ctx.beginPath();ctx.moveTo(wps[0].x,wps[0].y);
  for(let i=1;i<wps.length-1;i++) ctx.lineTo(wps[i].x,wps[i].y);
  ctx.stroke();ctx.setLineDash([]);
  // 出口标记
  const ex=EXIT.col*CELL+CELL/2, ey=(ROWS-1)*CELL+CELL/2;
  ctx.fillStyle='rgba(255,60,60,0.3)';ctx.beginPath();ctx.arc(ex,ey,CELL*0.35,0,6.28);ctx.fill();
  ctx.fillStyle='rgba(255,60,60,0.5)';ctx.beginPath();ctx.arc(ex,ey,CELL*0.18,0,6.28);ctx.fill();
  // 入口
  const st=wps[0];
  ctx.fillStyle='rgba(0,229,255,0.3)';ctx.beginPath();ctx.arc(st.x,st.y,CELL*0.3,0,6.28);ctx.fill();
}

function drawGrid(){
  ctx.strokeStyle='rgba(255,255,255,0.03)';ctx.lineWidth=0.5;
  for(let c=0;c<=COLS;c++){ctx.beginPath();ctx.moveTo(c*CELL,0);ctx.lineTo(c*CELL,H);ctx.stroke();}
  for(let r=0;r<=ROWS;r++){ctx.beginPath();ctx.moveTo(0,r*CELL);ctx.lineTo(W,r*CELL);ctx.stroke();}
}

function drawTowers(){
  for(const t of S.towers){
    const cx=t.col*CELL+CELL/2,cy=t.row*CELL+CELL/2,color=T[t.type].color;
    // 射程（悬停/选中）
    if(S.selTower===t||(S.hover&&S.hover.col===t.col&&S.hover.row===t.row)){
      ctx.strokeStyle=color.replace(')','').replace('rgb','rgba').replace('(','(')+',0.15)';
      if(color.startsWith('#')) ctx.strokeStyle=color+'26';
      ctx.lineWidth=1;ctx.setLineDash([4,4]);
      ctx.beginPath();ctx.arc(cx,cy,t.range,0,6.28);ctx.stroke();ctx.setLineDash([]);
    }
    // 底座
    const sz=16+t.lv*3;
    ctx.fillStyle='rgba(10,12,20,0.92)';ctx.strokeStyle=color;ctx.lineWidth=2;
    round(cx-sz,cy-sz,sz*2,sz*2,6);ctx.fill();ctx.stroke();
    // 炮管
    if(t.target){
      ctx.save();ctx.translate(cx,cy);ctx.rotate(t.angle);
      ctx.strokeStyle=color;ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(14+t.lv*3,0);ctx.stroke();

      // 发光点
      ctx.fillStyle=color;ctx.globalAlpha=0.6;
      ctx.beginPath();ctx.arc(14+t.lv*3,0,2.5,0,6.28);ctx.fill();ctx.globalAlpha=1;
      ctx.restore();
    }
    // 等级
    if(t.lv>0){ctx.fillStyle=color;ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText('★'.repeat(t.lv),cx,cy-sz-6);}
  }
}

function drawEnemies(){
  for(const e of S.enemies){
    if(e.dead) continue;
    // 血条
    const bw=Math.max(24,e.r*2.2),bh=4,bx=e.x-bw/2,by=e.y-e.r-10;
    ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(bx,by,bw,bh);
    const pct=e.hp/e.maxHp;
    ctx.fillStyle=pct>0.5?'#4caf50':pct>0.25?'#ffc107':'#f44336';
    ctx.fillRect(bx,by,bw*pct,bh);
    // 减速标记
    if(e.slowDur>0){
      ctx.strokeStyle='#b44dff';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(e.x,e.y,e.r+5,0,6.28);ctx.stroke();
    }
    // 机体
    const grad=ctx.createRadialGradient(e.x-2,e.y-2,e.r*0.2,e.x,e.y,e.r);
    grad.addColorStop(0,'#ffffff');grad.addColorStop(0.4,e.color);grad.addColorStop(1,'rgba(0,0,0,0.3)');
    ctx.fillStyle=grad;ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,6.28);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1;ctx.stroke();
    // Boss 光环
    if(e.r>=16){
      ctx.strokeStyle='rgba(255,23,68,0.3)';ctx.lineWidth=2;ctx.setLineDash([3,3]);
      ctx.beginPath();ctx.arc(e.x,e.y,e.r+6,0,6.28);ctx.stroke();ctx.setLineDash([]);
    }
  }
}

function drawBullets(){
  for(const b of S.bullets){
    if(b.kind==='beam'){
      ctx.strokeStyle=b.color;ctx.lineWidth=2;ctx.globalAlpha=0.8;
      ctx.beginPath();ctx.moveTo(b.x1,b.y1);ctx.lineTo(b.x2,b.y2);ctx.stroke();
      ctx.fillStyle=b.color;ctx.globalAlpha=0.5;ctx.beginPath();ctx.arc(b.x2,b.y2,5,0,6.28);ctx.fill();ctx.globalAlpha=1;
    } else {
      ctx.fillStyle=b.color;ctx.globalAlpha=0.85;
      ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,6.28);ctx.fill();
      // 尾迹
      ctx.fillStyle=b.color;ctx.globalAlpha=0.3;
      ctx.beginPath();ctx.arc(b.x,b.y,b.r+2,0,6.28);ctx.fill();
      ctx.globalAlpha=1;
    }
  }
}

function drawParticles(){
  for(const p of S.particles){
    ctx.fillStyle=p.c;ctx.globalAlpha=p.life;
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.28);ctx.fill();
  }
  ctx.globalAlpha=1;
}

function drawPopup(){
  if(!S.selTower||!S.popup) return;
  const t=S.selTower,type=T[t.type],px=S.popup.x,py=S.popup.y;
  // bg
  ctx.fillStyle='rgba(12,14,26,0.96)';ctx.strokeStyle=type.color+'66';ctx.lineWidth=1.5;
  round(px,py,146,82,8);ctx.fill();ctx.stroke();
  // text
  ctx.fillStyle='#e4e7ed';ctx.font='bold 12px sans-serif';ctx.textAlign='left';ctx.fillText(`${type.name} Lv.${t.lv+1}`,px+10,py+22);
  ctx.fillStyle='#8892a4';ctx.font='10px sans-serif';ctx.fillText(`伤害:${t.dmg} 射程:${t.range}`,px+10,py+38);
  // upgrade btn
  const uc=Math.floor(type.cost*1.5*(t.lv+1));
  ctx.fillStyle=t.lv>=3?'rgba(255,255,255,0.04)':'rgba(0,229,255,0.12)';
  round(px+8,py+48,62,26,5);ctx.fill();
  ctx.fillStyle=t.lv>=3?'#555':'#00e5ff';ctx.font='bold 10px sans-serif';
  ctx.fillText(t.lv>=3?'已满级':`升级 💰${uc}`,px+14,py+65);
  // sell btn
  ctx.fillStyle='rgba(255,60,60,0.1)';round(px+76,py+48,62,26,5);ctx.fill();
  ctx.fillStyle='#ff6b6b';ctx.fillText(`出售 💰${Math.floor(type.cost*0.6)}`,px+82,py+65);
  ctx.textAlign='start';
}

function drawPreview(){
  if(!S.selType||!S.hover||S.phase==='over') return;
  const {col,row}=S.hover;
  if(MAP[row][col]!==0||towerAt(col,row)) return;
  const cx=col*CELL+CELL/2,cy=row*CELL+CELL/2,type=T[S.selType];
  ctx.strokeStyle=type.color+'44';ctx.lineWidth=2;ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.arc(cx,cy,type.range,0,6.28);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=type.color+'22';ctx.strokeStyle=type.color+'88';ctx.lineWidth=2;
  round(cx-18,cy-18,36,36,6);ctx.fill();ctx.stroke();
}

function round(x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

window.addEventListener('DOMContentLoaded',init);
