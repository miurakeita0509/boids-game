import { V } from './vector';

export function mkBoid(x, y) {
  return {
    pos: V.new(x, y),
    vel: V.new((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2),
    acc: V.new(0, 0),
    alive: true,
  };
}

export function mkPred(x, y) {
  return {
    pos: V.new(x, y),
    vel: V.new((Math.random() - 0.5), (Math.random() - 0.5)),
    acc: V.new(0, 0),
  };
}

export function mkOrb(w, h, margin = 50) {
  return {
    pos: V.new(
      margin + Math.random() * (w - margin * 2),
      margin + Math.random() * (h - margin * 2)
    ),
    pulse: Math.random() * Math.PI * 2,
    collected: false,
  };
}

export function mkPowerUp(w, h, type, margin = 50) {
  return {
    pos: V.new(
      margin + Math.random() * (w - margin * 2),
      margin + Math.random() * (h - margin * 2)
    ),
    type,
    pulse: Math.random() * Math.PI * 2,
    collected: false,
    lifetime: 600,
  };
}

export function mkPowerOrb(w, h, margin = 80) {
  return {
    pos: V.new(
      margin + Math.random() * (w - margin * 2),
      margin + Math.random() * (h - margin * 2)
    ),
    pulse: Math.random() * Math.PI * 2,
    collected: false,
    lifetime: 900,
  };
}

export function wrap(p, w, h) {
  let { x, y } = p;
  if (x < -20) x = w + 20;
  if (x > w + 20) x = -20;
  if (y < -20) y = h + 20;
  if (y > h + 20) y = -20;
  return V.new(x, y);
}
