const assert = require('node:assert/strict');
const Chrome = require('selenium-webdriver/chrome');
const { By, Browser, Builder, Select, until } = require('selenium-webdriver');

const appUrl = (process.env.FOTECTA_URL || 'http://localhost:3000').replace(/\/+$/, '');
const waitTimeout = 15000;

async function clickVisible(webDriver, selector) {
  const element = await webDriver.findElement(By.css(selector));
  await webDriver.executeScript(
    'arguments[0].scrollIntoView({ block: "center", behavior: "instant" });',
    element,
  );
  await webDriver.wait(until.elementIsVisible(element), waitTimeout);
  await element.click();
}

describe('FOTECTA no navegador', function () {
  let driver;

  beforeEach(async function () {
    driver = await new Builder()
      .forBrowser(Browser.CHROME)
      .setChromeOptions(new Chrome.Options().addArguments('--headless=new'))
      .build();
  });

  afterEach(async function () {
    if (driver) {
      await driver.quit();
      driver = null;
    }
  });

  it('abre a pagina inicial e mostra a apresentacao do FOTECTA', async function () {
    await driver.get(appUrl);

    await driver.wait(until.elementLocated(By.id('titulo-principal')), waitTimeout);
    assert.match(await driver.getTitle(), /FOTECTA/i);
    assert.match(await driver.findElement(By.id('titulo-principal')).getText(), /Encontre o olhar/i);
  });

  it('filtra fotografos por nome, especialidade e cidade na pagina', async function () {
    await driver.get(`${appUrl}/#busca`);
    await driver.wait(until.elementLocated(By.id('filtro-form')), waitTimeout);
    await driver.findElement(By.id('busca-input')).sendKeys('Carlos');
    await new Select(driver.findElement(By.id('especialidade'))).selectByVisibleText('Publicidade');
    await driver.findElement(By.id('cidade')).sendKeys('Campinas');
    await clickVisible(driver, '#filtro-form button[type="submit"]');

    await driver.wait(async () => {
      const status = await driver.findElement(By.id('busca-status')).getText();
      return status === '1 fotógrafo(s) encontrado(s).';
    }, waitTimeout);

    const cards = await driver.findElements(By.css('#lista-profissionais .card'));
    assert.equal(cards.length, 1);
    assert.match(await cards[0].getText(), /Carlos Mendes/);
  });

  it('autentica um cliente de demonstracao e permite sair', async function () {
    await driver.get(`${appUrl}/#login`);
    await driver.wait(until.elementLocated(By.id('login-form')), waitTimeout);
    await driver.findElement(By.id('login-email')).sendKeys('cliente@fotecta.com');
    await driver.findElement(By.id('login-senha')).sendKeys('cliente123');
    await clickVisible(driver, '#login-form button[type="submit"]');

    await driver.wait(async () => (
      await driver.findElement(By.id('dashboard-logado')).getAttribute('hidden') === null
    ), waitTimeout);

    assert.equal(await driver.findElement(By.id('dash-user-email')).getText(), 'cliente@fotecta.com');
    await clickVisible(driver, '#btn-logout');

    await driver.wait(until.elementLocated(By.css('#nav-auth a[href="#login"]')), waitTimeout);
    assert.notEqual(await driver.findElement(By.id('dashboard-logado')).getAttribute('hidden'), null);
  });
});