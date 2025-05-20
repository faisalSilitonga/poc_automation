# POC for login and reachout

## Prerequisites

1. Install node >= v14.x. See this [link](https://nodejs.org/en/download/).
2. Checkout the project or extract the project (if you got the zip file)
3. Go to the project or extracted foler
4. Install dependencies by running `npm install`

## Login

Steps for login:

1. Ensure you have run the steps in the prerequisites
2. Run `node src/poc/login.js`
3. Wait until browser open, and can continue to submit login credential
4. After success login, on the LinkedIn `/feed` page, open inspect element, navigate to `Console`
5. On the Console, run `await saveCookies()` to save login cookies
6. Check on directory `src/poc/` if file `cookies.json` exist or not
7. Done login process if file `cookies.json` exist
8. For video documentation can access on [this link](https://drive.google.com/file/d/1QF9Uz46NRVrRGfVQX0adozIF5v61Lm1l/view?usp=sharing)

## Reachout

Steps for reachout:

1. Ensure you have run the steps in the prerequisites
2. Ensure that `cookies.json` file exist
3. Fill file `linkedin-url.txt` by list of linkedin-url to be reached out on the `linkedin` folder
4. After that, we can start to reachout by running command `node src/linkedin/reachout.js`
5. You can watch for log on terminal or can open browser console to watch what happened

## Mwlite 1st degree scraping

Steps:

1. Ensure you have run the steps in the prerequisites
2. Ensure that `cookies.json` file exist
3. You can override the default config in "Default Config" section in `mwlite-firstdegree.js`
4. If you want to override the config through cli you can run `node src/linkedin/mwlite-firstdegree.js -h` to list all available options

    Examples:

    - Run scraping with proxy address '45.145.57.222:17245', proxy user: 9qM5zp, proxy password: epET6U, and set minimum delay to 1000ms and max delay to 2000ms

        `node src/poc/mwlite-firstdegree.js -a '45.145.57.222:17245' -u 9qM5zp -p epET6U -m 1000 -x 2000`

    - Run scraping with default proxy and start from 3rd page

        `node src/poc/mwlite-firstdegree.js -i 3`

5. The result will be saved in `mwlite-firstdegree_<timestamp>.json` file in current directory
6. You can watch for log on terminal or can open browser console to watch what happened

## Mwlite profile scraping

Steps:

1. Ensure you have run the steps in the prerequisites
2. Ensure that `cookies.json` file exist
3. Make sure you have inserted the profile ids in `src/linkedin/linkedin-public-ids.txt`
4. You can override the default config in "Default Config" section in `mwlite-profile.js`
5. If you want to override the config through cli you can run `node src/linkedin/mwlite-profile.js -h` to list all available options

    Examples:

    - Run scraping with proxy address '45.145.57.222:17245', proxy user: 9qM5zp, proxy password: epET6U, and set minimum delay to 1000ms and max delay to 2000ms

        `node src/poc/mwlite-profile.js -a '45.145.57.222:17245' -u 9qM5zp -p epET6U -m 1000 -x 2000`

    - Run scraping with default proxy and start from 3rd line and max to 10 profiles

        `node src/poc/mwlite-profile.js -l 3 -t 10`

6. The result will be saved in `mwlite-profile_<public-id>.html` file in current directory
7. You can watch for log on terminal or can open browser console to watch what happened
