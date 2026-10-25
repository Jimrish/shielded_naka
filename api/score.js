const { redis, sign, json, top, KEY } = require('./_lib');

function maxScore(t, coins) {
  const t1 = Math.min(t, 59.4);
  let dist = 430 * t1 + 4.5 * t1 * t1;
  if (t > t1) dist += 960 * (t - t1);
  return dist / 14 + coins * 25 + Math.floor(coins / 10) * 500;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object') return json(res, 400, { error: 'Bad request' });

  const handle = String(b.handle || '').replace(/^@/, '');
  const score = Math.floor(+b.score), coins = Math.floor(+b.coins), t = +b.t;
  const [ts, nonce, sig] = String(b.token || '').split('.');

  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return json(res, 400, { error: 'Invalid X handle' });
  if (!(score >= 0 && score <= 1e6) || !(coins >= 0 && coins <= 5000) || !(t >= 0 && t <= 7200))
    return json(res, 400, { error: 'Invalid numbers' });
  if (!ts || !nonce || !sig || sign(ts + '.' + nonce) !== sig) return json(res, 403, { error: 'Invalid token' });

  const age = (Date.now() - +ts) / 1000;
  if (!(age >= 0 && age <= 7200) || t > age + 3) return json(res, 403, { error: 'Timing check failed' });
  if (coins > t * 7 + 8 || score > maxScore(t, coins) * 1.05 + 50) return json(res, 400, { error: 'Score not plausible' });

  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const rl = 'naga:rate:' + ip;
    const n = await redis(['INCR', rl]);
    if (n === 1) await redis(['EXPIRE', rl, 600]);
    if (n > 30) return json(res, 429, { error: 'Too many submissions, try again later' });

    const fresh = await redis(['SET', 'naga:used:' + nonce, '1', 'NX', 'EX', 7200]);
    if (fresh !== 'OK') return json(res, 403, { error: 'Token already used' });

    const member = handle.toLowerCase();
    await redis(['ZADD', KEY, 'GT', score, member]);
    const rank = await redis(['ZREVRANK', KEY, member]);
    json(res, 200, { ok: true, rank: rank + 1, top: await top(10) });
  } catch (e) {
    json(res, 503, { error: 'Leaderboard unavailable' });
  }
};
