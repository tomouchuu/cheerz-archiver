const { intercept, patterns } = require('puppeteer-interceptor');
const path = require('path');
const {format, parse} = require('date-fns');
const fetch = require('node-fetch');
// const metadataWriter = require("write-aac-metadata").default;

const checkFileExists = require('./check-file-exists');
const writeFileAsync = require('./write-file-async');

const urlRegex = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/;

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
  intercept(modalPage, patterns.XHR('https://cheerz.cz/ajax/voice-url'), {
    onResponseReceived: event => {
      const audioRes = JSON.parse(event.response.body);
      const audioSrc = audioRes.Result.voice_url;
      fetch(audioSrc)
        .then(x => x.arrayBuffer())
        .then(x => {
          writeFileAsync(audioPath, Buffer.from(x));
          returnObj.audioSaved = true;
        });
    }
  });

  // Handle unsupported items (mail magazines)
  let isMagazine = false;
  try {
    await modalPage.$(`#item-${itemId}.overlay #itemCheerCount${itemId}.cheerCount.magazine`);
  } catch {
    isMagazine = true;
  }

  if (isMagazine) {
    // Close the modal
    await modalPage.waitForTimeout(2000);
    await modalPage.close();

    console.log(`Item ${cheerzUrl}${itemHref} was a mail magazine, there is no way to archive mail magazine items, sorry ; ;`);
    returnObj.imgSaved = true;

    // Wait to move onto the next item
    setTimeout(() => resolve(returnObj), 3000);
  }

  // Get image
  let imgSrc = '';

  try {
    await modalPage.waitForSelector(`#item-${itemId}.overlay .article .photo img`, { timeout: 5000 });
    imgSrc = await modalPage.$eval(`#item-${itemId}.overlay .article .photo img`, (el) => el.getAttribute('src'));
  } catch {
    console.log('Could not find an image, maybe supporter only?');
  }

  if (modalPage.$(`#item-${itemId}.overlay .article .supporterOnly`)) {
    console.log(`Item ${cheerzUrl}${itemHref} is for supporters only. Getting the blurred image`);
    const supportStyleAttr = await modalPage.$eval(`#item-${itemId}.overlay .article .supporterOnly`, (el) => el.getAttribute('style'));
    imgSrc = supportStyleAttr.match(urlRegex)[0];
  }
  
  if (imgSrc !== '') {
    await fetch(imgSrc)
        .then(x => x.arrayBuffer())
        .then(x => {
          writeFileAsync(path.join(photoPath), Buffer.from(x));
          returnObj.imgSaved = true;
        });
  }

  // Check the audio actually exists
  let audioPresent = false;
  if (modalPage.$(`#item-${itemId}.overlay #cheerArea${itemId} .voiceBtn`)) {
    audioPresent = true;
  }

  // Wait for everything to finish downloading
  await modalPage.waitForTimeout(5000);
  const audioDone = await checkFileExists(audioPath);
  const photoDone = await checkFileExists(photoPath);
  if ((audioPresent && audioDone) && photoDone) {
    // FIXME: FFMPEG is not being included in the build, so this will fail
    // // Write metadata to the audio
    // const metadata = await metadataWriter(
    //   audioPath,
    //   {
    //     title: itemPosted,
    //     artist: name,
    //     album: 'CHEERZ',
    //     coverPicturePath: photoPath
    //   }
    // );

    // Close the modal
    await modalPage.waitForTimeout(2000);
    await modalPage.close();

    // Wait to move onto the next item
    setTimeout(() => resolve(returnObj), 3000);
  } else if (photoDone) {
    // Close the modal
    await modalPage.waitForTimeout(2000);
    await modalPage.close();

    console.log(`Audio was not saved for ${cheerzUrl}${itemHref}, does it have a voice?`);

    // Wait to move onto the next item
    setTimeout(() => resolve(returnObj), 3000);
  } else {
    console.log('There has been an error, please restart from the last completed number');
  }
});

module.exports = archiver;