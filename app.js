// App State
const state = {
    currentDay: 12,
    totalDays: 90,
    painLogs: [],
    exercises: [
        { id: 1, name: 'Ankle Pumps', description: '20 reps, 3 sets', completed: false },
        { id: 2, name: 'Quad Sets', description: '10 reps, hold 5 seconds', completed: false },
        { id: 3, name: 'Heel Slides', description: '15 reps, 2 sets', completed: false },
        { id: 4, name: 'Straight Leg Raises', description: '10 reps, each leg', completed: false }
    ],
    photos: [],
    selectedPain: null,
    selectedRating: null
};

// Pain descriptions
const painDescriptions = {
    1: 'Minimal pain - barely noticeable',
    2: 'Very mild pain - slight discomfort',
    3: 'Noticeable pain - doesn\'t interfere with activities',
    4: 'Moderate pain - tolerable but present',
    5: 'Moderately strong pain - starts to interfere',
    6: 'Strong pain - difficult to concentrate',
    7: 'Very strong pain - hard to do daily tasks',
    8: 'Intense pain - need to rest often',
    9: 'Extremely intense pain - difficult to function',
    10: 'Worst possible pain - emergency needed'
};

// DOM Elements
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const exerciseList = document.getElementById('exercise-list');
const logHistory = document.getElementById('log-history');
const photoGrid = document.getElementById('photo-grid');
const painBtns = document.querySelectorAll('.pain-btn');
const ratingBtns = document.querySelectorAll('.rating-btn');
const photoInput = document.getElementById('photo-input');

// Initialize App
function init() {
    loadFromStorage();
    
    // Show splash, then main app
    setTimeout(() => {
        document.getElementById('splash').style.display = 'none';
        document.getElementById('main-app').classList.remove('hidden');
    }, 2000);
    
    renderExercises();
    renderLogHistory();
    renderPhotos();
    updateStats();
    setupEventListeners();
    updateProgressRing();
}

// Event Listeners
function setupEventListeners() {
    // Tab navigation
    tabs.forEach(tab => {
        tab.addEventListener('click', () => showTab(tab.dataset.tab));
    });

    // Pain buttons
    painBtns.forEach(btn => {
        btn.addEventListener('click', () => selectPain(parseInt(btn.dataset.pain)));
    });

    // Rating buttons
    ratingBtns.forEach(btn => {
        btn.addEventListener('click', () => selectRating(btn.dataset.rating));
    });

    // Save log button
    document.getElementById('save-log').addEventListener('click', saveLog);

    // Photo input
    photoInput.addEventListener('change', handlePhotoUpload);
}

// Tab Navigation
function showTab(tabName) {
    tabs.forEach(tab => tab.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

// Pain Selection
function selectPain(level) {
    state.selectedPain = level;
    painBtns.forEach(btn => btn.classList.remove('selected'));
    document.querySelector(`[data-pain="${level}"]`).classList.add('selected');
    document.getElementById('pain-description').textContent = painDescriptions[level];
    
    // Add animation
    const btn = document.querySelector(`[data-pain="${level}"]`);
    btn.style.transform = 'scale(1.2)';
    setTimeout(() => btn.style.transform = 'scale(1.1)', 150);
}

// Rating Selection
function selectRating(rating) {
    state.selectedRating = rating;
    ratingBtns.forEach(btn => btn.classList.remove('selected'));
    document.querySelector(`[data-rating="${rating}"]`).classList.add('selected');
}

// Save Log
function saveLog() {
    if (!state.selectedPain) {
        // Shake animation on pain selector
        document.querySelector('.pain-selector').style.animation = 'shake 0.5s';
        setTimeout(() => document.querySelector('.pain-selector').style.animation = '', 500);
        return;
    }

    const log = {
        id: Date.now(),
        date: new Date().toISOString(),
        pain: state.selectedPain,
        notes: document.getElementById('log-notes').value,
        sleep: state.selectedRating || 'not rated'
    };

    state.painLogs.unshift(log);
    saveToStorage();
    renderLogHistory();
    updateStats();

    // Success animation
    const btn = document.getElementById('save-log');
    btn.innerHTML = '<span class="btn-icon">✓</span> Saved!';
    btn.style.background = '#10B981';
    
    setTimeout(() => {
        btn.innerHTML = '<span class="btn-icon">💾</span> Save Today\'s Log';
        btn.style.background = '';
    }, 2000);

    // Reset form
    state.selectedPain = null;
    state.selectedRating = null;
    painBtns.forEach(btn => btn.classList.remove('selected'));
    ratingBtns.forEach(btn => btn.classList.remove('selected'));
    document.getElementById('pain-description').textContent = 'Select your pain level';
    document.getElementById('log-notes').value = '';
}

// Render Log History
function renderLogHistory() {
    if (state.painLogs.length === 0) {
        logHistory.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">No logs yet. Start tracking today!</p>';
        return;
    }

    logHistory.innerHTML = state.painLogs.slice(0, 5).map(log => {
        const date = new Date(log.date).toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
        const painClass = log.pain <= 3 ? 'pain-low' : log.pain <= 6 ? 'pain-medium' : 'pain-high';
        
        return `
            <div class="log-entry">
                <div class="date">${date}</div>
                <span class="pain ${painClass}">Pain: ${log.pain}/10</span>
                ${log.notes ? `<p class="notes">${log.notes}</p>` : ''}
            </div>
        `;
    }).join('');
}

// Render Exercises
function renderExercises() {
    exerciseList.innerHTML = state.exercises.map(exercise => `
        <div class="exercise-item ${exercise.completed ? 'completed' : ''}">
            <div class="exercise-check ${exercise.completed ? 'checked' : ''}" 
                 onclick="toggleExercise(${exercise.id})"></div>
            <div class="exercise-info">
                <h4>${exercise.name}</h4>
                <p>${exercise.description}</p>
            </div>
        </div>
    `).join('');

    updateCompletedCount();
    updateExerciseProgress();
}

// Toggle Exercise
function toggleExercise(id) {
    const exercise = state.exercises.find(e => e.id === id);
    if (exercise) {
        exercise.completed = !exercise.completed;
        saveToStorage();
        renderExercises();
    }
}

// Update Completed Count
function updateCompletedCount() {
    const completed = state.exercises.filter(e => e.completed).length;
    document.getElementById('exercise-progress-text').textContent = 
        `${completed}/${state.exercises.length} completed`;
    
    // Show completion card if all done
    const completeCard = document.getElementById('exercise-complete-card');
    if (completed === state.exercises.length && state.exercises.length > 0) {
        completeCard.style.display = 'block';
    } else {
        completeCard.style.display = 'none';
    }
}

// Update Exercise Progress Bar
function updateExerciseProgress() {
    const completed = state.exercises.filter(e => e.completed).length;
    const percent = (completed / state.exercises.length) * 100;
    document.getElementById('exercise-progress-fill').style.width = `${percent}%`;
}

// Photo Upload
function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const photo = {
                id: Date.now(),
                url: event.target.result,
                date: new Date().toISOString()
            };
            state.photos.unshift(photo);
            saveToStorage();
            renderPhotos();
        };
        reader.readAsDataURL(file);
    }
}

// Render Photos
function renderPhotos() {
    const photoEmpty = document.getElementById('photo-empty');
    
    if (state.photos.length === 0) {
        photoEmpty.style.display = 'block';
        photoGrid.innerHTML = '';
        return;
    }
    
    photoEmpty.style.display = 'none';
    
    photoGrid.innerHTML = state.photos.map(photo => {
        const date = new Date(photo.date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
        return `
            <div class="photo-item">
                <img src="${photo.url}" alt="Progress photo">
                <div class="photo-date">${date}</div>
            </div>
        `;
    }).join('');
}

// Update Stats
function updateStats() {
    document.getElementById('current-day').textContent = state.currentDay;
    document.getElementById('total-days').textContent = state.totalDays;
    
    // Calculate average pain
    if (state.painLogs.length > 0) {
        const avg = state.painLogs.reduce((sum, log) => sum + log.pain, 0) / state.painLogs.length;
        document.getElementById('pain-avg').textContent = avg.toFixed(1);
    }

    // Count exercises done
    const exercisesDone = state.exercises.filter(e => e.completed).length * state.currentDay;
    document.getElementById('exercises-done').textContent = exercisesDone;

    // Calculate streak (simplified)
    document.getElementById('streak').textContent = Math.min(state.painLogs.length, 7);
}

// Update Progress Ring
function updateProgressRing() {
    const progress = (state.currentDay / state.totalDays) * 100;
    const circumference = 2 * Math.PI * 54; // radius = 54
    const offset = circumference - (progress / 100) * circumference;
    
    const ring = document.querySelector('.progress-ring-fill');
    if (ring) {
        ring.style.strokeDasharray = circumference;
        ring.style.strokeDashoffset = offset;
    }
}

// Local Storage
function saveToStorage() {
    localStorage.setItem('recoverwell_state', JSON.stringify(state));
}

function loadFromStorage() {
    const saved = localStorage.getItem('recoverwell_state');
    if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(state, parsed);
    }
}

// Modal Functions
function showReportModal() {
    document.getElementById('report-modal').classList.add('active');
    generateReport();
}

function closeModal() {
    document.getElementById('report-modal').classList.remove('active');
}

// Generate Report
function generateReport() {
    const report = document.getElementById('report-preview');
    const avgPain = state.painLogs.length > 0 
        ? (state.painLogs.reduce((sum, log) => sum + log.pain, 0) / state.painLogs.length).toFixed(1)
        : 'N/A';

    report.innerHTML = `
        <h3>Recovery Report</h3>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Day of Recovery:</strong> ${state.currentDay} of ${state.totalDays}</p>
        <hr>
        <h4>Pain Summary</h4>
        <p><strong>Average Pain Level:</strong> ${avgPain}/10</p>
        <p><strong>Total Logs:</strong> ${state.painLogs.length}</p>
        <hr>
        <h4>Exercise Summary</h4>
        <p><strong>Exercises Completed Today:</strong> ${state.exercises.filter(e => e.completed).length}/${state.exercises.length}</p>
        <hr>
        <h4>Recent Pain Levels</h4>
        ${state.painLogs.length > 0 
            ? state.painLogs.slice(0, 7).map(log => 
                `<p>${new Date(log.date).toLocaleDateString()}: ${log.pain}/10 ${log.notes ? '- ' + log.notes : ''}</p>`
            ).join('')
            : '<p>No logs recorded yet</p>'
        }
        <hr>
        <p><em>Generated by RecoverWell App</em></p>
    `;
}

// Download Report
function downloadReport() {
    const reportContent = document.getElementById('report-preview').innerText;
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recovery-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    closeModal();
}

// Add shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
