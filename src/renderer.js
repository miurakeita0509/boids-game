import { V } from './vector';
import { CFG, boidSep, boidAli, boidCoh } from './boids';
import { mkBoid } from './entities';

/**
 * 背景グリッドを描画
 */
function drawGrid(ctx, w, h) {
  ctx.strokeStyle = 'rgba(15, 35, 60, 0.35)';
  ctx.lineWidth = 0.5;
  const gs = 45;
  for (let x = 0; x < w; x += gs) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += gs) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

/**
 * メニュー画面を描画
 */
export function drawMenu(ctx, s) {
  const { w, h } = s;
  ctx.fillStyle = '#050910';
  ctx.fillRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  s.time = (s.time || 0) + 1;

  // デモ用ボイド
  if (!s.demoBoids) {
    s.demoBoids = Array.from({ length: 25 }, () => mkBoid(Math.random() * w, Math.random() * h));
  }
  for (const b of s.demoBoids) {
    const sep = boidSep(b, s.demoBoids);
    const ali = boidAli(b, s.demoBoids);
    const coh = boidCoh(b, s.demoBoids);
    const cen = V.sub(V.new(w / 2, h / 2), b.pos);
    b.acc = V.add(V.add(V.add(sep, ali), coh), V.mul(V.norm(cen), 0.02));
    b.acc = V.limit(b.acc, 0.08);
    b.vel = V.limit(V.add(b.vel, b.acc), 2);
    b.pos = V.add(b.pos, b.vel);

    const angle = V.angle(b.vel);
    ctx.save();
    ctx.translate(b.pos.x, b.pos.y);
    ctx.rotate(angle);
    ctx.fillStyle = `rgba(0,190,170,${0.12 + Math.sin(s.time * 0.02 + b.pos.x) * 0.08})`;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, 4); ctx.lineTo(-3, 0); ctx.lineTo(-5, -4);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const gl = 0.6 + Math.sin(s.time * 0.03) * 0.4;
  ctx.shadowColor = `rgba(0,255,200,${gl * 0.5})`;
  ctx.shadowBlur = 25;
  ctx.font = `bold ${Math.min(w * 0.12, 52)}px 'Georgia',serif`;
  ctx.fillStyle = `rgba(0,255,200,${0.8 + gl * 0.2})`;
  ctx.fillText('B O I D S', w / 2, h * 0.32);
  ctx.shadowBlur = 0;

  ctx.font = `${Math.min(w * 0.045, 17)}px 'Georgia',serif`;
  ctx.fillStyle = 'rgba(140,210,200,0.7)';
  ctx.fillText('群れを導き、光を集めよ', w / 2, h * 0.40);

  ctx.font = `${Math.min(w * 0.032, 13)}px sans-serif`;
  ctx.fillStyle = 'rgba(100,190,180,0.55)';
  ctx.fillText('タッチ / ドラッグで操作', w / 2, h * 0.48);

  const iy = h * 0.58;
  const iconSz = Math.min(w * 0.034, 13);
  ctx.font = `bold ${iconSz}px sans-serif`;
  ctx.fillStyle = '#ffd700';
  ctx.fillText('▲ あなた（リーダー）', w / 2, iy);
  ctx.fillStyle = 'rgba(60,200,255,0.9)';
  ctx.fillText('▲ 仲間のボイド', w / 2, iy + iconSz * 2.2);
  ctx.fillStyle = '#00ffaa';
  ctx.fillText('● 光のオーブ（集めよう）', w / 2, iy + iconSz * 4.4);
  ctx.fillStyle = '#ff4444';
  ctx.fillText('✦ 捕食者（逃げろ！）', w / 2, iy + iconSz * 6.6);

  ctx.fillStyle = `rgba(0,255,200,${0.5 + Math.sin(s.time * 0.06) * 0.3})`;
  ctx.font = `bold ${Math.min(w * 0.042, 16)}px sans-serif`;
  ctx.fillText('▶ タップでスタート', w / 2, h * 0.85);
}

/**
 * ゲーム画面を描画
 */
export function drawGame(ctx, s) {
  const { w, h } = s;

  ctx.fillStyle = '#050910';
  ctx.fillRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  // オーブ
  for (const orb of s.orbs) {
    if (orb.collected) continue;
    const pl = 0.7 + Math.sin(orb.pulse) * 0.3;
    const r = CFG.orbR * pl;
    ctx.save();
    ctx.shadowColor = 'rgba(0,255,170,0.5)';
    ctx.shadowBlur = 18;
    const g = ctx.createRadialGradient(orb.pos.x, orb.pos.y, 0, orb.pos.x, orb.pos.y, r);
    g.addColorStop(0, 'rgba(0,255,200,0.9)');
    g.addColorStop(0.5, 'rgba(0,200,150,0.4)');
    g.addColorStop(1, 'rgba(0,150,100,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(orb.pos.x, orb.pos.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(orb.pos.x, orb.pos.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ボイド
  for (const b of s.boids.filter((x) => x.alive)) {
    const a = V.angle(b.vel);
    const spd = V.len(b.vel) / CFG.maxSpd;
    ctx.save();
    ctx.translate(b.pos.x, b.pos.y);
    ctx.rotate(a);
    ctx.shadowColor = `rgba(0,180,255,${spd * 0.35})`;
    ctx.shadowBlur = 7;
    ctx.fillStyle = `rgba(60,200,255,${0.55 + spd * 0.45})`;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, 5); ctx.lineTo(-3, 0); ctx.lineTo(-6, -5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // リーダー
  const la = V.angle(s.lVel.x === 0 && s.lVel.y === 0 ? V.new(1, 0) : s.lVel);
  ctx.save();
  ctx.translate(s.leader.x, s.leader.y);
  ctx.rotate(la);
  ctx.shadowColor = 'rgba(255,220,50,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffd700';
  ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-9, 8); ctx.lineTo(-5, 0); ctx.lineTo(-9, -8);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,200,0.8)';
  ctx.beginPath(); ctx.arc(2, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // タッチインジケーター
  if (s.touch && s.state === 1) {
    ctx.strokeStyle = 'rgba(255,220,50,0.2)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(s.leader.x, s.leader.y); ctx.lineTo(s.touch.x, s.touch.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,220,50,0.15)';
    ctx.beginPath(); ctx.arc(s.touch.x, s.touch.y, 20 + Math.sin(s.time * 0.08) * 4, 0, Math.PI * 2); ctx.fill();
  }

  // 捕食者
  for (const pred of s.preds) {
    const pa = V.angle(pred.vel);
    ctx.save();
    ctx.translate(pred.pos.x, pred.pos.y);
    ctx.rotate(pa);
    ctx.shadowColor = 'rgba(255,50,50,0.5)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.moveTo(13, 0); ctx.lineTo(-8, 8); ctx.lineTo(-10, 3); ctx.lineTo(-15, 5);
    ctx.lineTo(-11, 0); ctx.lineTo(-15, -5); ctx.lineTo(-10, -3); ctx.lineTo(-8, -8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff0';
    ctx.beginPath(); ctx.arc(3, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = `rgba(255,50,50,${0.06 + Math.sin(s.time * 0.08) * 0.03})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(pred.pos.x, pred.pos.y, CFG.predFleeR, 0, Math.PI * 2); ctx.stroke();
  }

  // パーティクル
  for (const p of s.particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // HUD
  const fs = Math.min(w * 0.038, 15);
  const pad = Math.min(w * 0.04, 16);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `bold ${fs}px 'Courier New',monospace`;
  ctx.fillStyle = 'rgba(0,255,200,0.8)';
  ctx.fillText(`LV ${s.level}`, pad, pad);
  const col = s.orbs.filter((o) => o.collected).length;
  ctx.fillText(`ORB ${col}/${s.orbs.length}`, pad, pad + fs * 1.5);
  ctx.fillStyle = 'rgba(60,200,255,0.8)';
  ctx.fillText(`×${s.flock}`, pad, pad + fs * 3);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,220,50,0.9)';
  ctx.font = `bold ${fs * 1.3}px 'Courier New',monospace`;
  ctx.fillText(`${s.score}`, w - pad, pad);
  ctx.font = `${fs * 0.7}px 'Courier New',monospace`;
  ctx.fillStyle = 'rgba(255,220,50,0.45)';
  ctx.fillText('SCORE', w - pad, pad + fs * 1.5);

  // プログレスバー
  const barW = w * 0.4;
  const barH = 4;
  const barX = (w - barW) / 2;
  const barY = pad + 2;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(barX, barY, barW, barH);
  const prog = s.orbs.length > 0 ? col / s.orbs.length : 0;
  const grd = ctx.createLinearGradient(barX, 0, barX + barW * prog, 0);
  grd.addColorStop(0, '#00ffaa');
  grd.addColorStop(1, '#00ddff');
  ctx.fillStyle = grd;
  ctx.fillRect(barX, barY, barW * prog, barH);
}

/**
 * ゲームオーバー画面を描画
 */
export function drawGameOver(ctx, s) {
  const { w, h } = s;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,50,50,0.7)';
  ctx.shadowBlur = 25;
  ctx.font = `bold ${Math.min(w * 0.1, 44)}px 'Georgia',serif`;
  ctx.fillStyle = '#ff4444';
  ctx.fillText('GAME OVER', w / 2, h * 0.38);
  ctx.shadowBlur = 0;

  ctx.font = `${Math.min(w * 0.04, 16)}px sans-serif`;
  ctx.fillStyle = 'rgba(200,200,200,0.8)';
  ctx.fillText(`スコア: ${s.score}`, w / 2, h * 0.46);
  ctx.fillText(`到達レベル: ${s.level}`, w / 2, h * 0.52);

  ctx.fillStyle = `rgba(0,255,200,${0.5 + Math.sin(s.time * 0.05) * 0.3})`;
  ctx.font = `bold ${Math.min(w * 0.042, 16)}px sans-serif`;
  ctx.fillText('▶ タップでリトライ', w / 2, h * 0.62);
}
