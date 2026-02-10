import { V } from './vector';

/**
 * Boidsパラメータ設定
 */
export const CFG = {
  sepR: 38,        // 分離範囲
  aliR: 65,        // 整列範囲
  cohR: 85,        // 結合範囲
  sepF: 3.0,       // 分離の強さ
  aliF: 0.7,       // 整列の強さ
  cohF: 0.5,       // 結合の強さ
  leaderF: 1.1,    // リーダー追従の強さ
  maxSpd: 3.0,     // ボイド最大速度
  maxFrc: 0.5,     // ボイド力予算
  predFleeR: 100,  // 捕食者から逃げる範囲
  predFleeF: 3.5,  // 逃避の強さ
  predSpd: 1.6,    // 捕食者の速度
  predChaseR: 220, // 捕食者の追跡範囲
  predSepR: 35,    // 捕食者の分離範囲
  predAliR: 80,    // 捕食者の整列範囲
  predCohR: 100,   // 捕食者の結合範囲
  predSepF: 1.8,   // 捕食者の分離の強さ
  predAliF: 0.6,   // 捕食者の整列の強さ
  predCohF: 0.4,   // 捕食者の結合の強さ
  predMaxFrc: 0.35, // 捕食者の力予算
  orbR: 16,        // オーブの半径
  collectR: 38,    // オーブ収集範囲
};

/**
 * 分離（Separation）: 近くのボイドから離れる
 */
export function boidSep(b, others) {
  let s = V.new(0, 0);
  let c = 0;
  for (const o of others) {
    const d = V.dist(b.pos, o.pos);
    if (d > 0 && d < CFG.sepR) {
      s = V.add(s, V.mul(V.norm(V.sub(b.pos, o.pos)), 1 / d));
      c++;
    }
  }
  return c > 0 ? V.mul(V.mul(s, 1 / c), CFG.sepF) : s;
}

/**
 * 整列（Alignment）: 近くのボイドと同じ方向に向かう
 */
export function boidAli(b, others) {
  let avg = V.new(0, 0);
  let c = 0;
  for (const o of others) {
    const d = V.dist(b.pos, o.pos);
    if (d > 0 && d < CFG.aliR) {
      avg = V.add(avg, o.vel);
      c++;
    }
  }
  return c > 0 ? V.mul(V.norm(V.mul(avg, 1 / c)), CFG.aliF) : V.new(0, 0);
}

/**
 * 結合（Cohesion）: 近くのボイドの中心に向かう
 */
export function boidCoh(b, others) {
  let cen = V.new(0, 0);
  let c = 0;
  for (const o of others) {
    const d = V.dist(b.pos, o.pos);
    if (d > 0 && d < CFG.cohR) {
      cen = V.add(cen, o.pos);
      c++;
    }
  }
  return c > 0 ? V.mul(V.norm(V.sub(V.mul(cen, 1 / c), b.pos)), CFG.cohF) : V.new(0, 0);
}

/**
 * リーダー追従: プレイヤーの位置へ向かう
 */
export function boidFollow(b, ldr) {
  const d = V.dist(b.pos, ldr);
  if (d < 15) return V.new(0, 0);
  const spd = d > 130 ? CFG.maxSpd * 1.5 : CFG.maxSpd;
  return V.limit(
    V.mul(V.sub(V.mul(V.norm(V.sub(ldr, b.pos)), spd), b.vel), CFG.leaderF / d * 18),
    CFG.maxFrc * 3
  );
}

/**
 * 捕食者の分離（Separation）
 */
export function predSep(p, others) {
  let s = V.new(0, 0);
  let c = 0;
  for (const o of others) {
    const d = V.dist(p.pos, o.pos);
    if (d > 0 && d < CFG.predSepR) {
      s = V.add(s, V.mul(V.norm(V.sub(p.pos, o.pos)), 1 / d));
      c++;
    }
  }
  return c > 0 ? V.mul(V.mul(s, 1 / c), CFG.predSepF) : s;
}

/**
 * 捕食者の整列（Alignment）
 */
export function predAli(p, others) {
  let avg = V.new(0, 0);
  let c = 0;
  for (const o of others) {
    const d = V.dist(p.pos, o.pos);
    if (d > 0 && d < CFG.predAliR) {
      avg = V.add(avg, o.vel);
      c++;
    }
  }
  return c > 0 ? V.mul(V.norm(V.mul(avg, 1 / c)), CFG.predAliF) : V.new(0, 0);
}

/**
 * 捕食者の結合（Cohesion）
 */
export function predCoh(p, others) {
  let cen = V.new(0, 0);
  let c = 0;
  for (const o of others) {
    const d = V.dist(p.pos, o.pos);
    if (d > 0 && d < CFG.predCohR) {
      cen = V.add(cen, o.pos);
      c++;
    }
  }
  return c > 0 ? V.mul(V.norm(V.sub(V.mul(cen, 1 / c), p.pos)), CFG.predCohF) : V.new(0, 0);
}

/**
 * 捕食者回避: 捕食者から逃げる
 */
export function boidFlee(b, preds) {
  let s = V.new(0, 0);
  for (const p of preds) {
    const d = V.dist(b.pos, p.pos);
    if (d < CFG.predFleeR) {
      s = V.add(s, V.mul(V.norm(V.sub(b.pos, p.pos)), CFG.predFleeF / (d + 1)));
    }
  }
  return s;
}

/**
 * 優先度付き力の合成
 * 配列の先頭が最優先。力予算(budget)を消費しながら順に適用する。
 * 高優先の力が強いとき、低優先の力は削られる。
 */
export function applyPriority(forces, budget) {
  let acc = V.new(0, 0);
  let remaining = budget;
  for (const f of forces) {
    const mag = V.len(f);
    if (mag <= 0) continue;
    if (mag <= remaining) {
      acc = V.add(acc, f);
      remaining -= mag;
    } else {
      acc = V.add(acc, V.mul(V.norm(f), remaining));
      remaining = 0;
      break;
    }
  }
  return acc;
}
