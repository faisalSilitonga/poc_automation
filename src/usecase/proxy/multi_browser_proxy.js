const puppeteerExtra = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')
const puppeteer = require('puppeteer')
const path = require('path/posix')
const { writeFile } = require('fs/promises')

const csv = require('csv-parser')
const fs = require('fs')

puppeteerExtra.use(pluginStealth())

// Proxy config
const proxies = [
    {
        "ip": "46.3.158.160",
        "port": "8000",
        "username": "vj0cSq",
        "password": "g8AbSy"
    },
    {
        "ip": "45.151.234.3",
        "port": "8000",
        "username": "PBMR40",
        "password": "xztPZQ"
    },
    {
        "ip": "45.86.246.122",
        "port": "8000",
        "username": "hK0yEp",
        "password": "nEbwqT"
    },
    {
        "ip": "45.151.234.171",
        "port": "8000",
        "username": "35L4mm",
        "password": "hGfW6m"
    },
    {
        "ip": "46.3.159.25",
        "port": "8000",
        "username": "tzgvM4",
        "password": "N3nmtF"
    }
]

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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const NUM_PAGES = 1;

const generateProxyUrl = (proxy) => {
    const { ip, port} = proxy;
    return `${ip}:${port}`;
  };

const getSurnamesFromCSV = async (csvFilePath) => {
    return new Promise((resolve, reject) => {
      const surnames = [];
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
            // Assuming the CSV has a column named 'surename'
            const trimmedSurname = row[Object.keys(row)]?.trim();
            if (trimmedSurname) {
                surnames.push(trimmedSurname); 
            }
        })
        .on('end', () => {
          resolve(surnames);
        })
        .on('error', (err) => {
          reject(err);
        });
    });
};

const spawnBrowser = async (proxy, num_pages) => {
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
        headless: "new",
        devtools: false,
        ignoreHTTPSErrors: true,
        dumpio: false,
    }

    if (proxy) {
        launchOpt.args.push(`--proxy-server=${generateProxyUrl(proxy)}`); // Add proxy server option only if proxy is provided
    }

    const browser = await puppeteerExtra.launch(launchOpt)

    const pages = await Promise.all(
        Array.from({ length: num_pages }, async (_, index) => {
            let page = undefined

            if (index == 0) {
                const [ browserPage ] = await browser.pages()
                page = browserPage
            } else {
                page = await browser.newPage();
            }


            await page.setViewport(defaultViewPort);
            await page.setUserAgent(desktopUA);
            await page.setDefaultTimeout(360000)
            await page.setDefaultNavigationTimeout(360000)

            await page.authenticate({
                username: proxy.username,
                password: proxy.password,
            })

            return page;
        })
    );

    // Return both the browser and the pages
    return { browser, pages }; 
};

const scrapedPageData = async (page, surename) => {

    let data = undefined;

    // Go to page
    await page.goto(`https://forebears.io/surnames?q=${surename}`, {
        waitUntil: 'domcontentloaded',
    })

    let delay = Math.floor(Math.random() * 1000) + 100;
    await sleep(delay);

    // wait for the page to load
    const firstResult =  await page.$('.search-result'); // gets the first child div inside .search-results

    if (firstResult) {
        data = await page.evaluate((el, surename) => {
            const name = el.querySelector('.name')?.innerText.trim();
            const detailValues = el.querySelectorAll('.detail-value');
          
            return {
              'surename': surename,  
              'forebear_name': name,
              'globalIncidence': detailValues[0]?.innerText.trim(),
              'prevalentCountry': detailValues[1]?.getAttribute('title'),
              'densityCountry': detailValues[2]?.getAttribute('title'),
            };
        }, firstResult, surename);
    }
    
    return data

};

const run = async () => {
    const start = Date.now();

    const surnames = await getSurnamesFromCSV('src/proxy/lastnames_forebears.csv');
    const results = [];
    let successCount = 0; // To keep track of successful scrapes
    const limitDataScrapped = 1000; // Set the limit for successful scrapes

    const numBrowsers = 5; // Number of browsers to spawn (can adjust based on available resources)
    const batchSize = Math.ceil(surnames.length / numBrowsers); // Divide surnames into batches

    

    try {
        const browserPromises = [];

        // Use multiple browsers for parallel scraping
        for (let i = 0; i < numBrowsers; i++) {
            const batch = surnames.slice(i * batchSize, (i + 1) * batchSize);
            const browserPromise = (async (browserIndex) => {
                const { browser, pages } = await spawnBrowser(proxies[browserIndex], 1);
                const page = pages[0];
                    
                let processedSurename = 0;
                let delayDataCount = Math.floor(Math.random() * 10) + 40
    
                console.log(`Success spawn Browser-${browserIndex}, run scraping with delay count data ${delayDataCount}`);
    
                try {
                    // Loop through the surnames in the batch
                    for (const surename of batch) {
                        if (limitDataScrapped != 0 && successCount >= limitDataScrapped) {
                            console.log(`Successfully scraped ${limitDataScrapped} records. Stopping...`);
                            break; // Exit the loop after 100 successful scrapes
                        }
            
                        const data = await scrapedPageData(page, surename);
                        
                        successCount++; // Increment the success count
                        processedSurename++;
                        console.log(`Browser-${browserIndex}  Scraped: ${surename} (Total Success Count: ${successCount}, Browser Scape Count: ${processedSurename})`);

                        if (data) {
                            results.push(data);
                        }
            
                        // add delay to write the surename between 3 to 5 seconds
                        const delay = Math.floor(Math.random() * 500) + 100;
                        await sleep(delay);
    
                        if (processedSurename % delayDataCount == 0) {
                            // Add delay to reduce call concurent
                            const scrapingDelay = Math.floor(Math.random() * 5000) + 10000;
                            console.info(`Slowdown Scraping in Browser-${browserIndex} for: ${scrapingDelay} ms`);
                            await sleep(scrapingDelay);
                            console.info(`Restart Scraping in Browser-${browserIndex}`);
                        }
                    }
                } catch (error) {
                    console.error(`Error in Browser-${browserIndex} scraping: ${error}`);
                } finally {
                    // Close the pages and browser when done
                    console.info(`Start Closing Browser-${browserIndex}`);
                    for (const page of pages) {
                        if (page != undefined) {
                            await page.close();
                        }
                    }
                    if (browser != undefined) {
                        await browser.close();
                    }
                    
                    console.info(`Finish Closing Browser-${browserIndex}`);
                }

                return
            })(i);

            browserPromises.push(browserPromise);
        }

        // Wait for all browser scraping to finish
        await Promise.all(browserPromises);
    } finally {
        const end = Date.now();
        console.log(`Data extraction took ${end - start} ms`);

        if (results.length > 0) {
            // Save the results to a JSON file
            await writeFile('surnames_results.json', JSON.stringify(results, null, 2), 'utf-8');
            console.log('All data saved to surnames_results.json');
        }
    }
    
};

run();
