const crypto = require('crypto');
const { sign, json } = require('./_lib');
module.exports = (req, res) => {
  const payload = Date.now() + '.' + crypto.randomBytes(8).toString('hex');
  json(res, 200, { token: payload + '.' + sign(payload) });
};
