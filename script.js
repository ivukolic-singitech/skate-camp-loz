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

// Add data inspection panel for debugging
function showDataInspector(csvText, parsedData) {
    const inspector = document.createElement('div');
    inspector.id = 'dataInspector';
    inspector.style.cssText = `
        position: fixed; top: 50px; right: 20px; width: 300px; max-height: 70vh; 
        background: white; border: 2px solid #2563eb; border-radius: 8px; 
        padding: 1rem; font-size: 0.8rem; overflow-y: auto; z-index: 1000;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    `;
    
    const lines = csvText.trim().split('\n');
    inspector.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <strong>Data Inspector</strong>
            <button onclick="document.getElementById('dataInspector').remove()" style="border: none; background: #dc2626; color: white; border-radius: 4px; padding: 4px 8px; cursor: pointer;">×</button>
        </div>
        <div style="margin-bottom: 1rem;">
            <strong>Raw CSV Stats:</strong><br>
            📊 Total lines: ${lines.length}<br>
            📝 Header: ${lines[0]}<br>
            🔢 Data rows: ${lines.length - 1}
        </div>
        <div style="margin-bottom: 1rem;">
            <strong>Parsed Data:</strong><br>
            📅 Days found: ${Object.keys(parsedData).length}<br>
            🎯 Total activities: ${Object.values(parsedData).reduce((sum, day) => sum + day.length, 0)}
        </div>
        <details style="margin-bottom: 1rem;">
            <summary style="cursor: pointer; font-weight: bold;">📋 All Raw Data</summary>
            <pre style="background: #f3f4f6; padding: 0.5rem; border-radius: 4px; font-size: 0.7rem; white-space: pre-wrap; max-height: 200px; overflow-y: auto;">${csvText.substring(0, 2000)}${csvText.length > 2000 ? '...' : ''}</pre>
        </details>
        <details>
            <summary style="cursor: pointer; font-weight: bold;">🔍 Parsed Structure</summary>
            <pre style="background: #f3f4f6; padding: 0.5rem; border-radius: 4px; font-size: 0.7rem; white-space: pre-wrap; max-height: 200px; overflow-y: auto;">${JSON.stringify(parsedData, null, 2)}</pre>
        </details>
    `;
    
    // Remove existing inspector
    const existing = document.getElementById('dataInspector');
    if (existing) existing.remove();
    
    document.body.appendChild(inspector);
}

// Schedule Loading
window.scheduleLoaded = false;
const PUBLISHED_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1bJZStcSuvw7DYlV4rAdTd1iKQiwdcumhndixeaEiQSyNKhxfAD2gfu4kWUzMyhH-Wwc0-LE6-Xt9/pub?output=csv';

async function loadSchedule() {
    const loading = document.getElementById('loading');
    const scheduleGrid = document.getElementById('schedule-grid');
    
    loading.innerHTML = 'Loading schedule from Google Sheets...';
    
    try {
        // Fetch the published CSV directly
        console.log('🌐 Fetching from URL:', PUBLISHED_CSV_URL);
        const response = await fetch(PUBLISHED_CSV_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        console.log('📊 Raw CSV response length:', csvText.length);
        console.log('📝 First 500 characters:', csvText.substring(0, 500));
        
        if (!csvText || csvText.trim().length === 0) {
            throw new Error('Empty CSV response');
        }
        
        // Enhanced parsing to capture ALL data
        const scheduleData = parseCSVComplete(csvText);
        console.log('✅ Parsed schedule data:', scheduleData);
        console.log('📅 Number of days found:', Object.keys(scheduleData).length);
        
        // Show data inspector for debugging
        showDataInspector(csvText, scheduleData);
        
        if (Object.keys(scheduleData).length > 0) {
            renderSchedule(scheduleData);
            loading.style.display = 'none';
            window.scheduleLoaded = true;
            console.log('🎉 Schedule loaded successfully from Google Sheets!');
        } else {
            throw new Error('No valid schedule data found in CSV');
        }
        
    } catch (error) {
        console.error('❌ Error loading schedule:', error);
        
        // Show detailed error information
        loading.innerHTML = `
            <div class="error">
                <strong>🔍 Debug Information:</strong><br>
                <small>📍 URL: ${PUBLISHED_CSV_URL.substring(0, 50)}...</small><br>
                <small>⚠️ Error: ${error.message}</small><br>
                <small>Loading sample data instead...</small><br><br>
                <button onclick="loadSchedule()" style="padding: 0.5rem 1rem; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    🔄 Retry Loading
                </button>
            </div>
        `;
        
        // Load sample data as fallback
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

// Enhanced CSV parser that captures ALL data dynamically
function parseCSVComplete(csvText) {
    console.log('🔍 Starting enhanced CSV parsing...');
    const lines = csvText.trim().split('\n');
    console.log(`📊 Found ${lines.length} lines in CSV`);
    
    if (lines.length < 1) {
        console.log('❌ No lines in CSV');
        return {};
    }
    
    // Parse header to understand column structure
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine);
    console.log('📋 Headers found:', headers);
    
    const schedule = {};
    let validRows = 0;
    let totalRows = 0;
    
    // Process all data rows (skip header if it exists)
    const startRow = headers.some(h => h.toLowerCase().includes('day') || h.toLowerCase().includes('date')) ? 1 : 0;
    
    for (let i = startRow; i < lines.length; i++) {
        const line = lines[i].trim();
        totalRows++;
        
        if (!line) {
            console.log(`⏭️ Skipping empty line ${i}`);
            continue;
        }
        
        console.log(`🔍 Processing line ${i}:`, line);
        
        const values = parseCSVLine(line);
        console.log(`📝 Parsed values (${values.length} columns):`, values);
        
        if (values.length === 0) {
            console.log(`⏭️ Skipping line ${i} - no data`);
            continue;
        }
        
        // Dynamic field mapping - handle various column structures
        let day = '', time = '', activity = '', description = '';
        let location = '', instructor = '', notes = '';
        
        // Try to intelligently map columns
        for (let j = 0; j < values.length; j++) {
            const value = (values[j] || '').toString().trim();
            const header = (headers[j] || '').toString().toLowerCase();
            
            // Map based on header names or content patterns
            if (!day && (header.includes('day') || header.includes('date') || 
                        value.toLowerCase().includes('monday') || value.toLowerCase().includes('tuesday') ||
                        value.toLowerCase().includes('wednesday') || value.toLowerCase().includes('thursday') ||
                        value.toLowerCase().includes('friday') || value.toLowerCase().includes('saturday') ||
                        value.toLowerCase().includes('sunday') || value.includes('August') || 
                        /\d{1,2}\/\d{1,2}/.test(value) || value.includes('-'))) {
                day = value;
            } else if (!time && (header.includes('time') || header.includes('hour') ||
                                /\d{1,2}:\d{2}/.test(value) || value.toLowerCase().includes('am') || 
                                value.toLowerCase().includes('pm'))) {
                time = value;
            } else if (!activity && (header.includes('activity') || header.includes('event') || 
                                    header.includes('session') || header.includes('title'))) {
                activity = value;
            } else if (!description && (header.includes('description') || header.includes('detail') ||
                                       header.includes('note') || header.includes('info'))) {
                description = value;
            } else if (!location && (header.includes('location') || header.includes('venue') ||
                                    header.includes('place') || header.includes('room'))) {
                location = value;
            } else if (!instructor && (header.includes('instructor') || header.includes('teacher') ||
                                      header.includes('coach') || header.includes('leader'))) {
                instructor = value;
            } else if (!notes && (header.includes('notes') || header.includes('remarks') ||
                                 header.includes('comments'))) {
                notes = value;
            }
            // If we haven't assigned this column yet and it has data, try to guess
            else if (value && !day && j === 0) {
                day = value; // First column is often the day
            } else if (value && !time && j === 1) {
                time = value; // Second column is often time
            } else if (value && !activity && j === 2) {
                activity = value; // Third column is often activity
            } else if (value && !description && j === 3) {
                description = value; // Fourth column is often description
            }
        }
        
        // Create a meaningful day identifier if we have any time-based info
        if (!day && time) {
            day = `Day ${Math.floor(i / 10) + 1}`; // Create generic day grouping
        }
        
        if (!day && activity) {
            day = 'Schedule'; // Generic grouping
        }
        
        if (!day) {
            console.log(`⏭️ Skipping line ${i} - no day/date identifier found`);
            continue;
        }
        
        // Initialize day group if needed
        if (!schedule[day]) {
            schedule[day] = [];
            console.log(`📅 Created new day: "${day}"`);
        }
        
        // Create comprehensive activity object with all available data
        const activityObj = {
            time: time,
            activity: activity,
            description: description
        };
        
        // Add additional fields if they have data
        if (location) activityObj.location = location;
        if (instructor) activityObj.instructor = instructor;
        if (notes) activityObj.notes = notes;
        
        // Add any remaining unmapped fields as extras
        const extras = {};
        for (let j = 0; j < values.length; j++) {
            const value = (values[j] || '').toString().trim();
            const header = headers[j] || `Column_${j + 1}`;
            
            if (value && 
                value !== day && value !== time && value !== activity && 
                value !== description && value !== location && value !== instructor && value !== notes) {
                extras[header] = value;
            }
        }
        
        if (Object.keys(extras).length > 0) {
            activityObj.extras = extras;
        }
        
        schedule[day].push(activityObj);
        validRows++;
        console.log(`✅ Added activity for "${day}": ${activity || time || 'Unnamed activity'}`);
    }
    
    console.log(`📈 Parsing complete: ${validRows}/${totalRows} valid rows, ${Object.keys(schedule).length} days`);
    console.log('🎯 Final schedule structure:', schedule);
    
    return schedule;
}

// Robust CSV line parser
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
    return result.map(field => field.replace(/^"|"$/g, '').trim());
}

// Enhanced rendering function to show ALL data
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
            
            // Build comprehensive activity display
            let activityHTML = '';
            
            if (item.time) {
                activityHTML += `<div class="activity-time">${item.time}</div>`;
            }
            
            if (item.activity) {
                activityHTML += `<div class="activity-title">${item.activity}</div>`;
            }
            
            // Build description with all additional info
            let descriptionParts = [];
            if (item.description) descriptionParts.push(item.description);
            if (item.location) descriptionParts.push(`📍 Location: ${item.location}`);
            if (item.instructor) descriptionParts.push(`👨‍🏫 Instructor: ${item.instructor}`);
            if (item.notes) descriptionParts.push(`📝 Notes: ${item.notes}`);
            
            // Add any extra fields
            if (item.extras) {
                Object.entries(item.extras).forEach(([key, value]) => {
                    descriptionParts.push(`${key}: ${value}`);
                });
            }
            
            if (descriptionParts.length > 0) {
                activityHTML += `<div class="activity-description">${descriptionParts.join('<br>')}</div>`;
            }
            
            // If no activity title, use time or first available info
            if (!item.activity && !item.time) {
                activityHTML += `<div class="activity-title">Activity ${scheduleData[day].indexOf(item) + 1}</div>`;
            }
            
            activity.innerHTML = activityHTML;
            
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

// Sample data fallback with more comprehensive structure
const sampleSchedule = {
    "Monday - August 12": [
        { 
            time: "9:00 AM", 
            activity: "Registration & Welcome", 
            description: "Check-in, get your gear, meet the instructors and fellow campers",
            location: "Main Entrance",
            instructor: "Team LOZ"
        },
        { 
            time: "10:00 AM", 
            activity: "Basic Safety & Equipment", 
            description: "Learn about protective gear, board selection, and safety fundamentals",
            location: "Training Area A"
        },
        { 
            time: "2:00 PM", 
            activity: "Hill Practice - Beginner", 
            description: "Start with gentle slopes, focus on balance and basic stance",
            location: "Beginner Hill"
        }
    ],
    "Tuesday - August 13": [
        { 
            time: "9:00 AM", 
            activity: "Advanced Hill Techniques", 
            description: "Learn to navigate steeper inclines with confidence",
            location: "Advanced Hill"
        },
        { 
            time: "2:00 PM", 
            activity: "Stopping Methods Workshop", 
            description: "Master different stopping techniques for various situations"
        }
    ]
};
