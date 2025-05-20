const { spawnBrowser, scrollPageElement, closeBrowser } = require('../lib/browser_management/puppeteer');
const { delay } = require('../lib/util/time');
const { writeDataToCSV } = require('../lib/file/csv');

async function scrapeGoogleMaps(keyword, location) {

    const query = `${keyword} in near ${location}`;

    // Initialising browser
    const { browser, page } = await spawnBrowser();

    await page.goto('https://www.google.com/maps');

    // Waiting for search input box show
    await page.waitForSelector('#searchboxinput');
    await page.type('#searchboxinput', `${query}`, { delay: 100 });

    // Trigger to press enter keyboard
    await page.keyboard.press('Enter');

    // Waiting for the result loaded
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    // Checking the result using css selector
    await page.waitForSelector(`div[aria-label*="${query}"]`);

    // Get the results without using page.evaluate()
    let directChildren = await page.$$(`div[aria-label*="${query}"] > div`); // Select all child divs

    const data = [];

    // Loop through each child and extract the required data
    for (let i = 0; i < directChildren.length; i++) {
        const child = directChildren[i];
        const locData = {};

        // Try to find the <a> tag inside the current child element
        const linkElement = await child.$('a[href]');

        if (linkElement) {
            // add delay between 0.5to 1 seconds
            await delay(500, 1000)

            await scrollPageElement(child, page);

            // Get the aria-label and href attributes
            const ariaLabel = await linkElement.evaluate(el => el.getAttribute('aria-label'));
            const href = await linkElement.evaluate(el => el.getAttribute('href'));

            const locDataName = ariaLabel.replace(/"/g, '\\"');

            locData["name"] = locDataName;
            locData["map_url"] = href;

            const rateEl = await child.$(`span [role="img"]`);
            if (rateEl) {
                // Extract the 'src' attribute from the <img> element inside the button
                locData["rate"] = await rateEl.evaluate(el => el.getAttribute('aria-label'));
            }

            // // Click the link and wait for navigation
            await linkElement.click();
            await page.waitForNavigation({waitUntil: 'domcontentloaded'});

            // Find the element using the same CSS selector
            const newElement = await page.$(`[role="main"][aria-label='${locDataName}']`);

            // If the element exists, you can extract its text or perform actions like clicking
            if (newElement) {
                // get image source
                const imageEl = await newElement.$(`button[aria-label*="${locDataName}"] > img`);
                if (imageEl) {
                    // Extract the 'src' attribute from the <img> element inside the button
                    locData["image"] = await imageEl.evaluate(el => el.getAttribute('src'));
                }

                // get category
                const categoryEl = await newElement.$(`span > button[jsaction*="category"]`);
                if (categoryEl) {
                    // Extract the 'src' attribute from the <img> element inside the button
                    locData["category"] = await categoryEl.evaluate(el => el.innerText);
                }

                // get address
                const addressEl = await newElement.$(`button[data-item-id="address"]`);
                if (addressEl) {
                    // Extract the 'src' attribute from the <img> element inside the button
                    locData["address"] = await addressEl.evaluate(el => el.getAttribute('aria-label'));
                }

                // get address
                const phoneEl = await newElement.$(`button[data-item-id*="phone"]`);
                if (phoneEl) {
                    // Extract the 'src' attribute from the <img> element inside the button
                    locData["phone_number"] = await phoneEl.evaluate(el => el.getAttribute('aria-label'));
                }

                // get address
                const plusCodeEL = await newElement.$(`button[data-item-id="oloc"]`);
                if (plusCodeEL) {
                    // Extract the 'src' attribute from the <img> element inside the button
                    locData["plus_code"] = await plusCodeEL.evaluate(el => el.getAttribute('aria-label'));
                }

                // get web
                const webEL = await newElement.$(`a[data-item-id="authority"]`);
                if (webEL) {
                    // Extract the 'src' attribute from the <img> element inside the button
                    locData["website"] = await webEL.evaluate(el => el.getAttribute('href'));
                }

            }

            data.push(locData);

            await delay(500, 1000);

            // After clicking, reselect the children to check if new elements have been loaded
            directChildren = await page.$$(`div[aria-label*="${query}"] > div`);
        }
    }

    console.log('Result:', data);

    await closeBrowser(browser);

    const outputFilePath = 'google_map_data.csv'; // The output CSV file

    // Flatten the data first
    const flattenedData = data.map(item => ({
        'Business Name': item.name || '',
        'Category': item.category || '',
        'Rate': item.rate || '',
        'Full Address': item.address || '',
        'Phone Number': item.phone_number || '',
        'Website': item.website || '',
        'Plus Code': item.plus_code || '',
        'Image': item.image || '',
        'Map link': item.map_url || ''
    }));

    try {
        await writeDataToCSV(outputFilePath, flattenedData); // Write data to output CSV
    } catch (err) {
        console.error('Error:', err);
    }
}

// Input dari user
const keyword = 'Lapo';
const location = 'Cisauk';

scrapeGoogleMaps(keyword, location);