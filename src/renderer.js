import { V } from './vector';
import { CFG, boidSep, boidAli, boidCoh } from './boids';
import { mkBoid } from './entities';

// パワーアップタイプ別の色設定
const PU_COLORS = {
  flock_plus:  { fill: '#00ddff', glow: 'rgba(0,200,255,0.6)',  icon: '+' },
  range_up:    { fill: '#ffaa00', glow: 'rgba(255,170,0,0.6)',  icon: 'R' },
  score_boost: { fill: '#ff00ff', glow: 'rgba(255,0,255,0.6)',  icon: '$' },
};

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
 * HUD用にスクリーン座標のtransformに切り替え
 */
function setScreenTransform(ctx, s) {
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
}

/**
 * ゲームワールド用に仮想座標のtransformに復帰
 */
function setWorldTransform(ctx, s) {
  ctx.setTransform(s.dpr * s.scale, 0, 0, s.dpr * s.scale, 0, 0);
}

/**
 * ひし形パスを描画（パワーアップ用）
 */
function diamondPath(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.7, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.7, y);
  ctx.closePath();
}

/**
 * メニュー画面を描画
 */
export function drawMenu(ctx, s) {
  const { w, h, sw, sh } = s;
  ctx.fillStyle = '#050910';
  ctx.fillRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  s.time = (s.time || 0) + 1;

  // デモ用ボイド（仮想座標で動作）
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

  // テキストはスクリーン座標で描画
  setScreenTransform(ctx, s);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const gl = 0.6 + Math.sin(s.time * 0.03) * 0.4;
  ctx.shadowColor = `rgba(0,255,200,${gl * 0.5})`;
  ctx.shadowBlur = 25;
  ctx.font = `bold ${Math.min(sw * 0.12, 52)}px 'Georgia',serif`;
  ctx.fillStyle = `rgba(0,255,200,${0.8 + gl * 0.2})`;
  ctx.fillText('B O I D S', sw / 2, sh * 0.22);
  ctx.shadowBlur = 0;

  ctx.font = `${Math.min(sw * 0.045, 17)}px 'Georgia',serif`;
  ctx.fillStyle = 'rgba(140,210,200,0.7)';
  ctx.fillText('群れを導き、光を集めよ', sw / 2, sh * 0.29);

  ctx.font = `${Math.min(sw * 0.032, 13)}px sans-serif`;
  ctx.fillStyle = 'rgba(100,190,180,0.55)';
  ctx.fillText('タッチ / ドラッグで操作', sw / 2, sh * 0.35);

  const iy = sh * 0.43;
  const iconSz = Math.min(sw * 0.034, 13);
  ctx.font = `bold ${iconSz}px sans-serif`;
  ctx.fillStyle = '#ffd700';
  ctx.fillText('▲ あなた（リーダー）', sw / 2, iy);
  ctx.fillStyle = 'rgba(60,200,255,0.9)';
  ctx.fillText('▲ 仲間のボイド', sw / 2, iy + iconSz * 2.0);
  ctx.fillStyle = '#00ffaa';
  ctx.fillText('● 光のオーブ（集めよう）', sw / 2, iy + iconSz * 4.0);
  ctx.fillStyle = '#ff4444';
  ctx.fillText('✦ 捕食者（逃げろ！）', sw / 2, iy + iconSz * 6.0);

  // ハイスコア top3 表示
  if (s.highScores && s.highScores.length > 0) {
    const hsY = sh * 0.65;
    ctx.font = `bold ${Math.min(sw * 0.032, 13)}px 'Courier New',monospace`;
    ctx.fillStyle = 'rgba(255,220,50,0.7)';
    ctx.fillText('── HIGH SCORES ──', sw / 2, hsY);

    const top3 = s.highScores.slice(0, 3);
    ctx.font = `${Math.min(sw * 0.03, 12)}px 'Courier New',monospace`;
    for (let i = 0; i < top3.length; i++) {
      const hs = top3[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      const waveInfo = hs.maxWave ? ` W${hs.maxWave}` : '';
      const comboInfo = hs.maxCombo ? ` C${hs.maxCombo}` : '';
      ctx.fillStyle = i === 0 ? 'rgba(255,215,0,0.8)' : 'rgba(200,200,200,0.6)';
      ctx.fillText(`${medal} ${hs.score}pt${waveInfo}${comboInfo}`, sw / 2, hsY + (i + 1) * (iconSz * 1.8));
    }

    // クリアボタン
    const clearY = hsY + (Math.min(top3.length, 3) + 1) * (iconSz * 1.8);
    const clearW = 100, clearH = 22;
    ctx.fillStyle = 'rgba(255,60,60,0.15)';
    ctx.fillRect(sw / 2 - clearW / 2, clearY - clearH / 2, clearW, clearH);
    ctx.strokeStyle = 'rgba(255,80,80,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sw / 2 - clearW / 2, clearY - clearH / 2, clearW, clearH);
    ctx.font = `bold ${Math.min(sw * 0.028, 11)}px sans-serif`;
    ctx.fillStyle = 'rgba(255,100,100,0.7)';
    ctx.fillText('スコアリセット', sw / 2, clearY);
  }

  // リジューム表示
  if (s.hasSave) {
    ctx.fillStyle = `rgba(100,200,255,${0.5 + Math.sin(s.time * 0.05) * 0.3})`;
    ctx.font = `bold ${Math.min(sw * 0.035, 14)}px sans-serif`;
    ctx.fillText('▶ タップで続きから再開', sw / 2, sh * 0.88);
    ctx.font = `${Math.min(sw * 0.025, 10)}px sans-serif`;
    ctx.fillStyle = 'rgba(100,200,255,0.35)';
    ctx.fillText('(セーブデータあり)', sw / 2, sh * 0.92);
  } else {
    ctx.fillStyle = `rgba(0,255,200,${0.5 + Math.sin(s.time * 0.06) * 0.3})`;
    ctx.font = `bold ${Math.min(sw * 0.042, 16)}px sans-serif`;
    ctx.fillText('▶ タップでスタート', sw / 2, sh * 0.90);
  }

  // ワールド座標に戻す
  setWorldTransform(ctx, s);
}

/**
 * ゲーム画面を描画
 */
export function drawGame(ctx, s) {
  const { w, h, sw, sh } = s;

  ctx.fillStyle = '#050910';
  ctx.fillRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  // コンボブレイク赤フラッシュ
  if (s.comboBreakFlash > 0) {
    const intensity = s.comboBreakFlash / 15;
    ctx.fillStyle = `rgba(255,30,30,${0.12 * intensity})`;
    ctx.fillRect(0, 0, w, h);
  }

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

  // パワーアップ（ひし形 + アイコン + 消滅前点滅）
  for (const pu of s.powerUps) {
    if (pu.collected) continue;
    const cfg = PU_COLORS[pu.type] || PU_COLORS.flock_plus;
    const blink = pu.lifetime < 120 && Math.floor(pu.lifetime / 6) % 2 === 0;
    if (blink) continue; // 点滅OFF期間はスキップ

    const pr = 12 + Math.sin(pu.pulse) * 3;
    ctx.save();
    ctx.shadowColor = cfg.glow;
    ctx.shadowBlur = 14;
    diamondPath(ctx, pu.pos.x, pu.pos.y, pr);
    ctx.fillStyle = cfg.fill;
    ctx.globalAlpha = 0.75 + Math.sin(pu.pulse * 1.5) * 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;
    // アイコン文字
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.icon, pu.pos.x, pu.pos.y);
    ctx.restore();
  }

  // パワーオーブ（虹色脈動）
  if (s.powerOrb && !s.powerOrb.collected) {
    const po = s.powerOrb;
    const pr = 16 + Math.sin(po.pulse) * 5;
    const hue = (s.time * 4) % 360;

    ctx.save();
    // 外側グロー
    ctx.shadowColor = `hsla(${hue},100%,60%,0.7)`;
    ctx.shadowBlur = 25;
    // 虹色グラデーション
    const rg = ctx.createRadialGradient(po.pos.x, po.pos.y, 0, po.pos.x, po.pos.y, pr);
    rg.addColorStop(0, `hsla(${hue},100%,90%,0.95)`);
    rg.addColorStop(0.4, `hsla(${(hue + 60) % 360},100%,65%,0.7)`);
    rg.addColorStop(0.7, `hsla(${(hue + 180) % 360},100%,55%,0.4)`);
    rg.addColorStop(1, `hsla(${(hue + 270) % 360},100%,50%,0)`);
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(po.pos.x, po.pos.y, pr, 0, Math.PI * 2); ctx.fill();
    // 消滅前点滅
    if (po.lifetime < 180 && Math.floor(po.lifetime / 8) % 2 === 0) {
      ctx.globalAlpha = 0.3;
    }
    // 中心の白い輝き
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(po.pos.x, po.pos.y, 4, 0, Math.PI * 2); ctx.fill();
    // 回転するリング
    ctx.globalAlpha = 0.5 + Math.sin(po.pulse * 2) * 0.3;
    ctx.strokeStyle = `hsla(${(hue + 120) % 360},100%,70%,0.6)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(po.pos.x, po.pos.y, pr + 4, po.pulse, po.pulse + Math.PI * 1.2);
    ctx.stroke();
    ctx.globalAlpha = 1;
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

  // 無敵オーラ（金色リング）
  if (s.invincible) {
    ctx.save();
    const auraR = 22 + Math.sin(s.time * 0.15) * 4;
    const auraAlpha = 0.4 + Math.sin(s.time * 0.1) * 0.2;
    // 消滅前の点滅
    const flicker = s.invincibleTimer < 60 && Math.floor(s.invincibleTimer / 4) % 2 === 0 ? 0.2 : 1;
    ctx.globalAlpha = auraAlpha * flicker;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(255,215,0,0.6)';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(0, 0, auraR, 0, Math.PI * 2);
    ctx.stroke();
    // 2つ目のリング（逆回転感）
    ctx.strokeStyle = 'rgba(255,255,200,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, auraR + 5, s.time * 0.08, s.time * 0.08 + Math.PI * 1.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  ctx.rotate(la);
  ctx.shadowColor = s.invincible ? 'rgba(255,255,100,0.8)' : 'rgba(255,220,50,0.6)';
  ctx.shadowBlur = s.invincible ? 25 : 18;
  ctx.fillStyle = s.invincible ? '#ffee55' : '#ffd700';
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
    // 無敵中は捕食者を怯えた色に
    if (s.invincible) {
      ctx.shadowColor = 'rgba(100,100,255,0.4)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#8888cc';
    } else {
      ctx.shadowColor = 'rgba(255,50,50,0.5)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ff3333';
    }
    ctx.beginPath();
    ctx.moveTo(13, 0); ctx.lineTo(-8, 8); ctx.lineTo(-10, 3); ctx.lineTo(-15, 5);
    ctx.lineTo(-11, 0); ctx.lineTo(-15, -5); ctx.lineTo(-10, -3); ctx.lineTo(-8, -8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = s.invincible ? '#aaf' : '#ff0';
    ctx.beginPath(); ctx.arc(3, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (!s.invincible) {
      ctx.strokeStyle = `rgba(255,50,50,${0.06 + Math.sin(s.time * 0.08) * 0.03})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(pred.pos.x, pred.pos.y, CFG.predFleeR, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // パーティクル
  for (const p of s.particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ===== HUD（スクリーン座標で描画） =====
  setScreenTransform(ctx, s);

  const fs = Math.min(sw * 0.038, 15);
  const pad = Math.min(sw * 0.04, 16);
  ctx.textBaseline = 'top';

  // 左上: WAVE + フロック数
  ctx.textAlign = 'left';
  ctx.font = `bold ${fs}px 'Courier New',monospace`;
  ctx.fillStyle = 'rgba(0,255,200,0.8)';
  ctx.fillText(`WAVE ${s.wave}`, pad, pad);
  ctx.fillStyle = 'rgba(60,200,255,0.8)';
  ctx.fillText(`×${s.flock}`, pad, pad + fs * 1.5);

  // 右上: スコア + コンボ
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,220,50,0.9)';
  ctx.font = `bold ${fs * 1.3}px 'Courier New',monospace`;
  ctx.fillText(`${s.score}`, sw - pad - 50, pad);
  ctx.font = `${fs * 0.7}px 'Courier New',monospace`;
  ctx.fillStyle = 'rgba(255,220,50,0.45)';
  ctx.fillText('SCORE', sw - pad - 50, pad + fs * 1.5);

  // コンボ表示
  if (s.combo > 0) {
    ctx.textAlign = 'right';
    const comboAlpha = Math.min(0.9, 0.5 + s.comboMult * 0.1);
    const comboColor = s.comboMult >= 5 ? '#ff4444' : s.comboMult >= 3 ? '#ffaa00' : '#00ffaa';
    ctx.fillStyle = comboColor;
    ctx.globalAlpha = comboAlpha;
    ctx.font = `bold ${fs * 1.1}px 'Courier New',monospace`;
    ctx.fillText(`${s.combo} COMBO`, sw - pad - 50, pad + fs * 3);
    ctx.font = `bold ${fs * 0.9}px 'Courier New',monospace`;
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`×${s.comboMult}`, sw - pad - 50, pad + fs * 4.2);
    ctx.globalAlpha = 1;
  }

  // ポーズボタン（右上端）
  const pbX = sw - 40, pbY = 15, pbS = 22;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(pbX - pbS / 2, pbY, pbS, pbS);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(pbX - 5, pbY + 5, 4, 12);
  ctx.fillRect(pbX + 2, pbY + 5, 4, 12);

  // バフタイマー（左下）
  const buffY = sh - pad - fs * 1.5;
  let buffCount = 0;
  ctx.textAlign = 'left';
  ctx.font = `bold ${fs * 0.85}px 'Courier New',monospace`;

  if (s.invincible) {
    const sec = Math.ceil(s.invincibleTimer / 60);
    const flicker = s.invincibleTimer < 60 ? (Math.sin(s.time * 0.3) > 0 ? 1 : 0.3) : 1;
    ctx.globalAlpha = flicker;
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`★ INVINCIBLE ${sec}s`, pad, buffY - buffCount * fs * 1.4);
    ctx.globalAlpha = 1;
    buffCount++;
  }
  if (s.buffs.rangeUp > 0) {
    const sec = Math.ceil(s.buffs.rangeUp / 60);
    ctx.fillStyle = '#ffaa00';
    ctx.fillText(`R RANGE UP ${sec}s`, pad, buffY - buffCount * fs * 1.4);
    buffCount++;
  }
  if (s.buffs.scoreBoost > 0) {
    const sec = Math.ceil(s.buffs.scoreBoost / 60);
    ctx.fillStyle = '#ff00ff';
    ctx.fillText(`$ SCORE ×2 ${sec}s`, pad, buffY - buffCount * fs * 1.4);
    buffCount++;
  }

  // 中央上: プログレスバー（オーブ収集率）
  const barW = sw * 0.3;
  const barH = 4;
  const barX = (sw - barW) / 2;
  const barY = pad + 2;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(barX, barY, barW, barH);
  const totalOrbs = s.orbs.length + (s.nextOrbRespawn ? s.nextOrbRespawn.length : 0);
  const prog = totalOrbs > 0 ? s.orbs.length / (s.orbs.length + (s.nextOrbRespawn ? s.nextOrbRespawn.length : 0)) : 1;
  const grd = ctx.createLinearGradient(barX, 0, barX + barW * prog, 0);
  grd.addColorStop(0, '#00ffaa');
  grd.addColorStop(1, '#00ddff');
  ctx.fillStyle = grd;
  ctx.fillRect(barX, barY, barW * prog, barH);

  // ワールド座標に戻す
  setWorldTransform(ctx, s);
}

/**
 * ポーズオーバーレイを描画
 */
export function drawPauseOverlay(ctx, s) {
  const { w, h, sw, sh } = s;

  // 半透明オーバーレイ（仮想座標）
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, w, h);

  // テキストはスクリーン座標
  setScreenTransform(ctx, s);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // PAUSED タイトル
  ctx.shadowColor = 'rgba(0,200,255,0.5)';
  ctx.shadowBlur = 20;
  ctx.font = `bold ${Math.min(sw * 0.09, 40)}px 'Georgia',serif`;
  ctx.fillStyle = 'rgba(0,200,255,0.9)';
  ctx.fillText('PAUSED', sw / 2, sh * 0.38);
  ctx.shadowBlur = 0;

  // ステータス表示
  const fs = Math.min(sw * 0.035, 14);
  ctx.font = `${fs}px 'Courier New',monospace`;
  ctx.fillStyle = 'rgba(200,200,200,0.7)';
  ctx.fillText(`WAVE ${s.wave}  |  SCORE ${s.score}  |  ×${s.flock} boids`, sw / 2, sh * 0.48);

  if (s.combo > 0) {
    ctx.fillStyle = 'rgba(255,220,50,0.7)';
    ctx.fillText(`COMBO ${s.combo} (×${s.comboMult})`, sw / 2, sh * 0.53);
  }

  // 再開案内
  ctx.fillStyle = `rgba(0,255,200,${0.5 + Math.sin((s.time || 0) * 0.05) * 0.3})`;
  ctx.font = `bold ${Math.min(sw * 0.04, 16)}px sans-serif`;
  ctx.fillText('▶ タップで再開', sw / 2, sh * 0.64);

  ctx.font = `${Math.min(sw * 0.028, 11)}px sans-serif`;
  ctx.fillStyle = 'rgba(150,150,150,0.5)';
  ctx.fillText('Escキーでも再開できます', sw / 2, sh * 0.70);

  // ワールド座標に戻す
  setWorldTransform(ctx, s);
}

/**
 * ゲームオーバー画面を描画
 */
export function drawGameOver(ctx, s) {
  const { w, h, sw, sh } = s;

  // オーバーレイは仮想座標の全画面
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, w, h);

  // テキストはスクリーン座標
  setScreenTransform(ctx, s);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,50,50,0.7)';
  ctx.shadowBlur = 25;
  ctx.font = `bold ${Math.min(sw * 0.1, 44)}px 'Georgia',serif`;
  ctx.fillStyle = '#ff4444';
  ctx.fillText('GAME OVER', sw / 2, sh * 0.28);
  ctx.shadowBlur = 0;

  const fs = Math.min(sw * 0.04, 16);

  // メインスコア（大きく表示）
  ctx.font = `bold ${fs * 2}px 'Courier New',monospace`;
  ctx.fillStyle = 'rgba(255,220,50,0.95)';
  ctx.fillText(`${s.score}`, sw / 2, sh * 0.37);
  ctx.font = `${fs * 0.7}px 'Courier New',monospace`;
  ctx.fillStyle = 'rgba(255,220,50,0.5)';
  ctx.fillText('SCORE', sw / 2, sh * 0.42);

  // 詳細スタッツ
  ctx.font = `${fs * 0.85}px sans-serif`;
  ctx.fillStyle = 'rgba(200,200,200,0.75)';
  ctx.fillText(`WAVE ${s.wave}  |  MAX COMBO ${s.maxCombo}`, sw / 2, sh * 0.48);

  // ハイスコアランキング
  if (s.highScores && s.highScores.length > 0) {
    ctx.font = `bold ${fs * 0.8}px 'Courier New',monospace`;
    ctx.fillStyle = 'rgba(255,220,50,0.6)';
    ctx.fillText('── HIGH SCORES ──', sw / 2, sh * 0.55);

    const top = s.highScores.slice(0, 5);
    ctx.font = `${fs * 0.75}px 'Courier New',monospace`;
    for (let i = 0; i < top.length; i++) {
      const hs = top[i];
      const isNew = hs.score === s.score && hs.date && Date.now() - hs.date < 5000;
      ctx.fillStyle = isNew ? 'rgba(0,255,200,0.9)' : 'rgba(200,200,200,0.5)';
      const prefix = isNew ? '▸ ' : '  ';
      const waveInfo = hs.maxWave ? ` W${hs.maxWave}` : '';
      ctx.fillText(`${prefix}${i + 1}. ${hs.score}pt${waveInfo}`, sw / 2, sh * 0.59 + i * fs * 1.3);
    }
  }

  // リトライ案内
  ctx.fillStyle = `rgba(0,255,200,${0.5 + Math.sin(s.time * 0.05) * 0.3})`;
  ctx.font = `bold ${Math.min(sw * 0.042, 16)}px sans-serif`;
  ctx.fillText('▶ タップでリトライ', sw / 2, sh * 0.88);

  // ワールド座標に戻す
  setWorldTransform(ctx, s);
}
