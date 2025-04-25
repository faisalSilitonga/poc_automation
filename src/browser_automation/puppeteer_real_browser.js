import { connect } from 'puppeteer-real-browser';

const launchOpt = {
    args: [],
    headless: false,
    fingerprint: true,
    turnstile: true,
    tf: true,
}

const defaultViewPort = {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false,
};

(async () => {
    // set up browser environment
    const { page } = await connect(launchOpt);

    await page.setViewport(defaultViewPort)

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');

    console.log('Go to web dexscreener.com');
    await page.goto('https://www.neptus.co.id/', {
        waitUntil: "networkidle2"
    });

    console.log('Success go to dexscreener.com, wait for 15 seconds');

    await new Promise(resolve => setTimeout(resolve, 15000));

    await page.screenshot({ path: `dexscreener-data-${timestamp}.png` });
    console.log(`Screenshot saved to filename: dexscreener-data-${timestamp}.png`);

    // Close the browser
    await page.close();
    console.log('Browser closed');

})();


