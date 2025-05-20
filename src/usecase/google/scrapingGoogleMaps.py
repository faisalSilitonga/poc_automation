import time
import csv
from playwright.sync_api import sync_playwright

# Function to spawn the browser and start Playwright
def spawn_browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)  # Launch headless browser
        page = browser.new_page()
        return browser, page

# Delay function to simulate wait times
def delay(min_ms, max_ms):
    delay_time = (min_ms + max_ms) / 2 / 1000  # Convert ms to seconds
    time.sleep(delay_time)

# Write scraped data to CSV
def write_data_to_csv(output_file_path, data):
    headers = ['Business Name', 'Category', 'Rate', 'Full Address', 'Phone Number', 'Website', 'Plus Code', 'Image', 'Map link']
    with open(output_file_path, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=headers)
        writer.writeheader()
        writer.writerows(data)

# Scrape Google Maps
def scrape_google_maps(keyword, location):
    query = f"{keyword} in near {location}"

    # Initialize browser and wait for elements to load
    browser, page = spawn_browser()
    
    # Locate search box and input the query
    page.goto('https://www.google.com/maps')
    page.fill('#searchboxinput', query)
    page.press('#searchboxinput', 'Enter')
    
    # Wait for results to load
    page.wait_for_selector(f'div[aria-label*="{query}"]')

    # Scrape the data
    data = []
    while True:
        children = page.query_selector_all(f'div[aria-label*="{query}"] > div')

        for child in children:
            loc_data = {}
            link_element = child.query_selector('a[href]')

            if link_element:
                delay(500, 1000)

                # Get aria-label and href attributes
                aria_label = link_element.get_attribute('aria-label')
                href = link_element.get_attribute('href')
                loc_data["name"] = aria_label
                loc_data["map_url"] = href

                # Get rating
                rate_el = child.query_selector('span[role="img"]')
                if rate_el:
                    loc_data["rate"] = rate_el.get_attribute('aria-label')

                # Click the link and wait for navigation
                link_element.click()
                page.wait_for_navigation()

                new_element = page.query_selector(f"[role='main'][aria-label='{aria_label}']")
                
                # Extract image, category, address, phone, plus code, website
                image_el = new_element.query_selector(f'button[aria-label*="{aria_label}"] > img')
                if image_el:
                    loc_data["image"] = image_el.get_attribute('src')

                category_el = new_element.query_selector('span > button[jsaction*="category"]')
                if category_el:
                    loc_data["category"] = category_el.inner_text()

                address_el = new_element.query_selector('button[data-item-id="address"]')
                if address_el:
                    loc_data["address"] = address_el.get_attribute('aria-label')

                phone_el = new_element.query_selector('button[data-item-id*="phone"]')
                if phone_el:
                    loc_data["phone_number"] = phone_el.get_attribute('aria-label')

                plus_code_el = new_element.query_selector('button[data-item-id="oloc"]')
                if plus_code_el:
                    loc_data["plus_code"] = plus_code_el.get_attribute('aria-label')

                web_el = new_element.query_selector('a[data-item-id="authority"]')
                if web_el:
                    loc_data["website"] = web_el.get_attribute('href')

                # Add locData to the data list
                data.append(loc_data)
                delay(500, 1000)

                # Go back to the previous page to load more results
                page.go_back()
                page.wait_for_selector('#searchboxinput')

                # Reselect children after navigating back to check if new elements have been loaded
                children = page.query_selector_all(f'div[aria-label*="{query}"] > div')

        if len(children) == 0:
            break

    # Close the browser after scraping is done
    browser.close()

    # Write the scraped data to a CSV file
    output_file_path = 'google_map_data.csv'
    write_data_to_csv(output_file_path, data)
    print("Scraping completed and data saved to google_map_data.csv")

# Example Usage
scrape_google_maps('Lapo', 'Cisauk')
