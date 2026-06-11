/* ===================================
   星云塔防 v1.2 · 音效引擎
   Web Audio API · 纯合成 · 零文件
   =================================== */

const SOUND = (() => {
  let ctx = null, master = null, muted = false, ambientOn = false, ambientNode = null;

  function ensureCtx() {
    if (!ctx) { ctx = new (window.AudioContext||window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
    return { ctx, master };
  }

  function now() { return ensureCtx().ctx.currentTime; }

  // ── 噪音缓冲 ─────────────────────────────
  let noiseBuf = null;
  function noiseNode(dur) {
    if (!noiseBuf) { noiseBuf = ensureCtx().ctx.createBuffer(1, ensureCtx().ctx.sampleRate*2, ensureCtx().ctx.sampleRate); const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
    const src = ensureCtx().ctx.createBufferSource(); src.buffer=noiseBuf; src.loop=true;
    const g = ensureCtx().ctx.createGain(); g.gain.value=0; src.connect(g); g.connect(ensureCtx().master);
    src.start(now()); src.stop(now()+dur);
    return { src, g };
  }

  // ── 播放接口 ─────────────────────────────
  function play(name) { if (muted) return; const c=ensureCtx().ctx, m=ensureCtx().master, t=now(); _play(name,c,m,t); }

  function _play(name,ctx,master,t) {
    switch(name) {
      // 🔫 激光
      case 'laser': {
        const o=ctx.createOscillator(), g=ctx.createGain();
        o.type='sine'; o.frequency.setValueAtTime(800,t); o.frequency.exponentialRampToValueAtTime(180,t+0.08);
        g.gain.setValueAtTime(0.25,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.1);
        o.connect(g);g.connect(master);o.start(t);o.stop(t+0.1);
      } break;
      // 💥 离子/爆炸
      case 'explosion': {
        const n=noiseNode(0.2); n.g.gain.setValueAtTime(0.4,t); n.g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type='sine';o.frequency.setValueAtTime(60,t);o.frequency.exponentialRampToValueAtTime(25,t+0.15);
        g.gain.setValueAtTime(0.5,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
        o.connect(g);g.connect(master);o.start(t);o.stop(t+0.15);
      } break;
      // ⚡ 电弧
      case 'arc': {
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type='sawtooth';o.frequency.setValueAtTime(2000,t);o.frequency.exponentialRampToValueAtTime(180,t+0.06);
        g.gain.setValueAtTime(0.15,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.08);
        o.connect(g);g.connect(master);o.start(t);o.stop(t+0.08);
        const n=noiseNode(0.06);n.g.gain.setValueAtTime(0.2,t);n.g.gain.exponentialRampToValueAtTime(0.001,t+0.06);
      } break;
      // ⚫ 暗物质
      case 'dark': {
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type='sine';o.frequency.setValueAtTime(35,t);o.frequency.linearRampToValueAtTime(22,t+0.25);
        g.gain.setValueAtTime(0.35,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.3);
        o.connect(g);g.connect(master);o.start(t);o.stop(t+0.3);
        const n=noiseNode(0.25);n.g.gain.setValueAtTime(0.25,t);n.g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
      } break;
      // 🌀 引力
      case 'grav': {
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type='sine';o.frequency.setValueAtTime(220,t);o.frequency.linearRampToValueAtTime(100,t+0.12);
        g.gain.setValueAtTime(0.18,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
        o.connect(g);g.connect(master);o.start(t);o.stop(t+0.15);
      } break;
      // 💀 击杀
      case 'kill': {
        const n=noiseNode(0.1);n.g.gain.setValueAtTime(0.2,t);n.g.gain.exponentialRampToValueAtTime(0.001,t+0.1);
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type='square';o.frequency.setValueAtTime(300,t);o.frequency.exponentialRampToValueAtTime(60,t+0.1);
        g.gain.setValueAtTime(0.2,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.1);
        o.connect(g);g.connect(master);o.start(t);o.stop(t+0.1);
      } break;
      // 🚨 Boss
      case 'boss': {
        for(let i=0;i<3;i++) {
          const delay=i*0.2;
          const o=ctx.createOscillator(),g=ctx.createGain();
          o.type='sine';o.frequency.setValueAtTime(150,t+delay);
          g.gain.setValueAtTime(0.35,t+delay);g.gain.exponentialRampToValueAtTime(0.001,t+delay+0.18);
          o.connect(g);g.connect(master);o.start(t+delay);o.stop(t+delay+0.18);
          const n=noiseNode(0.08);n.g.gain.setValueAtTime(0.3,t+delay);n.g.gain.exponentialRampToValueAtTime(0.001,t+delay+0.08);
        }
      } break;
      // 🌊 波次开始
      case 'wave': {
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type='sine';o.frequency.setValueAtTime(300,t);o.frequency.linearRampToValueAtTime(600,t+0.25);
        g.gain.setValueAtTime(0.3,t);g.gain.setValueAtTime(0.3,t+0.2);g.gain.exponentialRampToValueAtTime(0.001,t+0.4);
        o.connect(g);g.connect(master);o.start(t);o.stop(t+0.4);
      } break;
      // 🏆 胜利
      case 'victory': {
        const notes=[400,500,600,700,800];
        notes.forEach((f,i)=>{
          const delay=i*0.1;
          const o=ctx.createOscillator(),g=ctx.createGain();
          o.type='sine';o.frequency.value=f;
          g.gain.setValueAtTime(0.3,t+delay);g.gain.exponentialRampToValueAtTime(0.001,t+delay+0.25);
          o.connect(g);g.connect(master);o.start(t+delay);o.stop(t+delay+0.25);
        });
      } break;
      // 💀 失败
      case 'defeat': {
        const notes=[500,400,300,200];
        notes.forEach((f,i)=>{
          const delay=i*0.15;
          const o=ctx.createOscillator(),g=ctx.createGain();
          o.type='triangle';o.frequency.value=f;
          g.gain.setValueAtTime(0.25,t+delay);g.gain.exponentialRampToValueAtTime(0.001,t+delay+0.25);
          o.connect(g);g.connect(master);o.start(t+delay);o.stop(t+delay+0.25);
        });
      } break;
      // 🔥 Combo
      case 'combo': {
        const f=400+(name==='combo2'?200:name==='combo3'?400:0);
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type='sine';o.frequency.value=600;
        g.gain.setValueAtTime(0.2,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);
        o.connect(g);g.connect(master);o.start(t);o.stop(t+0.12);
      } break;
      // 界面点击
      case 'click': {
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type='sine';o.frequency.value=800;
        g.gain.setValueAtTime(0.08,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.05);
        o.connect(g);g.connect(master);o.start(t);o.stop(t+0.05);
      } break;
    }
  }

  // ── 氛围背景音 ────────────────────────────
  function ambientStart() {
    if (ambientOn) return; ambientOn=true;
    const c=ensureCtx().ctx, m=ensureCtx().master;
    ambientNode = { osc:[], gain:null };
    const main=c.createGain(); main.gain.value=0.06; main.connect(m);
    ambientNode.gain = main;
    for(let i=0;i<3;i++) {
      const o=c.createOscillator(), g=c.createGain();
      o.type='sine'; o.frequency.value=35+i*15; o.start();
      g.gain.value=0.4; o.connect(g); g.connect(main);
      ambientNode.osc.push({o,g});
    }
    // 缓慢调制
    function mod() {
      if(!ambientOn||!ambientNode) return;
      const t=now();
      ambientNode.osc.forEach((os,i)=>{ os.g.gain.setTargetAtTime(0.3+Math.sin(t*0.3+i)*0.15, t, 2); });
      ambientNode.timer=setTimeout(mod,2000);
    }
    mod();
  }
  function ambientStop() {
    if(!ambientOn) return; ambientOn=false;
    if(ambientNode) { ambientNode.osc.forEach(os=>{try{os.o.stop()}catch(e){}}); clearTimeout(ambientNode.timer); ambientNode=null; }
  }
  function ambientSetLevel(v) { if(ambientNode) ambientNode.gain.gain.setTargetAtTime(Math.max(0.01,v), now(), 1); }

  // ── 静音 ──────────────────────────────────
  function toggleMute() { muted=!muted; if (master) master.gain.value = muted ? 0 : 0.35; if (muted) ambientStop(); else ambientStart(); return muted; }
  function isMuted() { return muted; }

  return { play, ambientStart, ambientStop, ambientSetLevel, toggleMute, isMuted, ensureCtx };
})();
