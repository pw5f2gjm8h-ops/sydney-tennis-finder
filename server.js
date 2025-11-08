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
    // Read the scraper file to extract clubs and regions
    const scraperPath = path.join(__dirname, 'tennis-scraper-enhanced.js');
    const scraperContent = fs.readFileSync(scraperPath, 'utf8');
    
    // Extract POSTCODE_REGIONS mapping
    const postcodeMatch = scraperContent.match(/const POSTCODE_REGIONS = (?:loadRegionsFromCSV\(\)|(\{[^}]+\}))/s);
    
    if (!postcodeMatch) {
      console.warn('⚠️ Could not find POSTCODE_REGIONS in scraper');
      return res.json({ regions: ['All Regions', 'Eastern Suburbs', 'Inner City', 'Inner South', 'Inner West'] });
    }
    
    // Extract all postcode->region mappings
    const postcodeRegions = {};
    
    // Check if using CSV loader or hardcoded
    if (scraperContent.includes('loadRegionsFromCSV()')) {
      // Parse CSV file directly
      try {
        const csvPath = path.join(__dirname, 'sydneypostcodes.csv');
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const lines = csvContent.split('\n');
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const parts = line.split(',');
          if (parts.length >= 3) {
            const postcode = parts[0].trim();
            const region = parts[2].trim();
            if (postcode && region && region !== '(PO Boxes)') {
              postcodeRegions[postcode] = region;
            }
          }
        }
        console.log(`📂 Loaded ${Object.keys(postcodeRegions).length} postcodes from CSV`);
      } catch (csvError) {
        console.warn('⚠️ Could not read CSV, parsing from scraper code');
        // Fall back to parsing hardcoded values
        const regionsText = postcodeMatch[1] || '';
        const regionMatches = regionsText.matchAll(/'([^']+)'\s*:\s*'([^']+)'/g);
        for (const match of regionMatches) {
          postcodeRegions[match[1]] = match[2];
        }
      }
    } else {
      // Parse hardcoded POSTCODE_REGIONS object
      const regionsText = postcodeMatch[1] || '';
      const regionMatches = regionsText.matchAll(/'([^']+)'\s*:\s*'([^']+)'/g);
      for (const match of regionMatches) {
        postcodeRegions[match[1]] = match[2];
      }
    }
    
    // Extract all CLUBS and their postcodes
    const clubsMatch = scraperContent.match(/const CLUBS = \{([\s\S]*?)\n\};/);
    
    if (!clubsMatch) {
      console.warn('⚠️ Could not find CLUBS in scraper');
      return res.json({ regions: ['All Regions', 'Eastern Suburbs', 'Inner City', 'Inner South', 'Inner West'] });
    }
    
    // Find all postcodes used by clubs
    const clubPostcodes = new Set();
    const postcodeMatches = clubsMatch[1].matchAll(/postcode:\s*'(\d+)'/g);
    
    for (const match of postcodeMatches) {
      clubPostcodes.add(match[1]);
    }
    
    console.log(`🏢 Found ${clubPostcodes.size} unique postcodes used by clubs`);
    
    // Map postcodes to regions - ONLY include regions that have clubs
    const activeRegions = new Set();
    
    for (const postcode of clubPostcodes) {
      const region = postcodeRegions[postcode];
      if (region) {
        activeRegions.add(region);
      } else {
        console.warn(`⚠️ No region mapping for postcode ${postcode}`);
      }
    }
    
    // Sort regions alphabetically
    const regions = Array.from(activeRegions).sort();
    
    console.log(`✅ Active regions with clubs (${regions.length}): ${regions.join(', ')}`);
    
    // Return with "All Regions" first
    res.json({ regions: ['All Regions', ...regions] });
    
  } catch (error) {
    console.error('❌ Error loading regions:', error);
    // Fallback to known good regions
    res.json({ regions: ['All Regions', 'Eastern Suburbs', 'Inner City', 'Inner South', 'Inner West'] });
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
