
const crypto = require('crypto');

function generateSalt(){
    return crypto.randomBytes(Math.ceil(16/2))
            .toString('hex')
            .slice(0.16); 
};

function hashPassword(password, salt){
    var hash = crypto.createHmac('sha512', salt);
    hash.update(password);
    var hash = hash.digest('hex');
    return {hash: hash, salt:salt };
};

function generatePassword(password) {
    let salt = generateSalt();
    return hashPassword(password, salt);
}

function validatePassword(loginPassword, saltOnBank, hashOnBank) {
    return hashOnBank === hashPassword(loginPassword, saltOnBank).hash;
 }

 module.exports = { generatePassword , validatePassword}

