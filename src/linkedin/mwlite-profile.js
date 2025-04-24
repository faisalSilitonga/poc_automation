const puppeteerExtra = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')
const fs = require('fs').promises
const puppeteer = require('puppeteer')
const path = require('path')
const jsdom = require('jsdom')
puppeteerExtra.use(pluginStealth())

// ######################
//   Default Config
// ######################

// Proxy config
const proxyUrl = '45.145.57.222:17245'
const proxyUser = '9qM5zp'
const proxyPass = 'epET6U'

// Device config
const isMobile = true
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

// Activity config
const startLine = 1
const maxApiCalls = 20
const minDelay = 3000
const maxDelay = 5000
const inputFilePath = 'linkedin-public-ids.txt'

// ######################
//   End Default Config
// ######################

// Config via cli
const commander = require('commander')
const { program } = require('commander')

function myParseInt(value, dummyPrevious) {
    // parseInt takes a string and a radix
    const parsedValue = parseInt(value, 10)
    if (isNaN(parsedValue)) {
        throw new commander.InvalidArgumentError('Not a number.')
    }
    return parsedValue
}

program.version('0.0.1')
program.option('-f, --input-file <value>', 'The input file path', inputFilePath)
program.option(
    '-l, --start-line <value>',
    'The line number to start when reading the input file',
    myParseInt,
    startLine
)
program.option(
    '-t, --max-calls <value>',
    'Maximum API calls',
    myParseInt,
    maxApiCalls
)
program.option(
    '-m, --min-delay <value>',
    'Minimum delay between api calls (in milisecond)',
    myParseInt,
    minDelay
)
program.option(
    '-x, --max-delay <value>',
    'Maximum delay between api calls (in milisecond)',
    myParseInt,
    maxDelay
)
program.option('-a, --proxy-address <value>', 'The proxy address', proxyUrl)
program.option('-u, --proxy-username <value>', 'The proxy username', proxyUser)
program.option('-p, --proxy-password <value>', 'The Proxy password', proxyPass)
program.parse(process.argv)

main(program.opts())

async function main(options) {
    // Launch browser
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
            `--proxy-server=${options.proxyAddress}`,
        ],
        headless: false,
        devtools: false,
        ignoreHTTPSErrors: true,
        dumpio: false,
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
        username: options.proxyUsername,
        password: options.proxyPassword,
    })

    await page.setDefaultTimeout(360000)
    await page.setDefaultNavigationTimeout(360000)

    // using cookies that saved from login
    const cookiesString = await fs.readFile(
        path.posix.join(__dirname, 'cookies.json')
    )
    const cookies = JSON.parse(cookiesString)
    await page.setCookie(...cookies)

    // Run Activity

    // 1. Go to LI home page
    await page.goto('https://www.linkedin.com/', {
        waitUntil: 'domcontentloaded',
    })

    // 5. Scrape next pages
    console.info('Start scraping profiles')
    const profiles = await scrapeProfiles(page, cookies, options)
    console.info(`Done scraping ${profiles.length} profiles`)
}

async function scrapeProfiles(page, cookies, options) {
    let scrapedProfiles = []

    const filePath = path.resolve(__dirname, options.inputFile)
    const fileContent = await fs.readFile(filePath, 'utf8')
    const data = fileContent.toString().replace(/\r\n/g, '\n').split('\n')
    const profileIdentifiers = []
    for (const profileIdentifier of data) {
        if (profileIdentifier !== '') {
            profileIdentifiers.push(profileIdentifier)
        }
    }
    if (!profileIdentifiers.length) {
        throw new Error('Skip processing: Empty file')
    }
    if (
        options.startLine > profileIdentifiers.length ||
        options.startLine < 1
    ) {
        throw new Error(
            `Skip processing: Start line should be between: 1 and ${profileIdentifiers.length}`
        )
    }

    const maxCalls = Math.min(profileIdentifiers.length, options.maxCalls)

    for (
        let i = 1, idx = options.startLine;
        i <= maxCalls && idx <= profileIdentifiers.length;
        i++, idx++
    ) {
        const profileIdentifier = profileIdentifiers[idx - 1]
        const profileUrl = `https://www.linkedin.com/mwlite/in/${profileIdentifier}`
        scrapedProfiles.push(profileIdentifier)
        try {
            const delay = randomIntFromInterval(
                options.minDelay,
                options.maxDelay
            )
            console.debug(`About to wait for ${delay}ms`)
            await page.waitForTimeout(delay)

            let headers = {
                // "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,/;q=0.8,application/signed-exchange;v=b3;q=0.9",
                // "Dnt": "1",
                // "Sec-Ch-Ua": 'Google Chrome";v="95", "Chromium";v="95", ";Not A Brand";v="99"',
                // "Sec-Ch-Ua-Mobile": "?1",
                // "Sec-Ch-Ua-Platform": '"Android"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
            }
            // console.debug("Headers", headers);
            console.debug(
                `About to call mwlite profile URL #${profileUrl}, iteration: ${i}`
            )
            let respHtml = await page.evaluate(
                (headers, profileUrl) => {
                    return new Promise((resolve, reject) => {
                        fetch(profileUrl, {
                            headers: headers,
                            body: null,
                            method: 'GET',
                            mode: 'cors',
                            credentials: 'include',
                        })
                            .then((resp) => {
                                if (resp.status != 200) {
                                    throw new Error(
                                        resp.status + ' ' + resp.statusText
                                    )
                                }
                                return resp.text()
                            })
                            .then(resolve)
                            .catch(reject)
                    })
                },
                headers,
                profileUrl
            )

            const now = new Date()
            const fileName = `mwlite-profile_${profileIdentifier}.html`
            await saveToFile(respHtml, fileName)
            console.info(`Success saving output to: ${fileName}`)
        } catch (e) {
            console.error(`Error when scraping '${profileIdentifier}': ${e}`)
        }
    }

    return scrapedProfiles
}

// Helpers

function randomIntFromInterval(min, max) {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min)
}

function getCookie(cookies, name) {
    for (const cookie of cookies) {
        if (cookie.name === name) {
            return cookie.value.replace(/"+/g, '')
        }
    }

    return undefined
}

async function saveToFile(content, fileName) {
    await fs.writeFile(path.posix.join(__dirname, fileName), content)
}

function padZero(intVal) {
    if (intVal < 10) {
        return '0' + intVal.toString()
    }
    return intVal.toString()
}
