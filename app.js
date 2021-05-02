const puppeteer = require('puppeteer-extra');
puppeteer.use(require('puppeteer-extra-plugin-stealth')());
puppeteer.use(require('puppeteer-extra-plugin-anonymize-ua')());

const archiver = require('./utils/archiver');
const autoScroll = require('./utils/auto-scroll');
const setupDirs = require('./utils/setup-dirs');

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
  
  const downloadDir = setupDirs(name);
  
  // Start scrolling til you can no more
  // console.log('Scrolling...');
  // await autoScroll(page);

  // Get all the items
  await page.waitForSelector('.item');
  const items = await page.$$('.item');
  console.log(`Found ${items.length} items`);

  console.log('Starting to archive, this may take awhile');
  // for (let i = 0; i < items.length; i++) {
  for (i in items) {
    const item = await archiver(items[i], name, cheerzUrl, downloadDir, browser);
    console.log(item);
    if (i >= 1) break;
  }

  browser.close();
}

run('https://cheerz.cz/artist/4940');
