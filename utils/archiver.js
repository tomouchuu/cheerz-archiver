const path = require('path');
const {format, parse} = require('date-fns');
const fetch = require('node-fetch');
const metadataWriter = require("write-aac-metadata").default;

const checkFileExists = require('./check-file-exists');
const writeFileAsync = require('./write-file-async');

const archiver = (item, name, cheerzUrl, downloadDir, browser) => new Promise(async(resolve) => {
  const returnObj = {
    imgSaved: false,
    audioSaved: false,
    contentSaved: false,
    commentsSaved: false
  };

  // Get information on the item
  const itemModal = await item.$('a.modal');
  const itemHref = await itemModal.evaluate((node) => node.getAttribute('href'));
  const itemId = await item.evaluate((node) => node.getAttribute('data-item-id'));
  const itemPostedStr = await item.evaluate((node) => node.getAttribute('data-posted-time'));

  const itemPosted = format(parse((itemPostedStr * 1000), 'T', new Date()), 'yyyy-MM-dd_HH-mm-ss');
  returnObj.itemId = itemId;
  returnObj.itemPosted = itemPosted;

  // Setup Paths
  const audioPath = `${downloadDir}/audios/${itemPosted}.m4a`;
  const photoPath = `${downloadDir}/photos/${itemPosted}.jpg`;

  // Get the modal showing
  const modalPage = await browser.newPage();
  await modalPage.setViewport({
    width: 1920,
    height: 1080
  });
  await modalPage.goto(`${cheerzUrl}${itemHref}`);

  // Get audio
  modalPage.on('response', async response => {
    if (response.url() === 'https://cheerz.cz/ajax/voice-url') {
      const audioRes = await response.json();
      const audioSrc = audioRes.Result.voice_url;
      await fetch(audioSrc)
        .then(x => x.arrayBuffer())
        .then(x => {
          writeFileAsync(audioPath, Buffer.from(x));
          returnObj.audioSaved = true;
        });
    }
  });

  // Get image
  await modalPage.waitForSelector(`#item-${itemId}.overlay .article .photo img`);
  const imgSrc = await modalPage.$eval(`#item-${itemId}.overlay .article .photo img`, (el) => el.getAttribute('src'));
  if (imgSrc !== '') {
    await fetch(imgSrc)
        .then(x => x.arrayBuffer())
        .then(x => {
          writeFileAsync(path.join(photoPath), Buffer.from(x));
          returnObj.imgSaved = true;
        });
  }

  // Wait for everything to finish downloading
  await modalPage.waitForTimeout(5000);
  const audioDone = await checkFileExists(audioPath);
  const photoDone = await checkFileExists(photoPath);
  if (audioDone && photoDone) {
    // Write metadata to the audio
    const metadata = await metadataWriter(
      audioPath,
      {
        title: itemPosted,
        artist: name,
        album: 'CHEERZ',
        coverPicturePath: photoPath
      }
    );

    // Close the modal
    await modalPage.waitForTimeout(2000);
    await modalPage.close();

    // Wait to move onto the next item
    setTimeout(() => resolve(returnObj), 3000);
  }
});

module.exports = archiver;