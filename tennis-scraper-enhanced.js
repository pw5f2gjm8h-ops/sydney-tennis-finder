// Enhanced Tennis Court Scraper - Region Filtering + Calendar Navigation + New Venues
// Features: Region-based filtering, calendar date selection, Trumper Park, Centennial Parklands
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

// Configuration - OPTIMIZED FOR RAILWAY PRO (8GB RAM)
const MAX_CONCURRENCY = 8; // Perfect for Railway Pro!
const PAGE_TIMEOUT = 60000; // 60 seconds
const NAVIGATION_TIMEOUT = 60000;
const POST_NAV_WAIT = 2000;

// FUNCTION TO LOAD REGIONS FROM CSV
function loadRegionsFromCSV() {
  try {
    // Try to read the CSV file
    const csvPath = path.join(__dirname, 'sydneypostcodes.csv');
    console.log('📂 Loading regions from CSV:', csvPath);
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const regions = {};
    const lines = csvContent.split('\n');
    
    // Skip header row (line 0)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      // Parse CSV properly handling quoted fields with commas
      // Example: 2000,"Sydney, Haymarket, The Rocks",Sydney City
      const parts = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current.trim()); // Add last field
      
      if (parts.length >= 3) {
        const postcode = parts[0];
        const region = parts[2]; // Column 3 is the region
        
        if (postcode && region && region !== '(PO Boxes)') {
          regions[postcode] = region;
        }
      }
    }
    
    const uniqueRegions = [...new Set(Object.values(regions))];
    console.log(`✅ Loaded ${Object.keys(regions).length} postcodes mapping to ${uniqueRegions.length} regions`);
    console.log(`📍 Regions: ${uniqueRegions.join(', ')}`);
    
    return regions;
    
  } catch (error) {
    console.warn('⚠️ Could not load CSV file, using fallback defaults');
    console.warn('   Error:', error.message);
    console.warn('   Make sure sydneypostcodes.csv is in the same directory as this script');
    
    // FALLBACK: Use hardcoded defaults if CSV fails
    return {
      '2034': 'Eastern Suburbs',
      '2032': 'Eastern Suburbs',
      '2031': 'Eastern Suburbs',
      '2021': 'Eastern Suburbs',
      '2022': 'Eastern Suburbs',
      '2010': 'Inner City',
      '2037': 'Inner West',
      '2015': 'Inner South',
      '2018': 'Inner South',
      '2026': 'Eastern Suburbs',
      '2030': 'Eastern Suburbs',
      '2025': 'Eastern Suburbs',
      '2033': 'Eastern Suburbs',
      '2035': 'Eastern Suburbs',
    };
  }
}

// POSTCODE TO REGION MAPPING - Loaded from CSV at startup
const POSTCODE_REGIONS = loadRegionsFromCSV();

const CLUBS = {
  coogeeBeach: {
    name: 'Coogee Beach Tennis',
    url: 'https://www.tennisvenues.com.au/booking/eastern-suburbs-tennis-club',
    address: 'Cnr Bream & Brook St, Coogee NSW 2034',
    postcode: '2034',
    phone: '(02) 9665 7360',
    type: 'tennisvenues',
    courts: 5,
    surface: 'Synthetic Grass'
  },
  lathamPark: {
    name: 'Latham Park Tennis Centre',
    url: 'https://www.tennisvenues.com.au/booking/latham-park-tc',
    address: '3 Henning Ave, South Coogee NSW 2034',
    postcode: '2034',
    phone: '(02) 9344 3350',
    type: 'tennisvenues',
    courts: 6,
    surface: 'Synthetic Grass/Hard'
  },
  eastsideTennis: {
    name: 'Eastside Tennis Centre',
    url: 'https://www.tennisvenues.com.au/booking/eastside-tennis-centre?mobileViewDisabled=true',
    address: '1 Court Ave, Kingsford NSW 2032',
    postcode: '2032',
    phone: '0493 496 426',
    type: 'tennisvenues',
    courts: 8,
    surface: 'Synthetic/Hard/Clay'
  },
  snapePark: {
    name: 'Snape Park Tennis Club',
    url: 'https://www.tennisvenues.com.au/booking/snape-park-tc',
    address: '15 Snape Street, Maroubra NSW 2035',
    postcode: '2035',
    phone: '(02) 9344 3424',
    type: 'tennisvenues',
    courts: 6,
    surface: 'Synthetic Grass/Hard'
  },
  cooperPark: {
    name: 'Cooper Park Tennis Club',
    url: 'https://www.tennisvenues.com.au/booking/cooper-park-tc',
    address: '1 Bunna Place (off Suttie Road), Woollahra NSW 2025',
    postcode: '2025',
    phone: '(02) 9389 3100',
    type: 'tennisvenues',
    courts: 8,
    surface: 'Synthetic Grass'
  },
  jensensPaddington: {
    name: "Prince Alfred Park",
    url: 'https://jensenstennis.intrac.com.au/tennis/book.cfm?facility=1',
    address: 'Chalmers Street, Prince Alfred Park, Surry Hills NSW 2010',
    postcode: '2010',
    phone: '(02) 9331 3114',
    type: 'intrac',
    courts: 4,
    surface: 'Synthetic Grass'
  },
  jensensCentennial: {
    name: "Alexandria",
    url: 'https://jensenstennis.intrac.com.au/tennis/book.cfm?facility=2',
    address: 'Park Road, Alexandria Park, Alexandria NSW 2015',
    postcode: '2015',
    phone: '(02) 9331 3114',
    type: 'intrac',
    courts: 6,
    surface: 'Synthetic Grass'
  },
  jensensCoogee: {
    name: "Beaconsfield",
    url: 'https://jensenstennis.intrac.com.au/tennis/book.cfm?facility=3',
    address: 'William Street, Beaconsfield Park, Beaconsfield NSW 2015',
    postcode: '2015',
    phone: '(02) 9331 3114',
    type: 'intrac',
    courts: 4,
    surface: 'Synthetic Grass'
  },
  jensensRandwick: {
    name: "Glebe",
    url: 'https://jensenstennis.intrac.com.au/tennis/book.cfm?facility=4',
    address: 'John Street, St James Park, Glebe NSW 2037',
    postcode: '2037',
    phone: '(02) 9331 3114',
    type: 'intrac',
    courts: 4,
    surface: 'Synthetic Grass'
  },
  jensensClovelly: {
    name: "Rosebery",
    url: 'https://jensenstennis.intrac.com.au/tennis/book.cfm?location=6&court=283',
    address: 'Corner of Rothschild Avenue and Hayes Road, Turruwul Park, Rosebery NSW 2018',
    postcode: '2018',
    phone: '(02) 9331 3114',
    type: 'intrac',
    courts: 4,
    surface: 'Synthetic Grass'
  },
  trumperPark: {
    name: "Trumper Park",
    url: 'https://wentworthtennis.intrac.com.au/tennis/book.cfm',
    address: 'Trumper Park, Quarry St, Paddington NSW 2021',
    postcode: '2021',
    phone: '(02) 9363 4955',
    type: 'intrac',
    courts: 8,
    surface: 'Hard Court'
  },
  centennialParklands: {
    name: "Centennial Parklands",
    url: 'https://parklands.intrac.com.au/sports/schedule.cfm?location=55',
    address: 'Centennial Park, Grand Dr, Centennial Park NSW 2021',
    postcode: '2021',
    phone: '(02) 9662 7033',
    type: 'intrac-sports',
    courts: 11,
    surface: 'Hard Court',
    location: 'Centennial Parklands'
  },
  moorePark: {
    name: "Moore Park Courts",
    url: 'https://parklands.intrac.com.au/sports/schedule.cfm?location=72',
    address: 'Moore Park, Anzac Parade, Moore Park NSW 2021',
    postcode: '2021',
    phone: '(02) 9662 7033',
    type: 'intrac-sports',
    courts: 4,
    surface: 'Hard Court',
    location: 'Moore Park Courts'
  },
  sydneyBoysHigh: {
    name: "Sydney Boys High School",
    url: 'https://www.tennisvenues.com.au/booking/sydney-boys-high-school',
    address: '556 Cleveland St, Moore Park NSW 2021',
    postcode: '2021',
    phone: '0416 007 810',
    type: 'tennisvenues',
    courts: 6,
    surface: 'Hard Court'
  }
};

function filterFutureSlots(slots, searchDate) {
  const now = new Date();
  const searchDateOnly = new Date(searchDate);
  searchDateOnly.setHours(0, 0, 0, 0);
  
  const todayOnly = new Date();
  todayOnly.setHours(0, 0, 0, 0);
  
  if (searchDateOnly.getTime() === todayOnly.getTime()) {
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    return slots.filter(slot => {
      const [hour, minute] = slot.time.split(':').map(Number);
      if (hour > currentHour) return true;
      if (hour === currentHour && minute > currentMinute) return true;
      return false;
    });
  }
  
  return slots;
}

async function createStealthBrowser() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage', // CRITICAL for Railway!
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--window-size=1280,720', // Smaller window = less memory
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      // CRITICAL Railway flags to prevent "Resource unavailable"
      '--single-process', // Run everything in one process
      '--disable-software-rasterizer',
      '--disable-gpu-sandbox',
      '--disable-images', // Don't load images
      '--disable-css', // Don't load CSS (we don't need it for scraping)
      '--disable-javascript-harmony-shipping',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-default-browser-check',
      '--no-pings',
      '--disable-breakpad', // No crash reporting
      '--disable-component-update',
      '--disable-domain-reliability',
      '--disable-features=AudioServiceOutOfProcess',
      '--disable-print-preview',
      '--disable-speech-api',
      '--disable-file-system',
      '--disable-permissions-api',
      '--disable-presentation-api',
      '--disable-remote-fonts',
      '--disable-shared-workers',
      '--js-flags="--max-old-space-size=1024"' // 1GB for JS (Railway Pro has plenty of RAM)
    ],
    // Force Chrome to use less memory
    protocolTimeout: 120000
  });
  
  return browser;
}

async function setupStealthPage(browser) {
  const page = await browser.newPage();
  
  await page.setViewport({ 
    width: 1920, 
    height: 1080,
    deviceScaleFactor: 1
  });
  
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  
  const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
  await page.setUserAgent(randomUA);
  
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false
    });
    window.chrome = { runtime: {} };
  });
  
  page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
  page.setDefaultTimeout(PAGE_TIMEOUT);
  
  return page;
}

async function humanDelay(min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * NEW: Calendar-based date navigation for TennisVenues
 * Clicks directly on the calendar date instead of using "Next Day" button
 */
async function navigateToDateViaCalendar(page, targetDate) {
  console.log(`  📅 Using calendar navigation to ${targetDate.toDateString()}...`);
  
  try {
    await humanDelay(2000, 3000);
    
    // Wait for calendar to be visible
    console.log(`  ⏳ Waiting for calendar to load...`);
    await page.waitForSelector('.ui-datepicker, .calendar, [class*="calendar"], [class*="datepicker"]', {
      timeout: 5000,
      visible: true
    }).catch(() => {
      console.log(`  ⚠️ Calendar selector not found, continuing anyway...`);
    });
    
    await humanDelay(1000, 1500);
    
    const targetDay = targetDate.getDate();
    const targetMonth = targetDate.getMonth(); // 0-indexed
    const targetYear = targetDate.getFullYear();
    
    // First, check if we need to navigate to the correct month
    const monthNavigated = await page.evaluate((targetMonth, targetYear) => {
      // Month names for matching
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'];
      
      // Check current month display
      const monthDisplay = document.querySelector(
        '.ui-datepicker-title, ' +
        '.datepicker-title, ' +
        '[class*="calendar"] h2, ' +
        '[class*="month-year"]'
      );
      
      if (monthDisplay) {
        const displayText = monthDisplay.textContent.trim();
        console.log(`Current calendar display: "${displayText}"`);
        
        // Parse current month and year from display
        const currentMonthName = monthNames.find(name => displayText.includes(name));
        const currentMonthIndex = currentMonthName ? monthNames.indexOf(currentMonthName) : -1;
        
        // Extract year from display
        const yearMatch = displayText.match(/\d{4}/);
        const currentYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
        
        console.log(`Current: ${monthNames[currentMonthIndex]} ${currentYear} (month index: ${currentMonthIndex})`);
        console.log(`Target: ${monthNames[targetMonth]} ${targetYear} (month index: ${targetMonth})`);
        
        // Calculate months difference
        let monthsDiff = (targetYear - currentYear) * 12 + (targetMonth - currentMonthIndex);
        console.log(`Months to navigate: ${monthsDiff}`);
        
        // Click next/prev month buttons if needed
        if (monthsDiff > 0) {
          // Need to go forward
          const nextButton = document.querySelector(
            '.ui-datepicker-next, ' +
            '[class*="next"], ' +
            '[class*="calendar"] button:last-child, ' +
            'button[aria-label*="next" i]'
          );
          
          if (nextButton) {
            for (let i = 0; i < Math.min(monthsDiff, 3); i++) {
              console.log(`Clicking next month button (${i + 1}/${monthsDiff})`);
              nextButton.click();
              // Small delay between clicks
              const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
              delay(500);
            }
            return true;
          }
        } else if (monthsDiff < 0) {
          // Need to go backward
          const prevButton = document.querySelector(
            '.ui-datepicker-prev, ' +
            '[class*="prev"], ' +
            '[class*="calendar"] button:first-child, ' +
            'button[aria-label*="prev" i]'
          );
          
          if (prevButton) {
            for (let i = 0; i < Math.min(Math.abs(monthsDiff), 3); i++) {
              console.log(`Clicking previous month button (${i + 1}/${Math.abs(monthsDiff)})`);
              prevButton.click();
            }
            return true;
          }
        }
      }
      
      return true;
    }, targetMonth, targetYear);
    
    // Wait for month navigation to complete
    await humanDelay(1500, 2000);
    
    // Debug: Log current page state
    await page.evaluate(() => {
      console.log(`=== CALENDAR DEBUG INFO ===`);
      console.log(`Current URL: ${window.location.href}`);
      console.log(`Page title: ${document.title}`);
      
      // Check for various calendar elements
      const calendarElements = document.querySelectorAll('.ui-datepicker, .calendar, [class*="calendar"], [class*="datepicker"]');
      console.log(`Calendar elements found: ${calendarElements.length}`);
      
      // Check for date links
      const dateLinks = document.querySelectorAll('a[href*="date="], a[href*="day="]');
      console.log(`Date links found: ${dateLinks.length}`);
      if (dateLinks.length > 0) {
        console.log(`Sample date link hrefs:`);
        Array.from(dateLinks).slice(0, 5).forEach(link => {
          console.log(`  - "${link.textContent.trim()}": ${link.getAttribute('href')}`);
        });
      }
      
      // Check for table cells
      const tableCells = document.querySelectorAll('table td');
      console.log(`Table cells found: ${tableCells.length}`);
      
      console.log(`=== END DEBUG INFO ===`);
    });
    
    // Now click on the specific date in the calendar
    const dateClicked = await page.evaluate((day, month, year) => {
      console.log(`Looking for date: ${day} (month: ${month}, year: ${year})`);
      
      // Strategy 0: Direct link search - TennisVenues often has date links in href
      // Look for links that contain the date in YYYY-MM-DD or DD/MM/YYYY format
      const dateStr1 = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateStr2 = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
      const dateStr3 = `date=${dateStr1}`;
      
      console.log(`Looking for date strings: ${dateStr1}, ${dateStr2}, ${dateStr3}`);
      
      const allLinks = Array.from(document.querySelectorAll('a[href*="date="], a[href*="day="], .calendar a, .datepicker a'));
      console.log(`Found ${allLinks.length} potential date links`);
      
      for (const link of allLinks) {
        const href = link.getAttribute('href') || '';
        const text = link.textContent.trim();
        
        // Check if link contains our date or if text is our day number
        if ((href.includes(dateStr1) || href.includes(dateStr2) || text === String(day)) && 
            link.offsetParent !== null) {
          console.log(`Found date link: text="${text}", href="${href}"`);
          link.click();
          return { success: true, method: 'direct-date-link', day: day, href: href };
        }
      }
      
      // Strategy 1: SportLogic/TennisVenues calendars
      // These use table-based calendars with clickable cells
      const calendarCells = document.querySelectorAll(
        'table.ui-datepicker-calendar td, ' +
        '.calendar table td, ' +
        '[class*="calendar"] table td, ' +
        '[class*="datepicker"] td, ' +
        'table td[data-handler="selectDay"], ' +
        '.ui-datepicker td'
      );
      
      console.log(`Found ${calendarCells.length} calendar table cells`);
      
      for (const cell of calendarCells) {
        const cellText = cell.textContent.trim();
        
        // Check if this cell contains our target day
        if (cellText === String(day)) {
          // Check if cell is clickable (not disabled/unavailable)
          const link = cell.querySelector('a');
          const isDisabled = cell.classList.contains('ui-state-disabled') ||
                           cell.classList.contains('disabled') ||
                           cell.classList.contains('unavailable') ||
                           cell.classList.contains('ui-datepicker-other-month') ||
                           cell.hasAttribute('data-other-month') ||
                           cell.getAttribute('aria-disabled') === 'true';
          
          if (!isDisabled && cell.offsetParent !== null) {
            console.log(`Found clickable date cell: ${cellText}`);
            
            // Try clicking the link inside if it exists
            if (link && link.offsetParent !== null) {
              console.log(`Clicking link inside date cell, href: ${link.getAttribute('href')}`);
              link.click();
              return { success: true, method: 'calendar-link', day: day };
            } else {
              console.log(`Clicking date cell directly`);
              cell.click();
              return { success: true, method: 'calendar-cell', day: day };
            }
          }
        }
      }
      
      // Strategy 2: General calendar day buttons/cells
      const allDayCells = Array.from(document.querySelectorAll(
        'td:not([class*="other-month"]):not(.disabled), ' +
        'button[class*="day"]:not([disabled]), ' +
        'div[role="gridcell"], ' +
        '.calendar-day:not(.disabled), ' +
        '[data-date]'
      ));
      
      console.log(`Found ${allDayCells.length} general day cells`);
      
      for (const cell of allDayCells) {
        const text = cell.textContent.trim();
        
        // Check if it's our target day
        if (text === String(day)) {
          // Check for clickability
          const isClickable = cell.tagName === 'BUTTON' || 
                             cell.tagName === 'A' || 
                             cell.onclick || 
                             cell.getAttribute('data-date') ||
                             cell.querySelector('a') ||
                             !cell.classList.contains('disabled');
          
          if (isClickable && cell.offsetParent !== null) {
            console.log(`Clicking day cell: ${text}`);
            
            // If there's a link inside, click that
            const link = cell.querySelector('a');
            if (link) {
              link.click();
              return { success: true, method: 'cell-link', day: day };
            } else {
              cell.click();
              return { success: true, method: 'cell-click', day: day };
            }
          }
        }
      }
      
      // Strategy 3: Look for data-date attributes with full date
      // Note: dateStr1 and dateStr2 are already declared in Strategy 0
      const dateEl = document.querySelector(`[data-date="${dateStr1}"]`) ||
                     document.querySelector(`[data-date="${dateStr2}"]`) ||
                     document.querySelector(`[data-day="${day}"]`);
      
      if (dateEl && dateEl.offsetParent !== null) {
        console.log(`Found element with data-date attribute`);
        dateEl.click();
        return { success: true, method: 'data-attribute', date: dateStr1 };
      }
      
      console.log(`Could not find clickable date ${day}`);
      return { success: false };
    }, targetDay, targetMonth, targetYear);
    
    if (dateClicked.success) {
      await humanDelay(POST_NAV_WAIT, POST_NAV_WAIT + 1000);
      console.log(`  ✅ Clicked on date ${targetDay} via ${dateClicked.method}`);
      return true;
    } else {
      console.log(`  ⚠️ Could not find calendar date ${targetDay}, falling back to next-day navigation`);
      return false;
    }
    
  } catch (error) {
    console.log(`  ⚠️ Calendar navigation failed: ${error.message}, falling back`);
    return false;
  }
}

/**
 * Fallback: Sequential "Next Day" navigation for TennisVenues
 */
async function navigateToDateTennisVenuesNextDay(page, targetDate, currentDate) {
  const daysDiff = Math.floor((targetDate - currentDate) / (1000 * 60 * 60 * 24));
  
  if (daysDiff <= 0) {
    console.log(`  📅 Already on target date`);
    return true;
  }
  
  console.log(`  📅 Navigating ${daysDiff} days forward to ${targetDate.toDateString()}...`);
  
  for (let i = 0; i < daysDiff; i++) {
    await humanDelay(1200, 1800);
    
    const clicked = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, span, div'));
      for (const el of allElements) {
        const text = el.textContent.trim();
        if (text.match(/Next\s*Day\s*[>›]?/i) || text === 'Next Day' || text === '>') {
          const clickable = el.tagName === 'A' || el.tagName === 'BUTTON' ? el : el.closest('a, button');
          if (clickable) {
            clickable.click();
            return { success: true, method: 'text-match', text: text };
          }
        }
      }
      
      const selectors = [
        'a[title*="next" i]',
        'button[title*="next" i]',
        'a[aria-label*="next" i]',
        'button[aria-label*="next" i]',
        '[data-action*="next" i]',
        '.next-day', '.nextDay', '.fc-next-button'
      ];
      
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.offsetParent !== null) {
          el.click();
          return { success: true, method: 'selector', selector: selector };
        }
      }
      
      return { success: false };
    });
    
    if (clicked.success) {
      await humanDelay(POST_NAV_WAIT, POST_NAV_WAIT + 1000);
      console.log(`  ✓ Day ${i + 1}/${daysDiff} (${clicked.method})`);
    } else {
      console.log(`  ⚠️ Navigation button not found on day ${i + 1}`);
      return false;
    }
  }
  
  console.log(`  ✅ Navigated ${daysDiff} days forward`);
  return true;
}

async function navigateToDateIntrac(page, targetDate) {
  const targetDay = targetDate.getDate();
  const targetMonth = targetDate.getMonth();
  const targetYear = targetDate.getFullYear();
  
  console.log(`  📅 Navigating to ${targetDate.toDateString()} (day ${targetDay})...`);
  
  await humanDelay(2000, 3000);
  
  // Intrac systems have a calendar on the right side with clickable date links
  const clicked = await page.evaluate((day, month, year) => {
    console.log(`Looking for clickable day ${day} in Intrac calendar...`);
    
    // Strategy 1: Find ALL links on the page
    const allLinks = Array.from(document.querySelectorAll('a'));
    console.log(`Total links found: ${allLinks.length}`);
    
    let candidates = [];
    
    for (const link of allLinks) {
      const text = link.textContent.trim();
      const href = link.getAttribute('href') || '';
      
      // Check if link text is exactly the day number
      if (text === String(day)) {
        candidates.push({
          element: link,
          text: text,
          href: href,
          visible: link.offsetParent !== null,
          hasDateParam: href.includes('date=') || href.includes('day=')
        });
      }
    }
    
    console.log(`Found ${candidates.length} link(s) with text "${day}"`);
    
    // Try to click the best candidate
    for (const candidate of candidates) {
      console.log(`Candidate: text="${candidate.text}", href="${candidate.href}", visible=${candidate.visible}, hasDateParam=${candidate.hasDateParam}`);
      
      // Prefer links with date parameters in href AND visible
      if (candidate.visible && candidate.hasDateParam) {
        console.log(`✅ Clicking this link (has date param)`);
        candidate.element.click();
        return { success: true, date: `${day}/${month + 1}/${year}`, href: candidate.href };
      }
    }
    
    // If no link with date param, click any visible link with the day number
    for (const candidate of candidates) {
      if (candidate.visible) {
        console.log(`✅ Clicking this link (no date param but visible)`);
        candidate.element.click();
        return { success: true, date: `${day}/${month + 1}/${year}`, href: candidate.href };
      }
    }
    
    console.log(`❌ No clickable link found for day ${day}`);
    return { success: false };
  }, targetDay, targetMonth, targetYear);
  
  if (clicked.success) {
    await humanDelay(POST_NAV_WAIT, POST_NAV_WAIT + 1000);
    console.log(`  ✅ Clicked calendar link for day ${targetDay}`);
    console.log(`     Href was: ${clicked.href}`);
    return true;
  } else {
    console.log(`  ⚠️ Could not find clickable date ${targetDay}`);
    return false;
  }
}

async function scrapeTennisVenuesColorBased(page, club, date) {
  console.log(`  📡 Scraping ${club.name}...`);
  
  try {
    await page.goto(club.url, { 
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT
    });
    
    await humanDelay(2000, 3000); // Reduced from 3000-4000

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const searchDate = new Date(date);
    searchDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((searchDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 0) {
      // Try calendar navigation first
      const calendarSuccess = await navigateToDateViaCalendar(page, searchDate);
      
      // If calendar fails, fall back to next-day navigation
      if (!calendarSuccess) {
        await navigateToDateTennisVenuesNextDay(page, searchDate, today);
      }
    }

    await humanDelay(2000, 3000);

    const slots = await page.evaluate(() => {
      const availableSlots = [];
      const currentUrl = window.location.href; // Capture current page URL
      
      // TennisVenues uses tables - get court info from headers
      const tables = document.querySelectorAll('table');
      
      tables.forEach(table => {
        const headerRow = table.querySelector('thead tr, tr:first-child');
        const bodyRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
        
        // Extract court names from header
        const courtHeaders = [];
        if (headerRow) {
          Array.from(headerRow.cells).forEach((cell, index) => {
            const headerText = cell.textContent.trim();
            // Skip first column (usually time labels)
            if (index > 0 && headerText) {
              courtHeaders[index] = headerText;
            }
          });
        }
        
        // Process each row
        bodyRows.forEach(row => {
          Array.from(row.cells).forEach((cell, cellIndex) => {
            const style = window.getComputedStyle(cell);
            const bgColor = style.backgroundColor;
            const cellText = cell.textContent.trim();
            
            const isWhiteOrLight = 
              bgColor === 'rgb(255, 255, 255)' || 
              bgColor === 'white' ||
              bgColor === 'rgba(255, 255, 255, 1)' ||
              bgColor === '' ||
              bgColor === 'transparent' ||
              bgColor === 'rgba(0, 0, 0, 0)';
            
            const hasLink = cell.querySelector('a') !== null || cell.onclick !== null;
            
            if (isWhiteOrLight && hasLink && cellText) {
              const timeMatch = cellText.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
              if (timeMatch) {
                let hour = parseInt(timeMatch[1]);
                const minute = timeMatch[2];
                const period = timeMatch[3]?.toLowerCase();
                
                if (period === 'pm' && hour !== 12) {
                  hour += 12;
                } else if (period === 'am' && hour === 12) {
                  hour = 0;
                }
                
                // Get court name from header or construct from index
                let courtLabel = courtHeaders[cellIndex] || `Court ${cellIndex}`;
                
                // Clean up court label - remove surface type info
                // Examples: "Court 2 syn grass" → "Court 2", "Court 7 hard court" → "Court 7"
                courtLabel = courtLabel
                  .replace(/\s+(syn|synthetic)\s+(grass|clay|court)/gi, '')
                  .replace(/\s+hard\s+court/gi, '')
                  .replace(/\s+grass\s+court/gi, '')
                  .replace(/\s+clay\s+court/gi, '')
                  .trim();
                
                // Filter out invalid court labels
                // Skip if label is too long (probably captured CSS or other text)
                if (courtLabel.length > 50) {
                  return; // Skip this slot
                }
                
                // Skip if label contains CSS-like text
                if (courtLabel.includes('{') || courtLabel.includes('}') || 
                    courtLabel.includes('table.') || courtLabel.includes('width:') ||
                    courtLabel.includes('border-') || courtLabel.includes('padding:')) {
                  return; // Skip this slot
                }
                
                // If header contains "Court X", use it as is
                // Otherwise, if it's just a number or letter, prefix with "Court"
                if (!courtLabel.toLowerCase().includes('court')) {
                  courtLabel = `Court ${courtLabel}`;
                }
                
                // Only add if cellIndex > 0 and not "Court 0"
                if (cellIndex > 0 && courtLabel !== 'Court 0') {
                  // Try to get booking URL from the cell's link
                  const cellLink = cell.querySelector('a');
                  const bookingUrl = cellLink ? cellLink.getAttribute('href') : null;
                  
                  availableSlots.push({
                    time: `${hour.toString().padStart(2, '0')}:${minute}`,
                    timeDisplay: timeMatch[0],
                    court: courtLabel,
                    bookingUrl: bookingUrl ? (bookingUrl.startsWith('http') ? bookingUrl : window.location.origin + (bookingUrl.startsWith('/') ? bookingUrl : '/' + bookingUrl)) : null
                  });
                }
              }
            }
          });
        });
      });
      
      // Fallback: also check non-table cells (some venues might not use tables)
      const nonTableCells = document.querySelectorAll('div[class*="timeslot"], div[class*="court"], div[data-time]');
      
      nonTableCells.forEach(cell => {
        const style = window.getComputedStyle(cell);
        const bgColor = style.backgroundColor;
        const cellText = cell.textContent.trim();
        
        const isWhiteOrLight = 
          bgColor === 'rgb(255, 255, 255)' || 
          bgColor === 'white' ||
          bgColor === 'rgba(255, 255, 255, 1)' ||
          bgColor === '' ||
          bgColor === 'transparent';
        
        const hasLink = cell.querySelector('a') !== null || cell.onclick !== null;
        
        if (isWhiteOrLight && hasLink && cellText) {
          const timeMatch = cellText.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
          if (timeMatch) {
            let hour = parseInt(timeMatch[1]);
            const minute = timeMatch[2];
            const period = timeMatch[3]?.toLowerCase();
            
            if (period === 'pm' && hour !== 12) {
              hour += 12;
            } else if (period === 'am' && hour === 12) {
              hour = 0;
            }
            
            // Try to find court number from cell text or nearby elements
            const courtMatch = cellText.match(/Court\s*(\d+)/i);
            let courtLabel = courtMatch ? `Court ${courtMatch[1]}` : 'Court 1';
            
            // Check if court info is in a parent element
            const parentCourtMatch = cell.closest('[class*="court"]')?.textContent?.match(/Court\s*(\d+)/i);
            if (parentCourtMatch) {
              courtLabel = `Court ${parentCourtMatch[1]}`;
            }
            
            // Skip Court 0 and invalid courts
            if (courtLabel !== 'Court 0' && courtLabel.length < 50) {
              const cellLink = cell.querySelector('a');
              const bookingUrl = cellLink ? cellLink.getAttribute('href') : null;
              
              availableSlots.push({
                time: `${hour.toString().padStart(2, '0')}:${minute}`,
                timeDisplay: timeMatch[0],
                court: courtLabel,
                bookingUrl: bookingUrl ? (bookingUrl.startsWith('http') ? bookingUrl : window.location.origin + (bookingUrl.startsWith('/') ? bookingUrl : '/' + bookingUrl)) : null
              });
            }
          }
        }
      });
      
      return { availableSlots, currentUrl };
    });

    const filteredSlots = filterFutureSlots(slots.availableSlots, date);
    const uniqueSlots = Array.from(
      new Map(filteredSlots.map(slot => [`${slot.time}-${slot.court}`, slot])).values()
    );
    uniqueSlots.sort((a, b) => a.time.localeCompare(b.time));
    
    // Add currentUrl as fallback for slots without bookingUrl
    const currentPageUrl = slots.currentUrl;
    uniqueSlots.forEach(slot => {
      if (!slot.bookingUrl) {
        slot.bookingUrl = currentPageUrl;
      }
    });
    
    console.log(`  ✅ Found ${uniqueSlots.length} slots`);
    
    return uniqueSlots;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return [];
  }
}

async function scrapeIntracSportsSystem(page, club, date) {
  console.log(`  📡 Scraping ${club.name}...`);
  
  try {
    // For Intrac Sports systems, we can pass the date directly in the URL
    const searchDate = new Date(date);
    const dateStr = searchDate.toISOString().split('T')[0]; // Format: 2025-10-29
    
    // Modify URL to include date parameter
    let urlWithDate = club.url;
    if (urlWithDate.includes('?')) {
      urlWithDate += `&date=${dateStr}`;
    } else {
      urlWithDate += `?date=${dateStr}`;
    }
    
    console.log(`  📅 Loading ${searchDate.toDateString()}...`);
    console.log(`  🔗 URL: ${urlWithDate}`);
    
    await page.goto(urlWithDate, { 
      waitUntil: 'networkidle2',
      timeout: NAVIGATION_TIMEOUT
    });
    
    await humanDelay(4000, 5000);
    
    // Enable console logging from the page
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[DEBUG]')) {
        console.log(`  ${text}`);
      }
    });

    const slots = await page.evaluate((numCourts) => {
      const availableSlots = [];
      const allCells = document.querySelectorAll('td');
      
      console.log(`[DEBUG] Total cells found: ${allCells.length}`);
      console.log(`[DEBUG] Number of courts to check: ${numCourts}`);
      
      console.log(`[DEBUG] Starting SIMPLE sequential column analysis...`);
      console.log(`[DEBUG] Will check ${numCourts} columns after time column`);
      
      // SIMPLE APPROACH: Columns 1 through numCourts are the courts
      // Column 0 = Time, Columns 1-11 = Courts 1-11 (for Centennial)
      // Column 0 = Time, Columns 1-4 = Courts 1-4 (for Moore Park)
      
      const rows = document.querySelectorAll('tr');
      
      rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) return;
        
        // First cell (column 0) should have the time
        const timeCell = cells[0];
        const timeText = timeCell ? timeCell.textContent.trim() : '';
        
        // Check if this is a time label
        const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
        if (!timeMatch) {
          return; // Not a time row
        }
        
        let hour = parseInt(timeMatch[1]);
        const minute = timeMatch[2];
        const period = timeMatch[3]?.toLowerCase();
        
        if (period === 'pm' && hour !== 12) {
          hour += 12;
        } else if (period === 'am' && hour === 12) {
          hour = 0;
        }
        
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute}`;
        const timeDisplay = timeMatch[0];
        
        // Debug first few rows
        if (rowIndex <= 3) {
          console.log(`[DEBUG ROW ${rowIndex}] Time: ${timeDisplay}, Total cells: ${cells.length}`);
        }
        
        // Check columns 1 through numCourts (e.g., 1-11 for Centennial, 1-4 for Moore Park)
        for (let courtNum = 1; courtNum <= numCourts; courtNum++) {
          const columnIndex = courtNum; // Column 1 = Court 1, Column 2 = Court 2, etc.
          const courtCell = cells[columnIndex];
          
          if (!courtCell) {
            if (rowIndex <= 3) {
              console.log(`  Court ${courtNum}: MISSING (no cell at column ${columnIndex})`);
            }
            continue;
          }
          
          const cellText = courtCell.textContent.trim();
          if (cellText.length > 30) continue; // Skip cells with lots of text
          
          const style = window.getComputedStyle(courtCell);
          const computedBg = style.backgroundColor;
          
          let isOrange = false;
          let r = 0, g = 0, b = 0;
          
          if (computedBg) {
            const rgbMatch = computedBg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (rgbMatch) {
              r = parseInt(rgbMatch[1]);
              g = parseInt(rgbMatch[2]);
              b = parseInt(rgbMatch[3]);
              
              // Orange detection
              if (r > 220 && g >= 100 && g <= 170 && b < 50) {
                isOrange = true;
              }
              
              // Debug first few rows
              if (rowIndex <= 3) {
                console.log(`  Court ${courtNum}: R${r},G${g},B${b} isOrange=${isOrange}`);
              }
            } else {
              if (rowIndex <= 3) {
                console.log(`  Court ${courtNum}: NO RGB (${computedBg})`);
              }
            }
          } else {
            if (rowIndex <= 3) {
              console.log(`  Court ${courtNum}: no background`);
            }
          }
          
          // If not orange, it's available!
          if (!isOrange) {
            availableSlots.push({
              time: timeStr,
              timeDisplay: timeDisplay,
              court: `Court ${courtNum}`
            });
          }
        }
      });
      
      console.log(`[DEBUG] Total available slots found: ${availableSlots.length}`);
      return availableSlots;
    }, club.courts);

    const filteredSlots = filterFutureSlots(slots, date);
    const uniqueSlots = Array.from(
      new Map(filteredSlots.map(slot => [`${slot.time}-${slot.court}`, slot])).values()
    );
    uniqueSlots.sort((a, b) => a.time.localeCompare(b.time));
    
    console.log(`  ✅ Found ${uniqueSlots.length} slots`);
    
    return uniqueSlots;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return [];
  }
}

async function scrapeIntracBookingSystem(page, club, date) {
  console.log(`  📡 Scraping ${club.name}...`);
  
  try {
    // For Intrac systems, we can pass the date directly in the URL
    const searchDate = new Date(date);
    const dateStr = searchDate.toISOString().split('T')[0]; // Format: 2025-10-29
    
    // Modify URL to include date parameter
    let urlWithDate = club.url;
    if (urlWithDate.includes('?')) {
      urlWithDate += `&date=${dateStr}`;
    } else {
      urlWithDate += `?date=${dateStr}`;
    }
    
    console.log(`  📅 Loading ${searchDate.toDateString()}...`);
    console.log(`  🔗 URL: ${urlWithDate}`);
    
    await page.goto(urlWithDate, { 
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT
    });
    
    await humanDelay(3000, 4000);

    const slots = await page.evaluate(() => {
      const availableSlots = [];
      const allCells = document.querySelectorAll('td');
      
      allCells.forEach(cell => {
        const bgColor = cell.getAttribute('bgcolor') || '';
        const hasLink = cell.querySelector('a') !== null;
        const style = window.getComputedStyle(cell);
        const computedBg = style.backgroundColor;
        
        const isAvailable = hasLink && (
          bgColor.toLowerCase() === '#ffffff' || 
          bgColor.toLowerCase() === 'white' ||
          bgColor === '' ||
          computedBg === 'rgb(255, 255, 255)' ||
          computedBg === 'white' ||
          computedBg === 'rgba(255, 255, 255, 1)' ||
          computedBg === 'transparent' ||
          computedBg === 'rgba(0, 0, 0, 0)'
        );
        
        if (isAvailable) {
          const cellText = cell.textContent.trim();
          
          if (cellText) {
            const timeMatch = cellText.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
            if (timeMatch) {
              let hour = parseInt(timeMatch[1]);
              const minute = timeMatch[2];
              const period = timeMatch[3]?.toLowerCase();
              
              if (period === 'pm' && hour !== 12) {
                hour += 12;
              } else if (period === 'am' && hour === 12) {
                hour = 0;
              }
              
              const timeOnly = timeMatch[0];
              
              const row = cell.parentElement;
              const cellIndex = row ? Array.from(row.children).indexOf(cell) : 0;
              
              // Get court label from table header
              let courtLabel = `Court ${cellIndex}`;
              
              const table = cell.closest('table');
              if (table && cellIndex > 0) {
                const headerRow = table.querySelector('thead tr, tr:first-child');
                if (headerRow) {
                  const headerCell = headerRow.children[cellIndex];
                  if (headerCell) {
                    const headerText = headerCell.textContent.trim();
                    // Use header text if it's not a time
                    if (headerText && !headerText.match(/^\d{1,2}:\d{2}/)) {
                      courtLabel = headerText;
                      // Add "Court" prefix if not already present
                      if (!courtLabel.toLowerCase().includes('court')) {
                        courtLabel = `Court ${courtLabel}`;
                      }
                    }
                  }
                }
              }
              
              // Only add if cellIndex > 0 (skip time column)
              if (cellIndex > 0) {
                availableSlots.push({
                  time: `${hour.toString().padStart(2, '0')}:${minute}`,
                  timeDisplay: timeOnly,
                  court: courtLabel
                });
              }
            }
          }
        }
      });
      
      return availableSlots;
    });

    const filteredSlots = filterFutureSlots(slots, date);
    const uniqueSlots = Array.from(
      new Map(filteredSlots.map(slot => [`${slot.time}-${slot.court}`, slot])).values()
    );
    uniqueSlots.sort((a, b) => a.time.localeCompare(b.time));
    
    console.log(`  ✅ Found ${uniqueSlots.length} slots`);
    
    return uniqueSlots;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return [];
  }
}

/**
 * IMPROVED: Scraper for Trumper Park (Wentworth Tennis)
 * White/light cells are available and clickable
 * Uses mini calendar on the right side to select dates
 */
async function scrapeTrumperPark(page, club, date) {
  console.log(`  📡 Scraping ${club.name}...`);
  
  try {
    await page.goto(club.url, { 
      waitUntil: 'networkidle2',
      timeout: NAVIGATION_TIMEOUT
    });
    
    await humanDelay(5000, 6000);

    // Navigate to the correct date if needed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const searchDate = new Date(date);
    searchDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((searchDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 0) {
      console.log(`  📅 Attempting to click date ${searchDate.getDate()} in calendar...`);
      
      const targetDay = searchDate.getDate();
      
      await humanDelay(2000, 2500);
      
      // Take a more aggressive approach - find ANY link with the day number
      const dateClicked = await page.evaluate((day) => {
        console.log(`Searching for clickable date: ${day}`);
        
        // Find all anchor tags
        const allLinks = Array.from(document.querySelectorAll('a'));
        console.log(`Total links on page: ${allLinks.length}`);
        
        let candidatesFound = 0;
        
        for (const link of allLinks) {
          const text = link.textContent.trim();
          const href = link.getAttribute('href') || '';
          
          // Check if link text is exactly the day number
          if (text === String(day)) {
            candidatesFound++;
            console.log(`Candidate ${candidatesFound}:`);
            console.log(`  Text: "${text}"`);
            console.log(`  Href: ${href}`);
            console.log(`  Visible: ${link.offsetParent !== null}`);
            
            // Check if it's visible and likely a calendar date
            if (link.offsetParent !== null) {
              // Check if href contains date-related parameters or if it's in a calendar context
              const isDateLink = 
                href.includes('date=') || 
                href.includes('day=') ||
                href.closest('table') !== null ||
                link.className.toLowerCase().includes('date') ||
                link.className.toLowerCase().includes('calendar');
              
              console.log(`  Is date link: ${isDateLink}`);
              
              if (isDateLink || candidatesFound === 1) {
                // If it looks like a date link OR it's the first visible link with this number, click it
                console.log(`  ✅ CLICKING THIS LINK`);
                link.click();
                return { 
                  success: true, 
                  method: 'date-link', 
                  day: day,
                  href: href
                };
              }
            }
          }
        }
        
        console.log(`Total candidates found: ${candidatesFound}`);
        console.log(`No suitable link found to click`);
        return { success: false };
      }, targetDay);
      
      if (dateClicked.success) {
        await humanDelay(4000, 5000);
        console.log(`  ✅ Clicked on day ${targetDay} - waiting for page to update`);
      } else {
        console.log(`  ⚠️ Could not find clickable date ${targetDay} in calendar`);
      }
    }

    await humanDelay(3000, 4000);

    const slots = await page.evaluate(() => {
      const availableSlots = [];
      const allCells = document.querySelectorAll('td, div[class*="slot"], div[data-time]');
      
      allCells.forEach(cell => {
        const style = window.getComputedStyle(cell);
        const bgColor = style.backgroundColor;
        
        // White cells are available
        const isWhite = 
          bgColor === 'rgb(255, 255, 255)' || 
          bgColor === 'white' ||
          bgColor === 'rgba(255, 255, 255, 1)';
        
        // Must be clickable
        const isClickable = cell.querySelector('a') !== null || 
                           cell.onclick !== null ||
                           cell.tagName === 'A' ||
                           cell.tagName === 'BUTTON';
        
        if (isWhite && isClickable) {
          const cellText = cell.textContent.trim();
          
          const timeMatch = cellText.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
          if (timeMatch) {
            let hour = parseInt(timeMatch[1]);
            const minute = timeMatch[2];
            const period = timeMatch[3]?.toLowerCase();
            
            if (period === 'pm' && hour !== 12) {
              hour += 12;
            } else if (period === 'am' && hour === 12) {
              hour = 0;
            }
            
            // Try to extract court number
            let courtNumber = 'Unknown';
            const courtMatch = cellText.match(/Court\s*(\d+)/i);
            if (courtMatch) {
              courtNumber = courtMatch[1];
            } else {
              // Try to get from header or parent
              const header = cell.closest('table')?.querySelector('th');
              if (header) {
                const headerMatch = header.textContent.match(/Court\s*(\d+)/i);
                if (headerMatch) courtNumber = headerMatch[1];
              }
            }
            
            availableSlots.push({
              time: `${hour.toString().padStart(2, '0')}:${minute}`,
              timeDisplay: timeMatch[0],
              court: `Court ${courtNumber}`
            });
          }
        }
      });
      
      return availableSlots;
    });

    const filteredSlots = filterFutureSlots(slots, date);
    const uniqueSlots = Array.from(
      new Map(filteredSlots.map(slot => [`${slot.time}-${slot.court}`, slot])).values()
    );
    uniqueSlots.sort((a, b) => a.time.localeCompare(b.time));
    
    console.log(`  ✅ Found ${uniqueSlots.length} slots`);
    
    return uniqueSlots;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return [];
  }
}

/**
 * IMPROVED: Scraper for Centennial Parklands (Parklands Sports)
 * White/light cells are available and clickable
 * Filters by location name to separate Centennial Parklands from Moore Park Courts
 * Uses calendar navigation with arrow buttons
 */
async function scrapeParklandsSports(page, club, date) {
  console.log(`  📡 Scraping ${club.name} at ${club.location}...`);
  
  try {
    await page.goto(club.url, { 
      waitUntil: 'networkidle2',
      timeout: NAVIGATION_TIMEOUT
    });
    
    await humanDelay(5000, 6000);

    // Navigate to the correct date if needed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const searchDate = new Date(date);
    searchDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((searchDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 0) {
      console.log(`  📅 Looking for date ${searchDate.getDate()} or next arrow...`);
      
      const targetDay = searchDate.getDate();
      
      await humanDelay(2000, 2500);
      
      // Strategy 1: Try to find and click the date directly in calendar
      const dateClicked = await page.evaluate((day) => {
        console.log(`Searching for clickable date: ${day}`);
        
        // Find all clickable elements
        const allClickable = Array.from(document.querySelectorAll('a, button, [onclick]'));
        console.log(`Total clickable elements: ${allClickable.length}`);
        
        let candidates = [];
        
        for (const el of allClickable) {
          const text = el.textContent.trim();
          
          if (text === String(day)) {
            const visible = el.offsetParent !== null;
            const disabled = el.hasAttribute('disabled') || el.classList.contains('disabled');
            
            candidates.push({
              element: el,
              text: text,
              visible: visible,
              disabled: disabled,
              tag: el.tagName,
              href: el.getAttribute('href') || '',
              className: el.className
            });
          }
        }
        
        console.log(`Found ${candidates.length} candidates with text "${day}"`);
        
        // Try to click the best candidate
        for (const candidate of candidates) {
          console.log(`Checking candidate:`);
          console.log(`  Tag: ${candidate.tag}`);
          console.log(`  Visible: ${candidate.visible}`);
          console.log(`  Disabled: ${candidate.disabled}`);
          console.log(`  Class: ${candidate.className}`);
          
          if (candidate.visible && !candidate.disabled) {
            console.log(`  ✅ CLICKING THIS ELEMENT`);
            candidate.element.click();
            return { success: true, method: 'direct-click', day: day };
          }
        }
        
        return { success: false };
      }, targetDay);
      
      if (dateClicked.success) {
        await humanDelay(4000, 5000);
        console.log(`  ✅ Clicked on day ${targetDay}`);
      } else {
        // Strategy 2: Use arrow navigation
        console.log(`  ⚠️ Direct click failed, trying arrow navigation...`);
        
        for (let i = 0; i < daysDiff; i++) {
          await humanDelay(1500, 2000);
          
          const arrowClicked = await page.evaluate(() => {
            // Look for next/forward arrows
            const arrows = Array.from(document.querySelectorAll('a, button'));
            
            for (const arrow of arrows) {
              const text = arrow.textContent.trim();
              const ariaLabel = arrow.getAttribute('aria-label') || '';
              
              const isNextArrow = 
                text === '>' ||
                text === '→' ||
                text === '-->' ||
                text.toLowerCase().includes('next') ||
                ariaLabel.toLowerCase().includes('next') ||
                arrow.className.toLowerCase().includes('next');
              
              if (isNextArrow && arrow.offsetParent !== null) {
                arrow.click();
                return true;
              }
            }
            
            return false;
          });
          
          if (arrowClicked) {
            await humanDelay(3000, 3500);
            console.log(`  ✓ Arrow click ${i + 1}/${daysDiff}`);
          } else {
            console.log(`  ⚠️ Could not find next arrow on iteration ${i + 1}`);
            break;
          }
        }
      }
    }

    await humanDelay(3000, 4000);

    const slots = await page.evaluate((targetLocation) => {
      const availableSlots = [];
      const allCells = document.querySelectorAll('td, div[class*="slot"], div[data-time], div[class*="booking"]');
      
      allCells.forEach(cell => {
        // Check if this cell belongs to the target location
        const cellText = cell.textContent || '';
        const parentText = cell.parentElement?.textContent || '';
        const sectionText = cell.closest('section, div[class*="location"], div[class*="venue"]')?.textContent || '';
        
        const belongsToLocation = 
          cellText.includes(targetLocation) ||
          parentText.includes(targetLocation) ||
          sectionText.includes(targetLocation);
        
        // For the first pass, if location not explicitly mentioned, we'll check later
        const style = window.getComputedStyle(cell);
        const bgColor = style.backgroundColor;
        
        // White cells are available
        const isWhite = 
          bgColor === 'rgb(255, 255, 255)' || 
          bgColor === 'white' ||
          bgColor === 'rgba(255, 255, 255, 1)';
        
        // Must be clickable
        const isClickable = cell.querySelector('a') !== null || 
                           cell.onclick !== null ||
                           cell.tagName === 'A' ||
                           cell.tagName === 'BUTTON';
        
        if (isWhite && isClickable) {
          const timeMatch = cellText.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
          if (timeMatch) {
            let hour = parseInt(timeMatch[1]);
            const minute = timeMatch[2];
            const period = timeMatch[3]?.toLowerCase();
            
            if (period === 'pm' && hour !== 12) {
              hour += 12;
            } else if (period === 'am' && hour === 12) {
              hour = 0;
            }
            
            // Try to extract court number
            let courtNumber = 'Unknown';
            const courtMatch = cellText.match(/Court\s*(\d+)/i);
            if (courtMatch) {
              courtNumber = courtMatch[1];
            }
            
            // Try to determine which location this belongs to
            let location = '';
            if (cellText.includes('Centennial Parklands') || parentText.includes('Centennial Parklands')) {
              location = 'Centennial Parklands';
            } else if (cellText.includes('Moore Park') || parentText.includes('Moore Park')) {
              location = 'Moore Park Courts';
            }
            
            // Only add if it matches our target location or if location is ambiguous
            if (!location || location === targetLocation) {
              availableSlots.push({
                time: `${hour.toString().padStart(2, '0')}:${minute}`,
                timeDisplay: timeMatch[0],
                court: `Court ${courtNumber}`,
                location: location || targetLocation
              });
            }
          }
        }
      });
      
      return availableSlots;
    }, club.location);

    const filteredSlots = filterFutureSlots(slots, date);
    const uniqueSlots = Array.from(
      new Map(filteredSlots.map(slot => [`${slot.time}-${slot.court}`, slot])).values()
    );
    uniqueSlots.sort((a, b) => a.time.localeCompare(b.time));
    
    console.log(`  ✅ Found ${uniqueSlots.length} slots for ${club.location}`);
    
    return uniqueSlots;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return [];
  }
}

async function scrapeClub(clubKey, date = new Date()) {
  const club = CLUBS[clubKey];
  
  let browser;
  
  try {
    browser = await createStealthBrowser();
    const page = await setupStealthPage(browser);
    
    let slots = [];
    if (club.type === 'intrac') {
      slots = await scrapeIntracBookingSystem(page, club, date);
    } else if (club.type === 'intrac-sports') {
      slots = await scrapeIntracSportsSystem(page, club, date);
    } else if (club.type === 'tennisvenues') {
      slots = await scrapeTennisVenuesColorBased(page, club, date);
    }

    const screenshotDir = `screenshots`;
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir);
    }
    
    const screenshotPath = `${screenshotDir}/${clubKey}-${date.toISOString().split('T')[0]}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  📸 ${screenshotPath}`);

    return {
      club: club.name,
      address: club.address,
      postcode: club.postcode,
      region: POSTCODE_REGIONS[club.postcode] || 'Unknown',
      phone: club.phone,
      website: club.url,
      type: club.type, // Add type for frontend sorting
      date: date.toISOString().split('T')[0],
      totalCourts: club.courts,
      surface: club.surface,
      availableSlots: slots,
      scrapedAt: new Date().toISOString(),
      success: true
    };
  } catch (error) {
    console.error(`  ❌ ${error.message}`);
    return {
      club: club.name,
      address: club.address,
      postcode: club.postcode,
      region: POSTCODE_REGIONS[club.postcode] || 'Unknown',
      type: club.type, // Add type for frontend sorting
      date: date.toISOString().split('T')[0],
      availableSlots: [],
      error: error.message,
      success: false
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * NEW: Filter clubs by region
 */
function filterClubsByRegion(region) {
  let clubKeys;
  
  if (!region || region === 'All Regions') {
    clubKeys = Object.keys(CLUBS);
  } else {
    clubKeys = Object.keys(CLUBS).filter(clubKey => {
      const club = CLUBS[clubKey];
      const clubRegion = POSTCODE_REGIONS[club.postcode];
      return clubRegion === region;
    });
  }
  
  // Sort clubs by type: TennisVenues first (faster calendar nav + better booking URLs), then Intrac
  // This provides faster perceived performance and better booking experience
  return clubKeys.sort((a, b) => {
    const typeA = CLUBS[a].type;
    const typeB = CLUBS[b].type;
    
    // TennisVenues = 0, Intrac = 1, Intrac-sports = 2
    const priority = {
      'tennisvenues': 0,
      'intrac': 1,
      'intrac-sports': 2
    };
    
    const priorityA = priority[typeA] ?? 999;
    const priorityB = priority[typeB] ?? 999;
    
    return priorityA - priorityB;
  });
}

async function scrapeAllClubsBatched(date = new Date(), region = null) {
  console.log('\n' + '='.repeat(60));
  console.log('🕵️ ENHANCED STEALTH SCRAPER - REGION FILTERING');
  console.log('='.repeat(60));
  console.log(`📅 Date: ${date.toDateString()}`);
  console.log(`📍 Region: ${region || 'All Regions'}`);
  console.log(`⚡ Concurrency: ${MAX_CONCURRENCY} at a time`);
  console.log(`🕐 Started: ${new Date().toLocaleTimeString()}\n`);
  
  const startTime = Date.now();
  
  // Filter clubs by region
  const clubKeys = filterClubsByRegion(region);
  console.log(`🏢 Clubs to scrape: ${clubKeys.length}\n`);
  
  if (clubKeys.length === 0) {
    console.log('⚠️ No clubs found for the selected region\n');
    return [];
  }
  
  const results = [];
  
  for (let i = 0; i < clubKeys.length; i += MAX_CONCURRENCY) {
    const batch = clubKeys.slice(i, i + MAX_CONCURRENCY);
    console.log(`\n📦 Batch ${Math.floor(i / MAX_CONCURRENCY) + 1}: ${batch.map(k => CLUBS[k].name).join(', ')}\n`);
    
    const batchResults = await Promise.allSettled(
      batch.map(clubKey => scrapeClub(clubKey, date))
    );
    
    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const clubKey = batch[idx];
        const club = CLUBS[clubKey];
        results.push({
          club: club.name,
          address: club.address,
          postcode: club.postcode,
          region: POSTCODE_REGIONS[club.postcode] || 'Unknown',
          type: club.type, // Add type for frontend sorting
          date: date.toISOString().split('T')[0],
          availableSlots: [],
          error: result.reason?.message || 'Unknown error',
          success: false
        });
      }
    });
    
    if (i + MAX_CONCURRENCY < clubKeys.length) {
      await humanDelay(2000, 3000);
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const successCount = results.filter(r => r.success).length;
  const totalSlots = results.reduce((sum, r) => sum + (r.availableSlots?.length || 0), 0);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPLETE');
  console.log('='.repeat(60));
  console.log(`⏱️  Time: ${duration}s`);
  console.log(`✅ Success: ${successCount}/${clubKeys.length}`);
  console.log(`🎾 Total slots: ${totalSlots}\n`);
  
  const regionSuffix = region ? `-${region.replace(/\s+/g, '-')}` : '';
  const filename = `tennis-availability-${date.toISOString().split('T')[0]}${regionSuffix}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`💾 Saved: ${filename}\n`);
  
  return results;
}

if (require.main === module) {
  let searchDate = new Date();
  let region = null;
  
  if (process.argv[2]) {
    searchDate = new Date(process.argv[2]);
  } else {
    searchDate.setDate(searchDate.getDate() + 1);
  }
  
  if (process.argv[3]) {
    region = process.argv[3];
  }
  
  scrapeAllClubsBatched(searchDate, region)
    .then(() => {
      console.log('✨ Complete!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { scrapeClub, scrapeAllClubsBatched, CLUBS, filterClubsByRegion, POSTCODE_REGIONS };
