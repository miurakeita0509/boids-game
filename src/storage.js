const SALT = 'boids_v1_2024_flock_salt';
const HS_KEY = 'boids_highscores';
const SAVE_KEY = 'boids_save';
const MAX_SCORES = 10;

async function computeHash(jsonString) {
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonString + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function loadHighScores() {
  try {
    const raw = localStorage.getItem(HS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

export function saveHighScore(entry) {
  const scores = loadHighScores();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const top = scores.slice(0, MAX_SCORES);
  localStorage.setItem(HS_KEY, JSON.stringify(top));
  return top;
}

export function clearHighScores() {
  localStorage.removeItem(HS_KEY);
}

export async function saveGameState(s) {
  const data = {
    leader: s.leader,
    lVel: s.lVel,
    boids: s.boids,
    preds: s.preds,
    orbs: s.orbs,
    powerUps: s.powerUps,
    score: s.score,
    flock: s.flock,
    wave: s.wave,
    time: s.time,
    combo: s.combo,
    comboMult: s.comboMult,
    maxCombo: s.maxCombo,
    buffs: s.buffs,
    invincible: s.invincible,
    invincibleTimer: s.invincibleTimer,
    powerOrb: s.powerOrb,
    nextPredSpawn: s.nextPredSpawn,
    nextPowerUpSpawn: s.nextPowerUpSpawn,
    nextOrbRespawn: s.nextOrbRespawn,
  };
  const json = JSON.stringify(data);
  const hash = await computeHash(json);
  localStorage.setItem(SAVE_KEY, JSON.stringify({ data: json, hash }));
}

export async function loadGameState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const { data, hash } = JSON.parse(raw);
    const computed = await computeHash(data);
    if (computed !== hash) {
      clearGameState();
      return null;
    }
    return JSON.parse(data);
  } catch {
    clearGameState();
    return null;
  }
}

export function clearGameState() {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSavedGame() {
  return localStorage.getItem(SAVE_KEY) !== null;
}
