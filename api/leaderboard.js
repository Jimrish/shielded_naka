const { json, top } = require('./_lib');
module.exports = async (req, res) => {
  try {
    json(res, 200, { top: await top(10) });
  } catch (e) {
    json(res, 503, { error: 'Leaderboard unavailable' });
  }
};
