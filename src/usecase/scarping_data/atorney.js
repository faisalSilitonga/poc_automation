const puppeteerExtra = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')
const XLSX = require('xlsx');
const fs = require('fs');

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

            if (proxy) {
                await page.authenticate({
                    username: proxy.username,
                    password: proxy.password,
                })
            }

            return page;
        })
    );

    // Return both the browser and the pages
    return { browser, pages }; 
};

const scrapedPageData = async (page) => {

    const results = [];

    try {

        // Go to page
        await page.goto(`https://www.va.gov/ogc/apps/accreditation/`, {
            waitUntil: 'domcontentloaded',
        })

        // Wait for the select element to be available
        await page.waitForSelector('select#State');

        // Count the number of <option> elements inside the <select> box
        const optionCount = await page.evaluate(() => {
            const select = document.querySelector('select#State');
            return select ? select.options.length : 0;
        });

        console.log('Number of state:', optionCount);

        // Loop over each option (starting from index 1 to skip the first empty one)
        for (let i = 1; i <= 6; i++) {

            if (i == 5) {
                console.log('Skip CA.');
                continue
            }

            // Select the option by index
            await page.select('select#State', await page.evaluate((index) => {
                const select = document.querySelector('select#State');
                return select.options[index].value;
            }, i));

            // add delay between 2 to 5 seconds
            let delay = Math.floor(Math.random() * 1000) + 500;
            await sleep(delay);

            const radioButton = await page.$('input[type="radio"][name="PersonTypeCheck"][value="Att"]', { timeout: 5000 });
            if (radioButton) {
                await radioButton.click();
            } 

            // Get the selected option's text from the select box
            const selectedState = await page.evaluate(() => {
                const selectElement = document.querySelector('#State');
                const selectedOption = selectElement.options[selectElement.selectedIndex];
                return selectedOption.text;
            });

            // add delay between 1 to 3 seconds
            delay = Math.floor(Math.random() * 3000) + 1000;
            await sleep(delay);

            // Wait for the "Search" button to be available and click it
            await page.waitForSelector('input[type="button"][value="Search"]');
            await page.click('input[type="button"][value="Search"]');
            
            // Wait for the results to load

            console.log(`Start scrap attorney data for ${selectedState}`);

            const attorneyData = await scrapedAttorneyData(page);

            if (attorneyData && Array.isArray(attorneyData)) {
                results.push(...attorneyData);
            } else {
                console.log('No attorney data found.');
                return results
            }


            // add delay between 2 to 5 seconds
            delay = Math.floor(Math.random() * 3000) + 2000;
            await sleep(delay);

            // After scraping, go back to the search page
            await page.goBack({ waitUntil: 'load' });

            // Wait again to ensure everything is ready before next select
            await page.waitForSelector('select#State');
        }

    } catch (error) {
        console.error(`Error in scraping: ${error}`);
    }

    console.log('Finished scraping all states.');
    return results
};

const scrapedAttorneyData = async (page) => {
// Wait for the new page to load, you can either use waitForNavigation or waitForSelector
    // Wait for a specific element in the new page to ensure the page has loaded
    await page.waitForNavigation({ waitUntil: 'load', timeout: 10000 });  // wait for page load

    // Check the URL of the new page
    const currentUrl = await page.url();
    // console.log('Current URL:', currentUrl);

    // Optionally, compare the URL to a known value
    if (!currentUrl.includes("www.va.gov/ogc/apps/accreditation/accredpeople")) {
        console.log('Failed navigated to the desired page!');
        return null;
    }

    // Wait for the table to load on the new page
    await page.waitForSelector('table.aspbox');

    // Extract the rows from the table and gather the data
    // Extract the rows from the table and gather the data, excluding the first row (header)
    let data = await page.evaluate(async () => {
        const rows = Array.from(document.querySelectorAll('table.aspbox tbody tr'));

        // Skip the first row (index 0), which is the header
        const results = [];

        for (let row of rows.slice(1)) {
            const columns = row.querySelectorAll('td');

            // Extract the link in the first column (if it exists)
            const link = columns[0]?.querySelector('a')?.href;

            if (link) {
                // Simulate navigating to the link
                const pageData = {
                    name: columns[0]?.innerText.trim(),
                    city: columns[1]?.innerText.trim(),
                    state: columns[2]?.innerText.trim(),
                    zip: columns[3]?.innerText.trim(),
                    phone: columns[4]?.innerText.trim(),
                };

                // Return the data along with the link (or visit the link if necessary)
                results.push({ pageData, link });
            }
        }
        return results;
    });

    console.log(`Count of attorney in the state : ${data.length}`);

    // Loop through each result and navigate to the link (if any)
    // for (let entry of data) {
    for (const [index, entry] of data.entries()) {
        if (entry.link) {
            await page.goto(entry.link, { waitUntil: 'load' });
            
            // Wait for the content to load
            await page.waitForSelector('#content-wrapper');

            // Extract the data after the page-title
            const detailData = await page.evaluate(() => {
                // Get the content that comes after the page-title
                const paragraphs = document.querySelectorAll('#content-area-template-B p');
            
                // Check if there are at least 2 <p> elements inside #content-area-template-B
                if (paragraphs.length > 1) {
                    // Return the text content of the second <p> element inside the container
                    const text = paragraphs[1].innerText.trim();

                    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

                    // Extract name
                    const name = lines[0] || null;

                    // Determine if second line is organization or address
                    let organization = null;
                    let addressStartIndex = 1;

                    // Check if second line starts with a number (address)
                    if (!/^\d/.test(lines[1])) {
                        // It's an organization
                        organization = lines[1];
                        addressStartIndex = 2; // Address starts after organization
                    }

                    // Find index of phone number
                    const phoneIndex = lines.findIndex(line => /\d{3}-\d{3}-\d{4}/.test(line));

                    // Address is from line 2 (index 2) up to phoneIndex (exclusive)
                    const addressLines = lines.slice(addressStartIndex, phoneIndex);
                    const address = addressLines.join(', ');

                    // Phone
                    const phone = phoneIndex !== -1 ? lines[phoneIndex] : null;

                    // Extract email
                    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                    const email = emailMatch ? emailMatch[0] : null;

                    // Extract Accreditation Number
                    const accreditationMatch = text.match(/Accreditation Number:\s*(\d+)/);
                    const accreditationNumber = accreditationMatch ? accreditationMatch[1] : null;

                    // Extract POA Code
                    const poaCodeMatch = text.match(/POA Code:\s*([A-Z0-9]+)/);
                    const poaCode = poaCodeMatch ? poaCodeMatch[1] : null;  

                    const detailData = {
                        name: name,
                        organization: organization,
                        address: address,
                        email: email,
                        phone: phone,
                        accreditationNumber: accreditationNumber,
                        poaCode: poaCode,
                    };

                    return detailData;
                }

                // Return a default value if the content is not found
                return null;
            });

            // Add the detailData to the entry object
            entry.detailData = detailData;

            // add delay between 1 to 3 seconds
            const delay = Math.floor(Math.random() * 2000) + 1000;
            await sleep(delay);

            // After scraping, go back to the search page
            await page.goBack({ waitUntil: 'load' });

            // Wait for the table to load on the new page
            await page.waitForSelector('table.aspbox');
        }

        console.log(`Finished processing data-${index+1} for: ${entry.pageData.name} with link ${entry.link || ''}`);
    }

    return data
}

const run = async () => {
    const start = Date.now();
    
    try {
        const { browser, pages } = await spawnBrowser(null, 1);
        const page = pages[0];
        
        try {
            const data = await scrapedPageData(page);
            // console.log(`Scrapped Data ${JSON.stringify(data, null, 2)}`);
            console.log(`Scrapped Data Count : ${data.length}`);   
            
            // Flatten the data
            const flattenedData = data.map(item => ({
                'State': item.pageData?.state || '',
                'Full name': item.detailData?.name || '',
                'Organization': item.detailData?.organization || '',
                'Phone': item.detailData?.phone || '',
                'Email': item.detailData?.email || '',
                'City': item.pageData?.city || '',
                'Address': item.detailData?.address || '',
                'Zip Code': item.pageData?.zip || '',
                'Accreditation Number': item.detailData?.accreditationNumber || '',
                'Poa Code': item.detailData?.poaCode || ''
            }));
            
            // 1. Convert JSON array to a worksheet
            const worksheet = XLSX.utils.json_to_sheet(flattenedData);

            // 2. Create a new workbook and append the worksheet
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'ScrapedData');

            // 3. Write the workbook to a file
            XLSX.writeFile(workbook, 'scraped_data.xlsx');

            console.log('✅ Data saved to scraped_data.xlsx');
        } catch (error) {
            console.error(`Error in Browser scraping: ${error}`);
        } finally {
            // Close the pages and browser when done
            console.info(`Start Closing Browser`);
            for (const page of pages) {
                if (page != undefined) {
                    await page.close();
                }
            }
            
            if (browser != undefined) {
                await browser.close();
            }
                    
            console.info(`Finish Closing Browser`);
        }

    } finally {
        const end = Date.now();
        console.log(`Data extraction took ${end - start} ms`);
    }
    
};

run();
