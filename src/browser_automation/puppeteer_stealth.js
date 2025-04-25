const puppeteerExtra = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')
puppeteerExtra.use(pluginStealth())

// Proxy config
const proxyUrl = '45.145.57.219:13765'
const proxyUser = 'kwrT2v'
const proxyPass = 'kSDY37'

// Device config
const isMobile = false
const mobileDevice = 'iPhone X'
const desktopUA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
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
    args: [],
    headless: false,
    fingerprint: true,
    turnstile: true,
    tf: true,
    }

;(async () => {
    const browser = await puppeteerExtra.launch(launchOpt)
    const [page] = await browser.pages()


        // desktop
    await page.setViewport(defaultViewPort)
    
    await page.goto('https://www.neptus.co.id/', {
        waitUntil: 'domcontentloaded',
    })
    await new Promise(resolve => setTimeout(resolve, 2000));
    // await page.waitForTimeout(2000); // Wait for resources to settle, adjust as needed

    // Ensure preloaded resources are used
    // await page.evaluate(() => {
    // const preload = document.querySelector('link[rel="preload"][href="https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/g/cmg/1"]');
    // if (preload) preload.remove(); // Remove preload if it’s not needed
    // });


    // await page.authenticate({
    //     username: proxyUser,
    //     password: proxyPass,
    // })

    // await page.setDefaultTimeout(360000)
    // await page.setDefaultNavigationTimeout(360000)

    // await page.goto('https://dexscreener.com/', {
    //     waitUntil: 'domcontentloaded',
    // })
})()
