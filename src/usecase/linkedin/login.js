const puppeteerExtra = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')
const puppeteer = require('puppeteer')
const path = require('path/posix')
const fs = require('fs').promises
puppeteerExtra.use(pluginStealth())

// Proxy config
const proxyUrl = '45.145.57.219:13765'
const proxyUser = 'kwrT2v'
const proxyPass = 'kSDY37'

// Device config
const isMobile = false
const mobileDevice = 'iPhone X'
const desktopUA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36'
const defaultViewPort = {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: false,
    isMobile: false,
}

// Browser options
const launchOpt = {
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        // `--proxy-server=${proxyUrl}`,
    ],
    headless: false,
    devtools: false,
    ignoreHTTPSErrors: true,
    dumpio: false,
}

;(async () => {
    const browser = await puppeteerExtra.launch(launchOpt)
    const [page] = await browser.pages()

    if (isMobile) {
        // mobile device
        const device = puppeteer.devices[mobileDevice]
        await page.emulate(device)
    } else {
        // desktop
        await page.setViewport(defaultViewPort)
        await page.setUserAgent(desktopUA)
    }

    await page.authenticate({
        username: proxyUser,
        password: proxyPass,
    })

    await page.setDefaultTimeout(360000)
    await page.setDefaultNavigationTimeout(360000)

    await page.goto('https://www.linkedin.com/login', {
        waitUntil: 'domcontentloaded',
    })

    async function saveCookies() {
        const cookies = await page.cookies()
        await fs.writeFile(
            path.join(__dirname, 'cookies.json'),
            JSON.stringify(cookies, null, 2)
        )
        console.log('Success saved cookies')
    }

    await page.exposeFunction('saveCookies', saveCookies)

    let url = page.url()

    while (!url.includes('/feed')) {
        await page.waitForNavigation({ waitUntil: 'networkidle2' })
        url = page.url()
    }

    await page.waitForNavigation({ waitUntil: 'networkidle2' })

    // waiting user intervention to call saveCookies inside console browser
    // can close the browser manually if already succees saved cookies
})()
