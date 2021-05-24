const puppeteer = require('puppeteer-core');
const { intercept, patterns } = require('puppeteer-interceptor');
const findChrome = require('chrome-finder');
let chromePath;

const archiver = require('./utils/archiver');
const autoScroll = require('./utils/auto-scroll');
const setupDirs = require('./utils/setup-dirs');

const React = require('react');
const {render, useApp, Box, Text, Newline, Static} = require('ink');
const BigText = require('ink-big-text');
const UncontrolledTextInput = require('ink-text-input').UncontrolledTextInput;
const Spinner = require('ink-spinner').default;

const App = () => {
  const {exit} = useApp();
  const [logs, setLogs] = React.useState([]);
  const [chromeDownloaded, setChromeDownloaded] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [totalItems, setTotalItems] = React.useState(0);
  const [completeItems, setCompleteItems] = React.useState(0);

  React.useEffect(() => {
    const userChromePath = findChrome();
    if (userChromePath) {
      chromePath = userChromePath;
      setChromeDownloaded(true);
    }
  });

  /**
   * handleSubmit
   * The archive process
   * @param {String} cheerzUrl URL to Cheerz page
   */
  const handleSubmit = async cheerzUrl => {
    setArchiving(true);
    setLogs(previousLogs => [
      ...previousLogs,
      {
        key: 'booting',
        color: '',
        text: 'Opening chromium and navigating to cheerz, please wait'
      }
    ]);

    const browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-gpu',
        '--window-size=1920x1080'
      ],
      headless: false,
      executablePath: chromePath
    });
  
    // Start and login to Cheerz
    const page = await browser.newPage();
    await page.setViewport({
      width: 1920,
      height: 1080
    });
    await page.goto('https://cheerz.cz');
    await page.waitForSelector('.login');
    const loginBtn = await page.$$('.login');
    await loginBtn[1].click();
    await page.waitForNavigation();
    // Should be on login page now
    setLogs(previousLogs => [
      ...previousLogs,
      {
        key: 'login',
        color: 'yellow',
        text: 'Please login to cheerz'
      }
    ]);
    await page.waitForNavigation();

    // Block voice urls so we can access them later?
    intercept(page, patterns.XHR('https://cheerz.cz/ajax/voice-url'), {});
  
    // Go to the idol's cheerz page
    setLogs(previousLogs => [
      ...previousLogs,
      {
        key: 'loginSuccess',
        color: 'green',
        text: 'Thank you, navigating to the idol\'s page'
      }
    ]);
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
    setTotalItems(items.length);
    setLogs(previousLogs => [
      ...previousLogs,
      {
        key: 'foundItems',
        color: '',
        text: `Found ${items.length} items`
      }
    ]);
  
    setLogs(previousLogs => [
      ...previousLogs,
      {
        key: 'starting',
        color: 'blue',
        text: 'Starting to archive, this may take awhile'
      }
    ]);
    setDownloading(true);
    for (let i = 0; i < items.length; i++) {
      const item = await archiver(items[i], name, cheerzUrl, downloadDir, browser);
      if (item.imgSaved) {
        setCompleteItems(lastCompletedItemNumber => lastCompletedItemNumber + 1);
      }
    }
  
    browser.close();
    exit();
  }

  return (
    <>
      {!archiving && (
        <Box>
          <Text>
            <BigText text="Cheerz" align="center" />
            <Newline />
            <BigText text="Archiver" align="center" />
            <Newline />
            <Newline />
            <Text>This script will archive all of an idols photos and audio for what you have access to.</Text>
            <Newline />
            {!chromeDownloaded && (
              <>
                <Text color="red">
                  Sorry, but you need chrome downloaded to run this 😓
                </Text>
              </>
            )}
            {chromeDownloaded && (
              <>
                <Text>To start, enter the url for the idol:</Text>
                <Newline />
                <UncontrolledTextInput onSubmit={handleSubmit} placeholder="eg. https://cheerz.cz/artist/..." />
              </>
            )}
          </Text>
        </Box>
      )}
      {archiving && (
        <Box>
          <Static items={logs}>
            {log => (
              <Box key={log.key}>
                <Text color={log.color}>{log.text}</Text>
              </Box>
            )}
          </Static>
          {downloading && (
            <>
              <Box marginRight={2}>
                <Text color="green">
                  <Spinner type="dots" />
                </Text>
              </Box>
              <Text>Archived {completeItems} / {totalItems}</Text>
            </>
          )}
        </Box>
      )}
      {archiving && downloading && completeItems === totalItems && (
        <Box>
          <Text>
            <BigText text="4946" align="center" />
            <Text color="green">Archive complete</Text>
          </Text>
        </Box>
      )}
    </>
  )
}
render(<App />);
