import { useState, useEffect, useRef, useCallback } from 'react';
import { V } from './vector';
import { CFG, boidSep, boidAli, boidCoh, boidFollow, boidFlee, predSep, predAli, predCoh } from './boids';
import { mkBoid, mkPred, mkOrb, wrap } from './entities';
import { drawMenu, drawGame, drawGameOver } from './renderer';

const ST = { MENU: 0, PLAY: 1, OVER: 2 };

export default function App() {
  const canvasRef = useRef(null);
  const S = useRef({
    state: ST.MENU,
    leader: V.new(0, 0),
    lVel: V.new(0, 0),
    boids: [],
    preds: [],
    orbs: [],
    particles: [],
    score: 0,
    flock: 0,
    level: 1,
    time: 0,
    w: 0,
    h: 0,
    dpr: 1,
    touch: null,
    demoBoids: null,
  });
  const [ui, setUi] = useState({ state: ST.MENU, score: 0, flock: 0, level: 1 });
  const animRef = useRef(null);

  const burst = (pos, color, n = 8) => {
    const s = S.current;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const sp = 1 + Math.random() * 3;
      s.particles.push({
        pos: { ...pos },
        vel: V.new(Math.cos(a) * sp, Math.sin(a) * sp),
        life: 1,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  };

  const initLevel = useCallback((lvl) => {
    const s = S.current;
    const { w, h } = s;
    s.leader = V.new(w / 2, h / 2);
    s.lVel = V.new(0, 0);
    s.level = lvl;

    const nb = 10 + lvl * 3;
    s.boids = Array.from({ length: nb }, () =>
      mkBoid(w / 2 + (Math.random() - 0.5) * 80, h / 2 + (Math.random() - 0.5) * 80)
    );

    const np = Math.min(lvl, 5);
    s.preds = Array.from({ length: np }, () => {
      const e = Math.floor(Math.random() * 4);
      return mkPred(
        e < 2 ? Math.random() * w : e === 2 ? 30 : w - 30,
        e >= 2 ? Math.random() * h : e === 0 ? 30 : h - 30
      );
    });

    const no = 5 + lvl * 2;
    s.orbs = Array.from({ length: no }, () => mkOrb(w, h));
    s.flock = nb;
    s.particles = [];
    s.time = 0;
    setUi((u) => ({ ...u, flock: nb, level: lvl }));
  }, []);

  const startGame = useCallback(() => {
    const s = S.current;
    s.score = 0;
    s.state = ST.PLAY;
    setUi({ state: ST.PLAY, score: 0, flock: 0, level: 1 });
    initLevel(1);
  }, [initLevel]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');

    // リサイズ処理
    const resize = () => {
      const s = S.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      cvs.style.width = cw + 'px';
      cvs.style.height = ch + 'px';
      cvs.width = cw * dpr;
      cvs.height = ch * dpr;
      s.w = cw;
      s.h = ch;
      s.dpr = dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    // タッチイベント
    const onTouchStart = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      const s = S.current;
      if (s.state === ST.MENU || s.state === ST.OVER) {
        s.demoBoids = null;
        startGame();
        return;
      }
      s.touch = V.new(t.clientX, t.clientY);
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) S.current.touch = V.new(t.clientX, t.clientY);
    };
    const onTouchEnd = (e) => {
      e.preventDefault();
      S.current.touch = null;
    };
    cvs.addEventListener('touchstart', onTouchStart, { passive: false });
    cvs.addEventListener('touchmove', onTouchMove, { passive: false });
    cvs.addEventListener('touchend', onTouchEnd, { passive: false });

    // マウスイベント（PC対応）
    const onMouseDown = (e) => {
      const s = S.current;
      if (s.state === ST.MENU || s.state === ST.OVER) {
        s.demoBoids = null;
        startGame();
        return;
      }
      s.touch = V.new(e.clientX, e.clientY);
    };
    const onMouseMove = (e) => {
      if (e.buttons > 0) S.current.touch = V.new(e.clientX, e.clientY);
    };
    const onMouseUp = () => {
      S.current.touch = null;
    };
    cvs.addEventListener('mousedown', onMouseDown);
    cvs.addEventListener('mousemove', onMouseMove);
    cvs.addEventListener('mouseup', onMouseUp);

    // キーボードイベント
    const keys = {};
    const onKeyDown = (e) => {
      keys[e.key.toLowerCase()] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    const onKeyUp = (e) => {
      keys[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ===== ゲームループ =====
    const loop = () => {
      const s = S.current;
      const { w, h, dpr } = s;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (s.state === ST.MENU) {
        drawMenu(ctx, s);
      } else {
        s.time++;

        if (s.state === ST.PLAY) {
          // リーダー移動
          let lAcc = V.new(0, 0);
          if (keys['w'] || keys['arrowup']) lAcc.y -= 0.6;
          if (keys['s'] || keys['arrowdown']) lAcc.y += 0.6;
          if (keys['a'] || keys['arrowleft']) lAcc.x -= 0.6;
          if (keys['d'] || keys['arrowright']) lAcc.x += 0.6;

          if (s.touch) {
            const to = V.sub(s.touch, s.leader);
            const d = V.len(to);
            if (d > 8) lAcc = V.add(lAcc, V.mul(V.norm(to), Math.min(d * 0.01, 1.0)));
          }

          s.lVel = V.limit(V.mul(V.add(s.lVel, lAcc), 0.94), 5.5);
          s.leader = wrap(V.add(s.leader, s.lVel), w, h);

          // ボイド更新
          const alive = s.boids.filter((b) => b.alive);
          for (const b of alive) {
            b.acc = V.limit(
              V.add(
                V.add(V.add(V.add(boidSep(b, alive), boidAli(b, alive)), boidCoh(b, alive)), boidFollow(b, s.leader)),
                boidFlee(b, s.preds)
              ),
              CFG.maxFrc
            );
            b.vel = V.limit(V.add(b.vel, b.acc), CFG.maxSpd);
            b.pos = wrap(V.add(b.pos, b.vel), w, h);
          }

          // 捕食者更新（群れ行動）
          for (const pred of s.preds) {
            // 追跡対象を探す
            let chase = V.new(0, 0);
            let near = null;
            let nd = Infinity;
            for (const b of alive) {
              const d = V.dist(pred.pos, b.pos);
              if (d < nd && d < CFG.predChaseR) { near = b; nd = d; }
            }
            const ld = V.dist(pred.pos, s.leader);
            if (ld < CFG.predChaseR && ld < nd) { near = { pos: s.leader }; nd = ld; }

            chase = near
              ? V.mul(V.norm(V.sub(near.pos, pred.pos)), 0.07)
              : V.new((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02);

            // Boids群れ行動（分離・整列・結合）
            const sep = predSep(pred, s.preds);
            const ali = predAli(pred, s.preds);
            const coh = predCoh(pred, s.preds);

            pred.acc = V.limit(
              V.add(V.add(V.add(chase, sep), ali), coh),
              CFG.predMaxFrc
            );
            pred.vel = V.limit(V.add(pred.vel, pred.acc), CFG.predSpd);
            pred.pos = wrap(V.add(pred.pos, pred.vel), w, h);

            // ボイド捕食
            for (const b of alive) {
              if (b.alive && V.dist(pred.pos, b.pos) < 16) {
                b.alive = false;
                s.flock = s.boids.filter((x) => x.alive).length;
                setUi((u) => ({ ...u, flock: s.flock }));
                burst(b.pos, '#ff4444', 10);
              }
            }
          }

          // オーブ収集
          for (const orb of s.orbs) {
            if (orb.collected) continue;
            orb.pulse += 0.05;
            if (V.dist(s.leader, orb.pos) < CFG.collectR) {
              orb.collected = true;
              s.score += 10;
              setUi((u) => ({ ...u, score: s.score }));
              burst(orb.pos, '#00ffaa', 14);
              continue;
            }
            for (const b of alive) {
              if (V.dist(b.pos, orb.pos) < CFG.collectR * 0.65) {
                orb.collected = true;
                s.score += 5;
                setUi((u) => ({ ...u, score: s.score }));
                burst(orb.pos, '#00ddff', 10);
                break;
              }
            }
          }

          // レベルクリア判定
          if (s.orbs.every((o) => o.collected)) {
            s.score += s.flock * 5;
            setUi((u) => ({ ...u, score: s.score }));
            initLevel(s.level + 1);
          }

          // ゲームオーバー判定
          if (s.boids.filter((b) => b.alive).length === 0) {
            s.state = ST.OVER;
            setUi((u) => ({ ...u, state: ST.OVER }));
          }
        }

        // パーティクル更新
        s.particles = s.particles.filter((p) => {
          p.pos = V.add(p.pos, p.vel);
          p.vel = V.mul(p.vel, 0.95);
          p.life -= 0.025;
          return p.life > 0;
        });

        drawGame(ctx, s);

        if (s.state === ST.OVER) {
          drawGameOver(ctx, s);
        }
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [initLevel, startGame]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#050910',
        overflow: 'hidden',
        touchAction: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
