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
const startPage = 1
const maxApiCalls = 20
const minDelay = 3000
const maxDelay = 5000

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
program.option(
    '-i, --start-page <value>',
    'The connections API initial page',
    myParseInt,
    startPage
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
    let apiCallCount = 0

    // 1. Go to LI home page
    await page.goto('https://www.linkedin.com/', {
        waitUntil: 'domcontentloaded',
    })

    // 2. Go to My network page
    await goToMyNetworkPage(page)

    // 3. go to Connections page
    await goToConnectionsPage(page)

    // 4. Scrape first page
    console.info('Start scraping firstPage connections')
    const firstPageConnections = await scrapeFirstPageConnections(page)

    // 5. Scrape next pages
    console.info('Start scraping nextPage connections')
    const otherPagesConnections = await scrapeOtherPagesConnections(
        page,
        cookies,
        options
    )

    const allProfiles = [...firstPageConnections, ...otherPagesConnections]

    const now = new Date()
    const fileName = `mwlite-firstdegree_${now.getFullYear()}${padZero(
        now.getMonth() + 1
    )}${padZero(now.getDate())}${padZero(
        now.getHours()
    )}${now.getMinutes()}${padZero(now.getSeconds())}.json`
    await saveToFile(allProfiles, fileName)
    console.info(`Success saving output to: ${fileName}`)
}

async function scrapeFirstPageConnections(page) {
    return await page.evaluate(() => {
        let result = []

        const items = document.querySelectorAll('.connection-entry')
        if (!items || !items.length) return result

        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            const url = '/in/' + item.getAttribute('data-vanity')

            let pictureUrl = null
            const picEl = item.querySelector('img.person-entity-medium')
            if (picEl) {
                pictureUrl = picEl.getAttribute('src')
            }

            const nameEl = item.querySelector('.entity-content h3.name span')
            const name = (nameEl || {}).textContent

            const headlineEl = item.querySelector('div.headline span')
            const headLine = (headlineEl || {}).textContent
            result.push({
                linkedin_profile_url: url,
                name: name,
                picture_url: pictureUrl,
                headline: headLine,
            })
        }

        return result
    })
}

async function scrapeOtherPagesConnections(page, cookies, options) {
    let otherConnections = []
    for (
        let i = 1, pageNumber = options.startPage;
        i <= options.maxCalls;
        i++, pageNumber++
    ) {
        const delay = randomIntFromInterval(options.minDelay, options.maxDelay)
        console.debug(
            `About to wait for ${delay}ms`,
            options.minDelay,
            options.maxDelay
        )
        await page.waitForTimeout(delay)

        let headers = {
            accept: '*/*',
            'accept-language': 'en-US,en;q=0.9',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'x-effective-connection-type': '3g',
            'x-referer-pagekey': 'p_mwlite_my_connections',
            'x-requested-with': 'XMLHttpRequest',
        }
        const csrfToken = getCookie(cookies, 'JSESSIONID')
        if (!csrfToken) {
            throw Error('Empty csrfToken')
        }
        headers['csrf-token'] = csrfToken
        // console.debug("Headers", headers);
        console.debug(
            `About to call connections API #${i}, pageNumber: ${pageNumber}`
        )
        let respHtml = await page.evaluate(
            (headers, pageNumber, iterationNum) => {
                return new Promise((resolve, reject) => {
                    let url = `https://www.linkedin.com/mwlite/mynetwork/invite-connect/connections?pageNumber=${pageNumber}`
                    const isOddIteration = iterationNum % 2
                    if (isOddIteration) {
                        url = `https://www.linkedin.com/mwlite/mynetwork/invite-connect/connections?offset=0&pageNumber=${pageNumber}`
                    }
                    fetch(url, {
                        headers: headers,
                        referrer:
                            'https://www.linkedin.com/mynetwork/invite-connect/connections/',
                        referrerPolicy: 'strict-origin-when-cross-origin',
                        body: null,
                        method: 'GET',
                        mode: 'cors',
                        credentials: 'include',
                    })
                        .then((resp) => resp.text())
                        .then(resolve)
                        .catch(reject)
                })
            },
            headers,
            pageNumber,
            i
        )

        let connections = getConnectionsFromHtmlString(respHtml)

        if (connections.length) {
            console.info(`Got ${connections.length} profiles`)
            otherConnections.push(...connections)
        } else {
            console.info('Stop calling API: no more result')
            break
        }
    }

    return otherConnections
}

async function goToMyNetworkPage(page) {
    const randomWait = randomIntFromInterval(2000, 6000)
    console.debug(
        `Wait ${randomWait}ms before clicking the My Network page link`
    )
    await page.waitForTimeout(randomWait)

    const myNetworkLink = await page.$('#nav-people-small')
    if (!myNetworkLink) {
        throw Error('Could not find My network page link')
    }
    await myNetworkLink.click()
    await page.waitForNavigation()
}

async function goToConnectionsPage(page) {
    const randomWait = randomIntFromInterval(2000, 6000)
    console.debug(
        `Wait ${randomWait}ms before clicking the Connections page link`
    )
    await page.waitForTimeout(randomWait)

    const contactsLink = await page.$(
        '#app-container > section.connections-container.connections-abook-container > a.connections-blk-large.connections-blk-common'
    )
    if (!contactsLink) {
        throw Error('Could not find Connection page link')
    }
    await contactsLink.click()
    await page.waitForNavigation()
}

// Helpers
function getConnectionsFromHtmlString(htmlString) {
    const dom = new jsdom.JSDOM(htmlString)

    return parseConnectionsFromHtmlElement(dom.window.document)
}

function parseConnectionsFromHtmlElement(parentHtmlElement) {
    let result = []

    const items = parentHtmlElement.querySelectorAll('.connection-entry')
    if (!items || !items.length) return result

    for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const url = '/in/' + item.getAttribute('data-vanity')

        const picEl = item.querySelector('img.person-entity-medium')
        let pictureUrl = null
        if (picEl) {
            pictureUrl = picEl.getAttribute('data-delayed-url')
        }

        const nameEl = item.querySelector('.entity-content h3.name span')
        const name = (nameEl || {}).textContent

        const headlineEl = item.querySelector('div.headline span')
        const headLine = (headlineEl || {}).textContent
        result.push({
            profile_url: url,
            name: name,
            picture_url: pictureUrl,
            headline: headLine,
        })
    }

    return result
}

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

async function saveToFile(obj, fileName) {
    await fs.writeFile(
        path.posix.join(__dirname, fileName),
        JSON.stringify(obj, null, 2)
    )
}

function padZero(intVal) {
    if (intVal < 10) {
        return '0' + intVal.toString()
    }
    return intVal.toString()
}
