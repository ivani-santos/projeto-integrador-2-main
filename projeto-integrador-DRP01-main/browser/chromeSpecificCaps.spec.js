const assert = require('node:assert/strict');
const path = require('node:path');
const Chrome = require('selenium-webdriver/chrome');
const { Browser, Builder } = require('selenium-webdriver');

const blankPage = 'https://www.selenium.dev/selenium/web/blank.html';
const extensionPath = path.join(__dirname, 'resources', 'extensions', 'webextensions-selenium-example.crx');

async function openBlankPage(options) {
  const driver = await new Builder()
    .forBrowser(Browser.CHROME)
    .setChromeOptions(options)
    .build();

  try {
    await driver.get(blankPage);
    assert.equal(await driver.getCurrentUrl(), blankPage);
  } finally {
    await driver.quit();
  }
}

describe('Chrome capabilities', function () {
  it('opens a page in headless mode', async function () {
    await openBlankPage(new Chrome.Options().addArguments('--headless=new'));
  });

  it('excludes the enable-automation switch', async function () {
    await openBlankPage(new Chrome.Options().excludeSwitches('enable-automation'));
  });

  it('accepts the detach capability', async function () {
    await openBlankPage(new Chrome.Options().detachDriver(true));
  });

  it('opens a page with the default Chrome options', async function () {
    await openBlankPage(new Chrome.Options());
  });

  it('loads the Selenium example extension', async function () {
    await openBlankPage(new Chrome.Options().addExtensions(extensionPath));
  });
});