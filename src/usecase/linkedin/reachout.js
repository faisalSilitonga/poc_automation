const puppeteerExtra = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')
const fs = require('fs').promises
const puppeteer = require('puppeteer')
const path = require('path/posix')
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
        `--proxy-server=${proxyUrl}`,
    ],
    headless: false,
    devtools: false,
    ignoreHTTPSErrors: true,
    dumpio: false,
}

// Default invitation message
const invitationMsg = 'Hi, looking to connect!'

;(async () => {
    const file = await fs.readFile(
        require.resolve(path.join(__dirname, 'linkedin-url.txt')),
        'utf8'
    )
    const data = file.toString().replace(/\r\n/g, '\n').split('\n')
    const reachoutProfiles = []

    for (const i of data) {
        if (i !== '') {
            reachoutProfiles.push({
                linkedinUrl: i,
                invitationMsg: invitationMsg,
            })
        }
    }

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

    // using cookies that saved from login
    const cookiesString = await fs.readFile(
        path.join(__dirname, 'cookies.json')
    )
    const cookies = JSON.parse(cookiesString)
    await page.setCookie(...cookies)

    await page.goto('https://www.linkedin.com/feed', {
        waitUntil: 'domcontentloaded',
    })

    const voyagerinBundle = await fs.readFile(
        require.resolve(path.join(__dirname, 'voyagerin-reachout.js')),
        { encoding: 'utf8' }
    )
    await page.evaluate(voyagerinBundle)

    console.log(`Will start the reachout`)

    for (const reachoutProfile of reachoutProfiles) {
        // configuration for batch create
        const isBatchCreate = true
        const delay = generateWarmUpDelay()
        console.log(
            `Waiting delay ${delay}ms execution for ${JSON.stringify(
                reachoutProfile
            )}`
        )

        await new Promise((resolve) =>
            setTimeout(function () {
                resolve()
                console.log(
                    'Done waiting for some delay, will try to reachout now'
                )
            }, delay)
        )

        const [resp] = await Promise.all([
            page.evaluate(
                async (
                    linkedinUrl,
                    msg,
                    cookiesInject,
                    isBatchCreateInject
                ) => {
                    console.log(
                        `receive data ${linkedinUrl}, ${msg}, ${cookiesInject}, ${isBatchCreateInject}`
                    )
                    // eslint-disable-next-line no-undef
                    const response = await window.startReachout(
                        linkedinUrl,
                        msg,
                        cookiesInject,
                        isBatchCreateInject
                    )
                    return response
                },
                reachoutProfile.linkedinUrl,
                reachoutProfile.invitationMsg,
                cookies,
                isBatchCreate
            ),
        ])

        if (resp.code === 200) {
            console.log(
                `Done processing reachout for ${JSON.stringify(
                    reachoutProfile
                )}`
            )
        } else {
            console.log(`Failed reachout because ${resp.status}`)
        }
    }
})()

// the actual delay will be handle by linkedin-orchestrator
// this delay just to mimic the delay that happened in orchestrator
// (although maybe have different delay mechanism that implement in orchestrator)
// this delay function re-use from Chrome Extension
const DELAY = {
    MIN_API_CALL_DELAY_TIME_MS: 500,
    MAX_API_CALL_DELAY_TIME_MS: 2000,
    MIN_WARMING_UP_DELAY_MS: 4 * 1000,
    MAX_WARMING_UP_DELAY_MS: 30 * 1000,
    MIN_EXTRA_DELAY_ITER_RAND: 5,
    MAX_EXTRA_DELAY_ITER_RAND: 20,
    MIN_EXTRA_DELAY_MS: 60 * 1000,
    MAX_EXTRA_DELAY_MS: 120 * 1000,
    MIN_FIRST_DEGREE_SCRAPING_DELAY_MS: 2 * 1000,
    MAX_FIRST_DEGREE_SCRAPING_DELAY_MS: 5 * 1000,
}

function generateWarmUpDelay() {
    return Math.floor(
        Math.random() *
            (DELAY.MAX_WARMING_UP_DELAY_MS - DELAY.MIN_WARMING_UP_DELAY_MS) +
            DELAY.MIN_WARMING_UP_DELAY_MS
    )
}
