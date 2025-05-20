const puppeteer = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')

puppeteer.use(pluginStealth())

const UserAgentOverride = require('puppeteer-extra-plugin-stealth/evasions/user-agent-override')
const uaOverridePlugin = UserAgentOverride()
puppeteer.use(uaOverridePlugin)

const { delay } = require('../util/time')


// Device config
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

const generateProxyUrl = (proxy) => {
    const { ip, port} = proxy;
    return `${ip}:${port}`;
  };

// Function to spawn a browser with proxy and cookies
async function spawnBrowser(proxy, headless = false, cookies = []) {
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
        ],
        headless: headless,
        devtools: false,
        ignoreHTTPSErrors: true,
        dumpio: false,
    };

    const browser = await puppeteer.launch(launchOpt);

    // IMPORATNT
    // MUST Set User-Agent through UserAgentOverride Plugin instance, BEFORE page load
    // page.setUserAgent() is not safe for bot detection        
    // Ref: https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth/evasions/user-agent-override    
    uaOverridePlugin.opts.userAgent = desktopUA

    const page  = await spawnNewPage(browser);
    await closeFirstTab(browser);

    if (proxy) {
        launchOpt.args.push(`--proxy-server=${generateProxyUrl(proxy)}`); // Add proxy server option only if proxy is provided
    }

    // Return both the browser and the pages
    return { browser, page };
}

// Function to scroll the page to a specific element 
// if it is near the bottom of the viewport
async function scrollPageElement(element, page ) {
    // Focus on the element (optional)
    await element.focus();

    // Get the position of the element relative to the viewport
    const elementPosition = await page.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.bottom + window.scrollY;  // Position of the element relative to the document
    }, element);

    // Get the height of the viewport
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    // Check if the element is near the bottom of the viewport
    const threshold = 100; // You can adjust this threshold based on how close you want the element to be to the bottom

    if (elementPosition > viewportHeight - threshold) {
        console.log('Element is near the bottom, scrolling up...');
        // Scroll the element into view, aligning it at the top of the viewport
        await page.evaluate((el) => {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, element);
    }
}

async function closeBrowser(browser) {
    if (browser != undefined) {
        // Got all pages from the browser
        const pages = await browser.pages();

        // Clear cookies and close all pages
        for (let page of pages) {
            // Clear cookies
            await page.deleteCookie(...(await page.cookies()));

            await delay(2000);

            // Close the page
            await page.close();
        }

        // Close the browser
        await browser.close();
    }
}

// Helper function , do not export it
async function spawnNewPage(browser) {
    
    // Create a new page
    const newPage = await browser.newPage();

    // Set the page viewport and user agent
    await newPage.setViewport(defaultViewPort);

    // toggles to bypassing page's Content-Security-Policy
    await newPage.setBypassCSP(true)

    // Set timeouts for navigation and default timeout for operations
    await newPage.setDefaultTimeout(360000)
    await newPage.setDefaultNavigationTimeout(360000)

    // Return the new page
    return newPage;
}

async function closeFirstTab(browser) {
    // Got all pages from the browser
    const tabs = await browser.pages();

    if (tabs.length >= 2) {
        // Close the first tab
        await tabs[0].close();
    }
}

module.exports = {
    spawnBrowser,
    closeBrowser,
    scrollPageElement,
}