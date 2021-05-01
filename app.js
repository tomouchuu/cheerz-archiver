const puppeteer = require('puppeteer-extra');
puppeteer.use(require('puppeteer-extra-plugin-stealth')());
puppeteer.use(require('puppeteer-extra-plugin-anonymize-ua')());

const fetch = require('node-fetch');
const fs = require('fs')
const path = require('path')
const { promisify } = require('util');
const metadataWriter = require("write-aac-metadata").default;

const checkFileExists = s => new Promise(r=>fs.access(s, fs.constants.F_OK, e => r(!e)))
const writeFileAsync = promisify(fs.writeFile);

function setupDirs(idol) {
  fs.mkdir(`./${idol}`, (err) => {
    if (err) console.error('Could not setup folder');
    fs.mkdir(`./${idol}/photos`, () => {});
    fs.mkdir(`./${idol}/audios`, () => {});
    fs.mkdir(`./${idol}/videos`, () => {});
  });
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      let totalHeight = 0;
      let distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if(totalHeight >= scrollHeight){
          clearInterval(timer);
          resolve();
        }
      }, 2000);
    });
  });
};

async function run(cheerzUrl) {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--window-size=1920x1080'
    ],
    headless: false
  });

  // Start and login to Cheerz
  const page = await browser.newPage();
  await page.goto('https://cheerz.cz');
  await page.waitForSelector('.login');
  const loginBtn = await page.$$('.login');
  await loginBtn[1].click();
  await page.waitForNavigation();
  // Should be on login page now
  console.log('Please login to cheerz');
  await page.waitForNavigation();

  // Go to the idol's cheerz page
  console.log('Thank you, navigating to the idol\'s page');
  await page.goto(cheerzUrl);

  // Get the idol's name and setup folders
  await page.waitForSelector('.profile .name');
  const name = await (await page.$('.profile .name')).evaluate((node) => node.innerText);
  setupDirs(name);
  
  // Start scrolling til you can no more
  // console.log('Scrolling...');
  // await autoScroll(page);

  // Get all the items
  await page.waitForSelector('.item');
  const items = await page.$$('.item');
  console.log(`Found ${items.length} items`);

  let archiver = (item) => new Promise(async(resolve, reject) => {
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
    const itemPosted = await item.evaluate((node) => node.getAttribute('data-posted-time'));
    returnObj.itemId = itemId;
    returnObj.itemPosted = itemPosted;

    // Setup Paths
    const audioPath = `${__dirname}/${name}/audios/${itemPosted}.m4a`;
    const photoPath = `${__dirname}/${name}/photos/${itemPosted}.jpg`;

    // Get the modal showing
    const modalPage = await browser.newPage();
    await modalPage.goto(`${page.url()}${itemHref}`);

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
      await metadataWriter(
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

  console.log('Starting to archive, this may take awhile');
  // for (let i = 0; i < items.length; i++) {
  for (i in items) {
    const item = await archiver(items[i], i);
    console.log(item);
    if (i > 1) break;
  }

  browser.close();
}

run('https://cheerz.cz/artist/4940');
