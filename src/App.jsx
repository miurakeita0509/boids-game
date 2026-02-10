import { useState, useEffect, useRef, useCallback } from 'react';
import { V } from './vector';
import { CFG, boidSep, boidAli, boidCoh, boidFollow, boidFlee, predSep, predAli, predCoh, applyPriority } from './boids';
import { mkBoid, mkPred, mkOrb, mkPowerUp, mkPowerOrb, wrap } from './entities';
import { drawMenu, drawGame, drawGameOver, drawPauseOverlay } from './renderer';
import { saveHighScore, loadHighScores, clearHighScores, saveGameState, loadGameState, clearGameState, hasSavedGame } from './storage';

const ST = { MENU: 0, PLAY: 1, OVER: 2 };
const VIRTUAL_H = 700;

function weightedRandom(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export default function App() {
  const canvasRef = useRef(null);
  const S = useRef({
    state: ST.MENU,
    leader: V.new(0, 0),
    lVel: V.new(0, 0),
    boids: [],
    preds: [],
    orbs: [],
    powerUps: [],
    particles: [],
    score: 0,
    flock: 0,
    wave: 1,
    time: 0,
    combo: 0,
    comboMult: 1,
    maxCombo: 0,
    buffs: { rangeUp: 0, scoreBoost: 0 },
    invincible: false,
    invincibleTimer: 0,
    powerOrb: null,
    nextPredSpawn: 0,
    nextPowerUpSpawn: 0,
    nextOrbRespawn: [],
    comboBreakFlash: 0,
    paused: false,
    w: 0,
    h: 0,
    sw: 0,
    sh: 0,
    scale: 1,
    dpr: 1,
    touch: null,
    demoBoids: null,
    highScores: [],
    hasSave: false,
  });
  const [, setUi] = useState(0);
  const uiTick = useRef(0);
  const animRef = useRef(null);

  const forceUi = () => { uiTick.current++; setUi(uiTick.current); };

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

  const initGame = useCallback(() => {
    const s = S.current;
    const { w, h } = s;
    s.leader = V.new(w / 2, h / 2);
    s.lVel = V.new(0, 0);
    s.wave = 1;
    s.score = 0;
    s.combo = 0;
    s.comboMult = 1;
    s.maxCombo = 0;
    s.invincible = false;
    s.invincibleTimer = 0;
    s.powerOrb = null;
    s.buffs = { rangeUp: 0, scoreBoost: 0 };
    s.powerUps = [];
    s.particles = [];
    s.time = 0;
    s.paused = false;
    s.comboBreakFlash = 0;

    const nb = 15;
    s.boids = Array.from({ length: nb }, () =>
      mkBoid(w / 2 + (Math.random() - 0.5) * 80, h / 2 + (Math.random() - 0.5) * 80)
    );

    const edge = Math.floor(Math.random() * 4);
    s.preds = [mkPred(
      edge < 2 ? Math.random() * w : edge === 2 ? 30 : w - 30,
      edge >= 2 ? Math.random() * h : edge === 0 ? 30 : h - 30
    )];

    s.orbs = Array.from({ length: 10 }, () => mkOrb(w, h));
    s.flock = nb;
    s.nextPredSpawn = 900;
    s.nextPowerUpSpawn = 600;
    s.nextOrbRespawn = [];
  }, []);

  const startGame = useCallback((resume) => {
    const s = S.current;
    if (resume) {
      loadGameState().then(saved => {
        if (saved) {
          Object.assign(s, saved);
          s.particles = [];
          s.state = ST.PLAY;
          s.paused = true;
          s.demoBoids = null;
          clearGameState();
          forceUi();
        } else {
          s.state = ST.PLAY;
          s.demoBoids = null;
          initGame();
          forceUi();
        }
      });
    } else {
      clearGameState();
      s.state = ST.PLAY;
      s.demoBoids = null;
      initGame();
      forceUi();
    }
  }, [initGame]);

  useEffect(() => {
    S.current.highScores = loadHighScores();
    S.current.hasSave = hasSavedGame();
    forceUi();
  }, []);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');

    const resize = () => {
      const s = S.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      cvs.style.width = sw + 'px';
      cvs.style.height = sh + 'px';
      cvs.width = sw * dpr;
      cvs.height = sh * dpr;
      const scale = sh / VIRTUAL_H;
      s.sw = sw;
      s.sh = sh;
      s.w = sw / scale;
      s.h = VIRTUAL_H;
      s.scale = scale;
      s.dpr = dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    // ポーズボタンのヒット判定（スクリーン座標）
    const isPauseHit = (sx, sy) => {
      const s = S.current;
      return sx >= s.sw - 50 && sx <= s.sw - 10 && sy >= 10 && sy <= 50;
    };
    // ハイスコアリセットボタンのヒット判定（メニュー画面用）
    const isClearHit = (sx, sy) => {
      const s = S.current;
      return s.highScores.length > 0 && sx >= s.sw / 2 - 40 && sx <= s.sw / 2 + 40 && sy >= s.sh * 0.78 && sy <= s.sh * 0.78 + 20;
    };

    const onTouchStart = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      const s = S.current;
      if (s.state === ST.MENU) {
        if (isClearHit(t.clientX, t.clientY)) {
          clearHighScores();
          s.highScores = [];
          forceUi();
          return;
        }
        startGame(s.hasSave);
        return;
      }
      if (s.state === ST.OVER) { startGame(false); return; }
      if (s.paused) { s.paused = false; forceUi(); return; }
      if (isPauseHit(t.clientX, t.clientY)) {
        s.paused = true;
        saveGameState(s);
        forceUi();
        return;
      }
      s.touch = V.new(t.clientX / s.scale, t.clientY / s.scale);
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const s = S.current;
      if (t && !s.paused) s.touch = V.new(t.clientX / s.scale, t.clientY / s.scale);
    };
    const onTouchEnd = (e) => {
      e.preventDefault();
      S.current.touch = null;
    };
    cvs.addEventListener('touchstart', onTouchStart, { passive: false });
    cvs.addEventListener('touchmove', onTouchMove, { passive: false });
    cvs.addEventListener('touchend', onTouchEnd, { passive: false });

    const onMouseDown = (e) => {
      const s = S.current;
      if (s.state === ST.MENU) {
        if (isClearHit(e.clientX, e.clientY)) {
          clearHighScores();
          s.highScores = [];
          forceUi();
          return;
        }
        startGame(s.hasSave);
        return;
      }
      if (s.state === ST.OVER) { startGame(false); return; }
      if (s.paused) { s.paused = false; forceUi(); return; }
      if (isPauseHit(e.clientX, e.clientY)) {
        s.paused = true;
        saveGameState(s);
        forceUi();
        return;
      }
      s.touch = V.new(e.clientX / s.scale, e.clientY / s.scale);
    };
    const onMouseMove = (e) => {
      const s = S.current;
      if (e.buttons > 0 && !s.paused) s.touch = V.new(e.clientX / s.scale, e.clientY / s.scale);
    };
    const onMouseUp = () => { S.current.touch = null; };
    cvs.addEventListener('mousedown', onMouseDown);
    cvs.addEventListener('mousemove', onMouseMove);
    cvs.addEventListener('mouseup', onMouseUp);

    const keys = {};
    const onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      keys[k] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(k)) {
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        const s = S.current;
        if (s.state === ST.PLAY) {
          s.paused = !s.paused;
          if (s.paused) saveGameState(s);
          forceUi();
        }
      }
    };
    const onKeyUp = (e) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ===== ゲームループ =====
    const loop = () => {
      const s = S.current;
      const { w, h, dpr, scale } = s;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);

      if (s.state === ST.MENU) {
        drawMenu(ctx, s);
      } else {
        // ポーズ中は更新スキップ、描画のみ
        if (!s.paused) {
          s.time++;

          if (s.state === ST.PLAY) {
            // バフタイマー減算
            if (s.buffs.rangeUp > 0) s.buffs.rangeUp--;
            if (s.buffs.scoreBoost > 0) s.buffs.scoreBoost--;
            if (s.comboBreakFlash > 0) s.comboBreakFlash--;

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
              b.acc = applyPriority([
                boidSep(b, alive),
                boidFlee(b, s.preds),
                boidFollow(b, s.leader),
                boidAli(b, alive),
                boidCoh(b, alive),
              ], CFG.maxFrc);
              b.vel = V.limit(V.add(b.vel, b.acc), CFG.maxSpd);
              b.pos = wrap(V.add(b.pos, b.vel), w, h);
            }

            // 無敵タイマー
            if (s.invincible) {
              s.invincibleTimer--;
              if (s.invincibleTimer <= 0) s.invincible = false;
            }

            // 捕食者更新
            const predsSnapshot = [...s.preds];
            for (const pred of predsSnapshot) {
              let near = null;
              let nd = Infinity;

              if (s.invincible) {
                // 無敵中: リーダーから逃げる
                const ld = V.dist(pred.pos, s.leader);
                if (ld < 20) {
                  // リーダーが捕食者を食べる
                  s.preds = s.preds.filter(p => p !== pred);
                  burst(pred.pos, '#ff4444', 18);
                  s.score += 25;
                  continue;
                }
                // 逃走方向
                const flee = V.mul(V.norm(V.sub(pred.pos, s.leader)), 0.12);
                pred.acc = applyPriority([
                  predSep(pred, s.preds),
                  flee,
                  predAli(pred, s.preds),
                  predCoh(pred, s.preds),
                ], CFG.predMaxFrc);
              } else {
                // 通常: 追跡
                for (const b of alive) {
                  const d = V.dist(pred.pos, b.pos);
                  if (d < nd && d < CFG.predChaseR) { near = b; nd = d; }
                }
                const ld = V.dist(pred.pos, s.leader);
                if (ld < CFG.predChaseR && ld < nd) { near = { pos: s.leader }; nd = ld; }

                const chase = near
                  ? V.mul(V.norm(V.sub(near.pos, pred.pos)), 0.07)
                  : V.new((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02);

                pred.acc = applyPriority([
                  predSep(pred, s.preds),
                  chase,
                  predAli(pred, s.preds),
                  predCoh(pred, s.preds),
                ], CFG.predMaxFrc);

                // ボイド捕食
                for (const b of alive) {
                  if (b.alive && V.dist(pred.pos, b.pos) < 16) {
                    b.alive = false;
                    s.flock = s.boids.filter((x) => x.alive).length;
                    // コンボブレイク
                    if (s.combo > 0) {
                      s.score = Math.max(0, s.score - 20);
                      s.comboBreakFlash = 15;
                      burst(b.pos, '#ff8800', 12);
                    }
                    s.combo = 0;
                    s.comboMult = 1;
                    burst(b.pos, '#ff4444', 10);
                  }
                }
              }

              pred.vel = V.limit(V.add(pred.vel, pred.acc), CFG.predSpd);
              pred.pos = wrap(V.add(pred.pos, pred.vel), w, h);
            }

            // 収集範囲（バフ適用）
            const collectR = CFG.collectR * (s.buffs.rangeUp > 0 ? 1.8 : 1.0);

            // オーブ収集
            for (const orb of s.orbs) {
              if (orb.collected) continue;
              orb.pulse += 0.05;
              // リーダー収集（+5 base）
              if (V.dist(s.leader, orb.pos) < collectR) {
                orb.collected = true;
                const base = 5;
                const points = base * s.comboMult * (s.buffs.scoreBoost > 0 ? 2 : 1);
                s.score += points;
                s.combo++;
                s.comboMult = Math.min(Math.floor(s.combo / 3) + 1, 5);
                s.maxCombo = Math.max(s.maxCombo, s.combo);
                burst(orb.pos, '#00ffaa', 14);
                s.nextOrbRespawn.push({ frame: s.time + 120 + Math.floor(Math.random() * 60) });
                continue;
              }
              // ボイド収集（+10 base）
              for (const b of alive) {
                if (V.dist(b.pos, orb.pos) < collectR * 0.65) {
                  orb.collected = true;
                  const base = 10;
                  const points = base * s.comboMult * (s.buffs.scoreBoost > 0 ? 2 : 1);
                  s.score += points;
                  s.combo++;
                  s.comboMult = Math.min(Math.floor(s.combo / 3) + 1, 5);
                  s.maxCombo = Math.max(s.maxCombo, s.combo);
                  burst(orb.pos, '#00ddff', 10);
                  s.nextOrbRespawn.push({ frame: s.time + 120 + Math.floor(Math.random() * 60) });
                  break;
                }
              }
            }

            // パワーアップ収集
            for (const pu of s.powerUps) {
              if (pu.collected) continue;
              pu.pulse += 0.06;
              pu.lifetime--;
              if (pu.lifetime <= 0) { pu.collected = true; continue; }
              if (V.dist(s.leader, pu.pos) < collectR) {
                pu.collected = true;
                switch (pu.type) {
                  case 'flock_plus': {
                    const count = 3 + Math.floor(Math.random() * 3);
                    for (let i = 0; i < count; i++) {
                      s.boids.push(mkBoid(
                        s.leader.x + (Math.random() - 0.5) * 60,
                        s.leader.y + (Math.random() - 0.5) * 60
                      ));
                    }
                    s.flock = s.boids.filter(b => b.alive).length;
                    burst(pu.pos, '#00ddff', 16);
                    break;
                  }
                  case 'range_up':
                    s.buffs.rangeUp = 360;
                    burst(pu.pos, '#ffaa00', 14);
                    break;
                  case 'score_boost':
                    s.buffs.scoreBoost = 360;
                    burst(pu.pos, '#ff00ff', 14);
                    break;
                }
              }
            }
            s.powerUps = s.powerUps.filter(pu => !pu.collected);

            // パワーオーブ（無敵）
            if (s.powerOrb && !s.powerOrb.collected) {
              s.powerOrb.pulse += 0.08;
              s.powerOrb.lifetime--;
              if (s.powerOrb.lifetime <= 0) {
                s.powerOrb = null;
              } else if (V.dist(s.leader, s.powerOrb.pos) < collectR * 1.2) {
                s.powerOrb.collected = true;
                s.powerOrb = null;
                s.invincible = true;
                s.invincibleTimer = 300;
                burst(s.leader, '#ffffff', 20);
              }
            }

            // === エンドレスモード スポーン ===

            // Wave進行
            if (s.time % 900 === 0 && s.time > 0) {
              s.wave++;
            }

            // 捕食者スポーン
            if (s.time >= s.nextPredSpawn) {
              const maxPreds = Math.min(3 + s.wave, 12);
              if (s.preds.length < maxPreds) {
                const edge = Math.floor(Math.random() * 4);
                s.preds.push(mkPred(
                  edge < 2 ? Math.random() * w : edge === 2 ? 30 : w - 30,
                  edge >= 2 ? Math.random() * h : edge === 0 ? 30 : h - 30
                ));
              }
              s.nextPredSpawn = s.time + Math.max(900 - s.wave * 50, 300);
            }

            // オーブリスポーン
            s.nextOrbRespawn = s.nextOrbRespawn.filter(entry => {
              if (s.time >= entry.frame) {
                s.orbs.push(mkOrb(w, h));
                return false;
              }
              return true;
            });
            // 収集済みオーブを配列から除去
            s.orbs = s.orbs.filter(o => !o.collected);

            // パワーアップスポーン
            if (s.time >= s.nextPowerUpSpawn) {
              const type = weightedRandom(['flock_plus', 'range_up', 'score_boost'], [0.4, 0.3, 0.3]);
              s.powerUps.push(mkPowerUp(w, h, type));
              s.nextPowerUpSpawn = s.time + 600 + Math.floor(Math.random() * 300);
            }

            // パワーオーブスポーン（捕食者5体以上かつ無敵でないとき）
            if (!s.powerOrb && !s.invincible && s.preds.length >= 5) {
              if (Math.random() < 0.003) {
                s.powerOrb = mkPowerOrb(w, h);
              }
            }

            // 死んだボイドの定期クリーンアップ
            if (s.time % 300 === 0) {
              s.boids = s.boids.filter(b => b.alive);
            }

            // ゲームオーバー判定
            if (s.boids.filter((b) => b.alive).length === 0) {
              s.state = ST.OVER;
              s.highScores = saveHighScore({
                score: s.score,
                date: Date.now(),
                maxCombo: s.maxCombo,
                maxWave: s.wave,
              });
              clearGameState();
              forceUi();
            }
          }
        }

        // パーティクル更新（ポーズ中も動かす）
        s.particles = s.particles.filter((p) => {
          p.pos = V.add(p.pos, p.vel);
          p.vel = V.mul(p.vel, 0.95);
          p.life -= 0.025;
          return p.life > 0;
        });

        drawGame(ctx, s);

        if (s.paused) {
          drawPauseOverlay(ctx, s);
        }
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
  }, [initGame, startGame]);

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
