const fs = require('fs');
const { promisify } = require('util');

const writeFileAsync = promisify(fs.writeFile);

module.exports = writeFileAsync;