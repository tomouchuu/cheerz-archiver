const fs = require('fs');

function setupDirs(idol) {
  fs.mkdir(`./${idol}`, (err) => {
    if (err) console.error('Could not setup folder');
    fs.mkdir(`./${idol}/photos`, () => {});
    fs.mkdir(`./${idol}/audios`, () => {});
    fs.mkdir(`./${idol}/videos`, () => {});
  });

  return `./${idol}`;
}

module.exports = setupDirs;