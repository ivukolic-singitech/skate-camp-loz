// PWA Installation
let deferredPrompt;
const installPrompt = document.getElementById('installPrompt');
const installBtn = document.getElementById('installBtn');
const dismissBtn = document.getElementById('dismissBtn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installPrompt.classList.add('show');
});

installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        installPrompt.classList.remove('show');
    }
});

dismissBtn.addEventListener('click', () => {
    installPrompt.classList.remove('show');
});

// Navigation
const navTabs = document.querySelectorAll('.nav-tab');
const pages = document.querySelectorAll('.page');

navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetPage = tab.dataset.page;
        
        navTabs.forEach(t => t.classList.remove('active'));
        pages.forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(targetPage).classList.add('active');
        
        if (targetPage === 'schedule' && !window.scheduleLoaded) {
            loadSchedule();
        }
    });
});

// Schedule Loading
window.scheduleLoaded = false;
const PUBLISHED_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1bJZStcSuvw7DYlV4rAdTd1iKQiwdcumhndixeaEiQSyNKhxfAD2gfu4kWUzMyhH-Wwc0-LE6-Xt9/pub?output=csv';

async function loadSchedule() {
    const loading = document.getElementById('loading');
    const scheduleGrid = document.getElementById('schedule-grid');
    
    loading.innerHTML = 'Loading schedule from Google Sheets...';
    
    try {
        // Fetch the published CSV directly (no CORS issues)
        console.log('Fetching from URL:', PUBLISHED_CSV_URL);
        const response = await fetch(PUBLISHED_CSV_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        console.log('Raw CSV response length:', csvText.length);
        console.log('First 500 characters of CSV:', csvText.substring(0, 500));
        
        if (!csvText || csvText.trim().length === 0) {
            throw new Error('Empty CSV response');
        }
        
        const scheduleData = parseCSV(csvText);
        console.log('Parsed schedule data:', scheduleData);
        console.log('Number of days found:', Object.keys(scheduleData).length);
        
        if (Object.keys(scheduleData).length > 0) {
            renderSchedule(scheduleData);
            loading.style.display = 'none';
            window.scheduleLoaded = true;
            console.log('✅ Schedule loaded successfully from Google Sheets!');
        } else {
            throw new Error('No valid schedule data found in CSV');
        }
        
    } catch (error) {
        console.error('❌ Error loading schedule:', error);
        
        // Show detailed error information
        loading.innerHTML = `
            <div class="error">
                <strong>Debug Information:</strong><br>
                <small>URL: ${PUBLISHED_CSV_URL}</small><br>
                <small>Error: ${error.message}</small><br>
                <small>Loading sample data instead...</small><br><br>
                <button onclick="loadSchedule()" style="padding: 0.5rem 1rem; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Retry Loading
                </button>
            </div>
        `;
        
        // Load sample data as fallback after a short delay
        setTimeout(() => {
            console.log('Loading sample data as fallback...');
            renderSchedule(sampleSchedule);
            loading.innerHTML = '<div style="color: #059669; text-align: center;"><small>📋 Sample schedule loaded (Google Sheets data unavailable)</small></div>';
            setTimeout(() => {
                loading.style.display = 'none';
            }, 2000);
            window.scheduleLoaded = true;
        }, 1000);
    }
}

function parseCSV(csvText) {
    console.log('📊 Starting CSV parsing...');
    const lines = csvText.trim().split('\n');
    console.log(`Found ${lines.length} lines in CSV`);
    
    if (lines.length < 2) {
        console.log('❌ Not enough lines in CSV');
        return {};
    }
    
    // Log the header row for debugging
    console.log('Header row:', lines[0]);
    
    const schedule = {};
    let validRows = 0;
    
    // Skip header row and process data
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            console.log(`Skipping empty line ${i}`);
            continue;
        }
        
        console.log(`Processing line ${i}:`, line);
        
        // Handle CSV parsing with potential commas in quoted fields
        const values = parseCSVLine(line);
        console.log(`Parsed values:`, values);
        
        if (values.length < 2) {
            console.log(`Skipping line ${i} - not enough columns (${values.length})`);
            continue;
        }
        
        const day = values[0] ? values[0].trim() : '';
        const time = values[1] ? values[1].trim() : '';
        const activity = values[2] ? values[2].trim() : '';
        const description = values[3] ? values[3].trim() : '';
        
        if (!day) {
            console.log(`Skipping line ${i} - no day specified`);
            continue;
        }
        
        if (!schedule[day]) {
            schedule[day] = [];
            console.log(`Created new day: "${day}"`);
        }
        
        schedule[day].push({
            time: time,
            activity: activity,
            description: description
        });
        
        validRows++;
        console.log(`✅ Added activity for ${day}: ${activity}`);
    }
    
    console.log(`📈 Parsing complete: ${validRows} valid rows, ${Object.keys(schedule).length} days`);
    console.log('Final schedule structure:', schedule);
    
    return schedule;
}

// Better CSV line parser that handles quoted fields
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    // Remove surrounding quotes and clean up
    return result.map(field => field.replace(/^"|"$/g, '').trim());
}

function renderSchedule(scheduleData) {
    const scheduleGrid = document.getElementById('schedule-grid');
    scheduleGrid.innerHTML = '';
    
    Object.keys(scheduleData).forEach(day => {
        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = day;
        
        const activities = document.createElement('div');
        activities.className = 'activities';
        
        scheduleData[day].forEach(item => {
            const activity = document.createElement('div');
            activity.className = 'activity';
            
            activity.innerHTML = `
                <div class="activity-time">${item.time}</div>
                <div class="activity-title">${item.activity}</div>
                <div class="activity-description">${item.description}</div>
            `;
            
            activity.addEventListener('click', () => {
                activity.classList.toggle('expanded');
            });
            
            activities.appendChild(activity);
        });
        
        dayCard.appendChild(dayHeader);
        dayCard.appendChild(activities);
        scheduleGrid.appendChild(dayCard);
    });
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(registration => console.log('SW registered'))
        .catch(error => console.log('SW registration failed'));
}

// Sample data fallback
const sampleSchedule = {
    "Monday - August 12": [
        { time: "9:00 AM", activity: "Registration & Welcome", description: "Check-in, get your gear, meet the instructors and fellow campers" },
        { time: "10:00 AM", activity: "Basic Safety & Equipment", description: "Learn about protective gear, board selection, and safety fundamentals" },
        { time: "2:00 PM", activity: "Hill Practice - Beginner", description: "Start with gentle slopes, focus on balance and basic stance" }
    ],
    "Tuesday - August 13": [
        { time: "9:00 AM", activity: "Advanced Hill Techniques", description: "Learn to navigate steeper inclines with confidence" },
        { time: "2:00 PM", activity: "Stopping Methods Workshop", description: "Master different stopping techniques for various situations" }
    ],
    "Wednesday - August 14": [
        { time: "9:00 AM", activity: "City Tour - Lausanne Hills", description: "Apply your skills on real Lausanne streets with instructor guidance" },
        { time: "2:00 PM", activity: "Individual Coaching Sessions", description: "One-on-one time with instructors to improve your technique" }
    ],
    "Thursday - August 15": [
        { time: "9:00 AM", activity: "Group Challenges", description: "Fun team activities and skill competitions" },
        { time: "2:00 PM", activity: "Free Practice & Q&A", description: "Practice time with instructors available for questions" }
    ],
    "Friday - August 16": [
        { time: "9:00 AM", activity: "Final Skills Assessment", description: "Show off everything you've learned this week" },
        { time: "11:00 AM", activity: "Graduation Ceremony", description: "Certificate presentation and group photos" }
    ]
};
