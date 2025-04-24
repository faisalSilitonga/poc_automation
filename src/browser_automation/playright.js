const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  
  // Launch the browser with headed mode (visible browser)
  const browser = await chromium.launch({
    headless: false, // Set to true if you want to run in headless mode
    args: [
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-site-isolation-trials'
    ]
  });

  // Create a new browser context with specific options
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    deviceScaleFactor: 1,
    hasTouch: false,
    ignoreHTTPSErrors: true,
    javaScriptEnabled: true,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    // Uncomment if you have proxies
    // proxy: {
    //   server: 'http://myproxy.com:3128',
    //   username: 'username',
    //   password: 'password'
    // }
  });

  try {
    // Create a new page
    const page = await context.newPage();

    // Set various headers to appear more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'sec-ch-ua': '"Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Upgrade-Insecure-Requests': '1',
      'Connection': 'keep-alive'
    });

    // Navigate to Google first (warm-up)
    console.log('Warming up the browser...');
    await page.goto('https://www.google.com');
    await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1000);

    // Add some random mouse movements and human-like behavior
    await page.mouse.move(150, 150);
    await page.waitForTimeout(300);
    await page.mouse.move(400, 200, { steps: 5 });
    await page.waitForTimeout(500);

    // Perform some scrolling to mimic human behavior
    await page.evaluate(() => {
      window.scrollBy(0, 300);
    });
    await page.waitForTimeout(800);

    // Now navigate to the target site
    console.log('Navigating to DexScreener...');
    const response = await page.goto('https://dexscreener.com/', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    console.log(`Status: ${response.status()}`);

    // Wait to see if there's a Cloudflare challenge
    const checkForCloudflare = async () => {
      const cloudflareDetected = await page.evaluate(() => {
        return document.body.textContent.includes('Checking your browser') || 
               document.body.textContent.includes('DDoS protection by Cloudflare') ||
               document.body.textContent.includes('Security check');
      });

      if (cloudflareDetected) {
        console.log('Cloudflare challenge detected, waiting for it to resolve...');
        // Wait longer for the challenge to process
        await page.waitForTimeout(10000);
        
        // Check again
        const stillOnCloudflare = await page.evaluate(() => {
          return document.body.textContent.includes('Checking your browser') || 
                 document.body.textContent.includes('DDoS protection by Cloudflare') ||
                 document.body.textContent.includes('Security check');
        });
        
        if (stillOnCloudflare) {
          console.log('Still on Cloudflare challenge page. You may need to solve it manually.');
        } else {
          console.log('Successfully passed Cloudflare challenge!');
        }
      } else {
        console.log('No Cloudflare challenge detected!');
      }
    };

    await checkForCloudflare();

    // Take a screenshot to see what happened
    await page.screenshot({ path: 'dexscreener_playwright.png', fullPage: true });

    // Store cookies for future use (optional)
    const cookies = await context.cookies();
    require('fs').writeFileSync('cookies.json', JSON.stringify(cookies));
    console.log('Cookies saved.');

    // Interact with the page a bit to appear more human-like
    await page.evaluate(() => {
      window.scrollBy(0, 500);
    });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      window.scrollBy(0, 300);
    });
    await page.waitForTimeout(1000);

    // Take another screenshot to see any changes
    await page.screenshot({ path: 'dexscreener_after_scroll.png', fullPage: true });
    console.log('Screenshots saved.');

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    // Close the browser
    await browser.close();
    console.log('Browser closed.');
  }
})();