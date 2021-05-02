const fs = require('fs');

const checkFileExists = s => new Promise(r=>fs.access(s, fs.constants.F_OK, e => r(!e)));

module.exports = checkFileExists;