import { connect } from 'puppeteer-real-browser';
import { writeFile } from 'fs/promises';
import * as cheerio from 'cheerio';

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

async function convertHtmlToJson(htmlContent, timestamp) {
    const $ = cheerio.load(htmlContent);

    const rows = [];

    $('.ds-dex-table-row').each((i, elem) => {
        const el = $(elem);

        const row = {
            href: el.attr('href'),
            rank: el.find('.ds-dex-table-row-badge-pair-no').text().trim().replace('#', ''),
            chain: el.find('.ds-dex-table-row-chain-icon').attr('title'),
            dex: el.find('.ds-dex-table-row-dex-icon').attr('title'),
            tokenIcon: el.find('.ds-dex-table-row-token-icon-img').attr('src'),
            baseSymbol: el.find('.ds-dex-table-row-base-token-symbol').text().trim(),
            quoteSymbol: el.find('.ds-dex-table-row-quote-token-symbol').text().trim(),
            tokenName: el.find('.ds-dex-table-row-base-token-name-text').text().trim(),
            price: el.find('.ds-dex-table-row-col-price').text().replace('$', '').trim(),
            age: el.find('.ds-dex-table-row-col-pair-age span').text().trim(),
            txns: el.find('.ds-dex-table-row-col-txns').text().replace(',', '').trim(),
            volume: el.find('.ds-dex-table-row-col-volume').text().replace('$', '').trim(),
            makers: el.find('.ds-dex-table-row-col-makers').text().replace(',', '').trim(),
            change_5m: el.find('.ds-dex-table-row-col-price-change-m5 span').text().trim(),
            change_1h: el.find('.ds-dex-table-row-col-price-change-h1 span').text().trim(),
            change_6h: el.find('.ds-dex-table-row-col-price-change-h6 span').text().trim(),
            change_24h: el.find('.ds-dex-table-row-col-price-change-h24 span').text().trim(),
            liquidity: el.find('.ds-dex-table-row-col-liquidity').text().replace('$', '').trim(),
            marketCap: el.find('.ds-dex-table-row-col-market-cap').text().replace('$', '').trim(),
        };

        rows.push(row);
    });

    const outputFile = `dexscreener-data-${timestamp}.json`;
    await writeFile(outputFile, JSON.stringify(rows, null, 2), 'utf-8');
    console.log(`JSON data saved to ${outputFile}`);
}

(async () => {
    // set up browser environment
    const { page } = await connect(launchOpt);

    await page.setViewport(defaultViewPort)

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');

    console.log('Go to web dexscreener.com');
    await page.goto('https://dexscreener.com/', {
        waitUntil: "networkidle2"
    });

    console.log('Success go to dexscreener.com, wait for 15 seconds');

    await new Promise(resolve => setTimeout(resolve, 15000));

    const timestamp = Math.floor(Date.now() / 1000);

    await page.screenshot({ path: `dexscreener-data-${timestamp}.png` });
    console.log(`Screenshot saved to filename: dexscreener-data-${timestamp}.png`);

    const htmlContent = await page.content();
    console.log('HTML content fetched');
    console.log(htmlContent);

    // Save to file
    const filename = `page-${timestamp}.html`;
    await writeFile(filename, htmlContent, 'utf-8');
    console.log(`HTML content saved to filename: ${filename}`);

    // Close the browser
    await page.close();
    console.log('Browser closed');

    console.log('Finished scraping dexscreener.com');

    // Process Html Content 
    console.log('Start Convert Html content to json file');

    // Convert HTML to JSON
    await convertHtmlToJson(htmlContent, timestamp);

})();