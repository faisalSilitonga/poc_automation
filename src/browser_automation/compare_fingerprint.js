const { connect } = require('puppeteer-real-browser');

const puppeteerExtra = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')
puppeteerExtra.use(pluginStealth())

const fs = require('fs');

// Function to collect browser fingerprint
async function collectFingerprint(page, name) {
  
  // Navigate to a blank page
  await page.goto('about:blank');
  
  // Inject fingerprint collection code
  const fingerprint = await page.evaluate(() => {
    // Collect various properties that make up a fingerprint
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      colorDepth: screen.colorDepth,
      screenResolution: {
        width: screen.width,
        height: screen.height
      },
      availableScreenResolution: {
        width: screen.availWidth,
        height: screen.availHeight
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      touchSupport: 'ontouchstart' in window,
      webdriver: navigator.webdriver,
      doNotTrack: navigator.doNotTrack,
      plugins: Array.from(navigator.plugins).map(p => ({
        name: p.name,
        description: p.description,
        filename: p.filename,
        length: p.length
      })),
      mimeTypes: Array.from(navigator.mimeTypes).map(m => ({
        type: m.type,
        description: m.description,
        suffixes: m.suffixes
      })),
      // Canvas fingerprinting
      canvas: (() => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 200;
          canvas.height = 50;
          
          // Text with different styles
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillStyle = '#f60';
          ctx.fillRect(0, 0, 100, 30);
          ctx.fillStyle = '#069';
          ctx.fillText('Fingerprint Test', 2, 15);
          ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
          ctx.fillText('Fingerprint Test', 4, 17);
          
          return canvas.toDataURL();
        } catch (e) {
          return 'Canvas error: ' + e.toString();
        }
      })(),
      // WebGL fingerprinting
      webgl: (() => {
        try {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          
          if (!gl) return 'WebGL not supported';
          
          return {
            vendor: gl.getParameter(gl.VENDOR),
            renderer: gl.getParameter(gl.RENDERER),
            version: gl.getParameter(gl.VERSION),
            shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            extensions: gl.getSupportedExtensions()
          };
        } catch (e) {
          return 'WebGL error: ' + e.toString();
        }
      })(),
      // Audio fingerprinting proxy
      audioFingerprint: 'Requires actual audio processing',
      // Font detection (simplified)
      fonts: (() => {
        const fontCheck = [
          'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Cambria', 
          'Comic Sans MS', 'Courier', 'Courier New', 'Georgia', 'Impact', 
          'Times', 'Times New Roman', 'Trebuchet MS', 'Verdana'
        ];
        
        const baseFonts = ['monospace', 'sans-serif', 'serif'];
        const testString = 'mmmmmmmmmmlli';
        const testSize = '72px';
        const h = document.getElementsByTagName('body')[0];
        
        const s = document.createElement('span');
        s.style.fontSize = testSize;
        s.innerHTML = testString;
        const defaultWidth = {};
        const defaultHeight = {};
        
        for (const index in baseFonts) {
          s.style.fontFamily = baseFonts[index];
          h.appendChild(s);
          defaultWidth[baseFonts[index]] = s.offsetWidth;
          defaultHeight[baseFonts[index]] = s.offsetHeight;
          h.removeChild(s);
        }
        
        const detected = [];
        for (const font of fontCheck) {
          let isDetected = false;
          for (const baseFont of baseFonts) {
            s.style.fontFamily = font + ',' + baseFont;
            h.appendChild(s);
            const match = (s.offsetWidth !== defaultWidth[baseFont] || s.offsetHeight !== defaultHeight[baseFont]);
            h.removeChild(s);
            isDetected = detected || match;
          }
          if (isDetected) detected.push(font);
        }
        return detected;
      })()
    };
  });
  
  // Additional network and header fingerprinting
  // Navigate to a fingerprinting service to get more data
  await page.goto('https://browserleaks.com/javascript', { waitUntil: 'networkidle2' });
//   await page.waitForTimeout(5000);
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Grab more fingerprint data
  const additionalData = await page.evaluate(() => {
    const results = {};
    try {
      // Extract whatever data is available on the page
      if (document.querySelector('#fingerprint-value')) {
        results.fingerprintHash = document.querySelector('#fingerprint-value').textContent.trim();
      }
      
      // Get any other metrics from the page
      const tableRows = document.querySelectorAll('table.table tr');
      tableRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const key = cells[0].textContent.trim().replace(/[^a-zA-Z0-9]/g, '');
          const value = cells[1].textContent.trim();
          if (key && value) results[key] = value;
        }
      });
    } catch (e) {
      results.error = e.toString();
    }
    return results;
  });
  
  // Combine all fingerprint data
  const completeFingerprint = { ...fingerprint, additionalData };
  
  // Save fingerprint to a file
  fs.writeFileSync(`${name}_fingerprint.json`, JSON.stringify(completeFingerprint, null, 2));
  console.log(`Saved fingerprint data for ${name}`);
  
  await page.close();
  return completeFingerprint;
}

// Function to compare two fingerprints and show differences
function compareFingerprints(fingerprint1, fingerprint2) {
  const differences = {};
  
  // Recursive function to find differences in nested objects
  function findDifferences(obj1, obj2, path = '') {
    if (obj1 === null || obj2 === null || typeof obj1 !== 'object' || typeof obj2 !== 'object') {
      if (obj1 !== obj2) {
        differences[path] = { 
          browser1: obj1, 
          browser2: obj2 
        };
      }
      return;
    }
    
    // Handle arrays
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      if (obj1.length !== obj2.length) {
        differences[path + '.length'] = { 
          browser1: obj1.length, 
          browser2: obj2.length 
        };
      }
      
      const maxLength = Math.max(obj1.length, obj2.length);
      for (let i = 0; i < maxLength; i++) {
        findDifferences(obj1[i], obj2[i], `${path}[${i}]`);
      }
      return;
    }
    
    // Handle objects
    const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    for (const key of keys) {
      const newPath = path ? `${path}.${key}` : key;
      
      if (!(key in obj1) || !(key in obj2)) {
        differences[newPath] = { 
          browser1: obj1[key], 
          browser2: obj2[key] 
        };
        continue;
      }
      
      findDifferences(obj1[key], obj2[key], newPath);
    }
  }
  
  findDifferences(fingerprint1, fingerprint2);
  return differences;
}

// Main function to run the comparison
async function compareBrowserFingerprints() {
  // Launch first browser with stealth plugin
  console.log('Launching first browser...');
  const pageBrowser1 = await launchPuppeteerRealBrowser()

  
  // Launch second browser with different settings
  console.log('Launching second browser...');
  const pageBrowser2 = await launchHeadlessPuppeteerRealBrowser()
  
  try {
    // Collect fingerprints
    console.log('Collecting fingerprints...');
    const fingerprint1 = await collectFingerprint(pageBrowser1, 'browser1');
    const fingerprint2 = await collectFingerprint(pageBrowser2, 'browser2');
    
    // Compare fingerprints
    console.log('Comparing fingerprints...');
    const differences = compareFingerprints(fingerprint1, fingerprint2);
    
    // Save and display results
    fs.writeFileSync('fingerprint_differences.json', JSON.stringify(differences, null, 2));
    console.log('Fingerprint comparison completed. Results saved to fingerprint_differences.json');
    
    // Display the number of differences
    console.log(`Found ${Object.keys(differences).length} differences between the browsers.`);
    
    // Show some key differences
    const keyDifferences = [
      'userAgent', 'plugins', 'canvas', 'webgl.renderer', 'additionalData.fingerprintHash'
    ];
    
    console.log('\nKey differences:');
    for (const key of keyDifferences) {
      if (differences[key]) {
        console.log(`\n${key}:`);
        console.log('  Browser 1:', differences[key].pageBrowser1);
        console.log('  Browser 2:', differences[key].pageBrowser2);
      }
    }
  } catch (error) {
    console.error('Error during fingerprint comparison:', error);
  } finally {
    // Close browsers
    await pageBrowser1.close();
    await pageBrowser2.close();
    console.log('Browsers closed.');
  }
}

async function launchPuppeteerRealBrowser() {
    const launchOpt = {
        args: [],
        headless: false,
        fingerprint: true,
        turnstile: true,
        tf: true,
    }

    const { page } = await connect(launchOpt);

    const defaultViewPort = {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false,
    }
    
    await page.setViewport(defaultViewPort)

    return page
}

async function launchHeadlessPuppeteerRealBrowser() {
    const launchOpt = {
        args: [],
        headless: "new",
        fingerprint: true,
        turnstile: true,
        tf: true,
    }

    const { page } = await connect(launchOpt);

    const defaultViewPort = {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false,
    }
    
    await page.setViewport(defaultViewPort)

    return page
}

async function launchPuppeteerStealhBrowser() {
    const launchOpt = {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list'
        ],
        headless: false,
        devtools: false,
        ignoreHTTPSErrors: true,
        dumpio: false,
    }

    const browser = await puppeteerExtra.launch(launchOpt)
    const [page] = await browser.pages()

    const defaultViewPort = {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false,
    }
    
    
            // desktop
    await page.setViewport(defaultViewPort)

    return page
}

// Run the comparison
compareBrowserFingerprints();