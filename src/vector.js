/**
 * 2Dベクトルユーティリティ
 */
export const V = {
  new: (x, y) => ({ x, y }),
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  mul: (a, s) => ({ x: a.x * s, y: a.y * s }),
  len: (a) => Math.sqrt(a.x * a.x + a.y * a.y),
  norm: (a) => {
    const l = V.len(a);
    return l > 0 ? V.mul(a, 1 / l) : V.new(0, 0);
  },
  dist: (a, b) => V.len(V.sub(a, b)),
  limit: (a, max) => {
    const l = V.len(a);
    return l > max ? V.mul(V.norm(a), max) : a;
  },
  angle: (a) => Math.atan2(a.y, a.x),
};
