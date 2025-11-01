const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public')); // Serve static files from public directory

// API endpoint to search for courts (POST)
app.post('/api/search', handleSearch);

// API endpoint to search for courts (GET) 
app.get('/api/search', (req, res) => {
  // Convert query params to body format
  req.body = {
    date: req.query.date,
    region: req.query.region
  };
  handleSearch(req, res);
});

// Shared search handler
function handleSearch(req, res) {
  const { date, region } = req.body;

  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  // Format date for the scraper (YYYY-MM-DD)
  let searchDate;
  try {
    // Handle various date formats
    const dateObj = new Date(date);
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      // Try parsing DD/MM/YYYY format
      const parts = date.split('/');
      if (parts.length === 3) {
        // Assume DD/MM/YYYY
        const [day, month, year] = parts;
        searchDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else {
        throw new Error('Invalid date format');
      }
    } else {
      searchDate = dateObj.toISOString().split('T')[0];
    }
    
    // Validate the result is YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(searchDate)) {
      throw new Error('Date format validation failed');
    }
    
    console.log(`Parsed date: ${date} -> ${searchDate}`);
  } catch (err) {
    console.error('Date parsing error:', err);
    return res.status(400).json({ 
      error: 'Invalid date format',
      details: 'Please use a valid date format (YYYY-MM-DD or DD/MM/YYYY)',
      received: date
    });
  }
  
  // Build command
  let command = `node tennis-scraper-enhanced.js ${searchDate}`;
  
  // Add region filter if specified (skip for 'all' or 'All Regions')
  if (region && region !== 'all' && region !== 'All Regions') {
    command += ` "${region}"`;
  }

  console.log(`Running: ${command}`);
  
  const scrapeStartTime = Date.now();

  // Execute the scraper
  exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    const scrapeDuration = ((Date.now() - scrapeStartTime) / 1000).toFixed(1);
    if (error) {
      console.error('Error executing scraper:', error);
      return res.status(500).json({ 
        error: 'Failed to search for courts',
        details: error.message 
      });
    }

    if (stderr) {
      console.error('Scraper stderr:', stderr);
    }

    console.log('Scraper output:', stdout);

    // Try to read the generated JSON file
    try {
      // Scraper creates files like: tennis-availability-2025-10-30-Eastern-Suburbs.json
      const regionSuffix = region && region !== 'All Regions' ? `-${region.replace(/\s+/g, '-')}` : '';
      const jsonFile = `tennis-availability-${searchDate}${regionSuffix}.json`;
      
      console.log(`Looking for file: ${jsonFile}`);
      
      if (fs.existsSync(jsonFile)) {
        const results = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        
        // Filter by region if specified
        let filteredResults = results;
        if (region && region !== 'All Regions') {
          filteredResults = results.filter(club => {
            // Use the region field from the club data
            return club.region === region;
          });
        }
        
        // Calculate stats
        const totalAvailableSlots = filteredResults.reduce((sum, club) => sum + club.availableSlots.length, 0);
        
        res.json({
          success: true,
          date: searchDate,
          region: region || 'all',
          clubs: filteredResults,
          totalClubs: filteredResults.length,
          totalAvailableSlots: totalAvailableSlots,
          scrapeDuration: `${scrapeDuration}s`
        });
      } else {
        // File doesn't exist, return stdout
        res.json({
          success: true,
          date: searchDate,
          region: region || 'all',
          clubs: [],
          totalClubs: 0,
          totalAvailableSlots: 0,
          scrapeDuration: `${scrapeDuration}s`,
          message: 'Search completed but no results file generated'
        });
      }
    } catch (parseError) {
      console.error('Error reading results:', parseError);
      res.json({
        success: true,
        date: searchDate,
        region: region || 'all',
        clubs: [],
        totalClubs: 0,
        totalAvailableSlots: 0,
        scrapeDuration: 'N/A',
        message: 'Search completed but could not parse results'
      });
    }
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to get available regions
app.get('/api/regions', (req, res) => {
  try {
    // Import the scraper module to get clubs
    const scraperModule = require('./tennis-scraper-enhanced.js');
    
    // Get all clubs
    const clubs = scraperModule.CLUBS;
    
    // Load postcode regions mapping (synchronously for this endpoint)
    // We'll use the postcodes from clubs to determine regions
    const uniqueRegions = new Set();
    
    // For each club, get its region from postcode
    for (const clubKey in clubs) {
      const club = clubs[clubKey];
      const postcode = club.postcode;
      
      // Get region from POSTCODE_REGIONS
      // First try to use the loaded regions, fallback to hardcoded
      let region = scraperModule.POSTCODE_REGIONS[postcode];
      
      // If not in loaded regions, try basic mapping
      if (!region) {
        const basicRegions = {
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
          '2033': 'Eastern Suburbs'
        };
        region = basicRegions[postcode];
      }
      
      if (region) {
        uniqueRegions.add(region);
      }
    }
    
    // Convert to array and sort
    const regions = Array.from(uniqueRegions).sort();
    
    console.log(`📍 Found ${regions.length} regions with clubs: ${regions.join(', ')}`);
    
    res.json({ regions });
  } catch (error) {
    console.error('Error loading regions:', error);
    // Fallback to basic regions if there's an error
    res.json({ 
      regions: ['Eastern Suburbs', 'Inner City', 'Inner West', 'Inner South'] 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🎾 Tennis Court Finder Server`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${path.join(__dirname, 'public')}`);
  console.log(`\n✨ Open your browser to: http://localhost:${PORT}`);
  console.log(`\nPress Ctrl+C to stop the server\n`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 Server stopped');
  process.exit(0);
});
