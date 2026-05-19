const crypto = require('crypto');

const SALT = 'AmitKumarPriyadarshi'; // same as Configure::write('Security.salt', ...)

function encryptPassword(password) {
    return crypto.createHash('sha1').update(SALT + password).digest('hex');
}

module.exports = {
    encryptPassword,
};