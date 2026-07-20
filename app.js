// App State
const state = {
    currentDay: 12,
    totalDays: 90,
    painLogs: [],
    exercises: [
        { id: 1, name: 'Ankle Pumps', description: '20 reps · 3 sets', completed: false },
        { id: 2, name: 'Quad Sets', description: '10 reps · hold 5 sec', completed: false },
        { id: 3, name: 'Heel Slides', description: '15 reps · 2 sets', completed: false },
        { id: 4, name: 'Straight Leg Raises', description: '10 reps · each leg', completed: false }
    ],
    photos: [],
    selectedPain: null,
    selectedRating: null
};

const painDescriptions = {
    1: 'Minimal — barely noticeable',
    2: 'Very mild — slight discomfort',
    3: 'Noticeable — but manageable',
    4: 'Moderate — you feel it',
    5: 'Medium — starting to bother you',
    6: 'Strong — hard to ignore',
    7: 'Very strong — limits movement',
    8: 'Intense — need to rest',
    9: 'Severe — hard to function',
    10: 'Extreme — seek help immediately'
};

// DOM
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Init
function init() {
    loadFromStorage();
    renderExercises();
    renderLogHistory();
    renderPhotos();
    updateStats();
    updateProgressRing();
    setupListeners();
}

function setupListeners() {
    tabs.forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));

    document.querySelectorAll('.pain-btn').forEach(btn => {
        btn.addEventListener('click', () => selectPain(parseInt(btn.dataset.pain)));
    });

    document.querySelectorAll('.sleep-btn').forEach(btn => {
        btn.addEventListener('click', () => selectRating(btn.dataset.rating));
    });

    document.getElementById('save-log').addEventListener('click', saveLog);
    document.getElementById('photo-input').addEventListener('change', handlePhotoUpload);
}

// Landing / App toggle
function showApp() {
    document.getElementById('landing').style.display = 'none';
    document.getElementById('main-app').classList.remove('hidden');
}

function showLanding() {
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('landing').style.display = 'flex';
}

// Tabs
function showTab(tabName) {
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

// Pain
function selectPain(level) {
    state.selectedPain = level;
    document.querySelectorAll('.pain-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector(`[data-pain="${level}"]`).classList.add('selected');
    document.getElementById('pain-description').textContent = painDescriptions[level];
}

// Rating
function selectRating(rating) {
    state.selectedRating = rating;
    document.querySelectorAll('.sleep-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector(`[data-rating="${rating}"]`).classList.add('selected');
}

// Save Log
function saveLog() {
    if (!state.selectedPain) {
        document.querySelector('.pain-grid').style.animation = 'shake 0.4s';
        setTimeout(() => document.querySelector('.pain-grid').style.animation = '', 400);
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

    const btn = document.getElementById('save-log');
    btn.textContent = '✓ Saved!';
    btn.style.background = '#059669';
    setTimeout(() => {
        btn.textContent = '💾 Save Today\'s Log';
        btn.style.background = '';
    }, 1500);

    state.selectedPain = null;
    state.selectedRating = null;
    document.querySelectorAll('.pain-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.sleep-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('pain-description').textContent = 'Tap a number above';
    document.getElementById('log-notes').value = '';
}

// Render Logs
function renderLogHistory() {
    const el = document.getElementById('log-history');
    if (state.painLogs.length === 0) {
        el.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px;">No logs yet</p>';
        return;
    }
    el.innerHTML = state.painLogs.slice(0, 5).map(log => {
        const d = new Date(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const cls = log.pain <= 3 ? 'pain-low' : log.pain <= 6 ? 'pain-medium' : 'pain-high';
        return `<div class="log-entry">
            <div class="date">${d}</div>
            <span class="pain ${cls}">Pain ${log.pain}/10</span>
            ${log.notes ? `<p class="notes">${log.notes}</p>` : ''}
        </div>`;
    }).join('');
}

// Render Exercises
function renderExercises() {
    const el = document.getElementById('exercise-list');
    el.innerHTML = state.exercises.map(ex => `
        <div class="exercise-item ${ex.completed ? 'completed' : ''}">
            <div class="exercise-check ${ex.completed ? 'checked' : ''}" onclick="toggleExercise(${ex.id})"></div>
            <div class="exercise-info">
                <h4>${ex.name}</h4>
                <p>${ex.description}</p>
            </div>
        </div>
    `).join('');

    const done = state.exercises.filter(e => e.completed).length;
    document.getElementById('exercise-progress-text').textContent = `${done} of ${state.exercises.length} completed`;
    document.getElementById('exercise-progress-fill').style.width = `${(done / state.exercises.length) * 100}%`;
    document.getElementById('exercise-complete-card').style.display = done === state.exercises.length ? 'block' : 'none';
    document.getElementById('todo-exercise').className = done === state.exercises.length ? 'todo-check done' : 'todo-check';
}

function toggleExercise(id) {
    const ex = state.exercises.find(e => e.id === id);
    if (ex) {
        ex.completed = !ex.completed;
        saveToStorage();
        renderExercises();
    }
}

// Photos
function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        state.photos.unshift({ id: Date.now(), url: ev.target.result, date: new Date().toISOString() });
        saveToStorage();
        renderPhotos();
    };
    reader.readAsDataURL(file);
}

function renderPhotos() {
    const grid = document.getElementById('photo-grid');
    const empty = document.getElementById('photo-empty');
    if (state.photos.length === 0) {
        empty.style.display = 'block';
        grid.innerHTML = '';
        return;
    }
    empty.style.display = 'none';
    grid.innerHTML = state.photos.map(p => {
        const d = new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `<div class="photo-item"><img src="${p.url}" alt="Progress"><div class="photo-date">${d}</div></div>`;
    }).join('');
}

// Stats
function updateStats() {
    document.getElementById('current-day').textContent = state.currentDay;
    if (state.painLogs.length > 0) {
        const avg = state.painLogs.reduce((s, l) => s + l.pain, 0) / state.painLogs.length;
        document.getElementById('pain-avg').textContent = avg.toFixed(1);
        document.getElementById('todo-pain').className = 'todo-check done';
    }
    document.getElementById('exercises-done').textContent = state.exercises.filter(e => e.completed).length * state.currentDay;
    document.getElementById('streak').textContent = Math.min(state.painLogs.length, 7);
    if (state.photos.length > 0) document.getElementById('todo-photo').className = 'todo-check done';
}

function updateProgressRing() {
    const pct = (state.currentDay / state.totalDays) * 100;
    const circ = 2 * Math.PI * 50;
    const offset = circ - (pct / 100) * circ;
    const ring = document.querySelector('.progress-ring-fill');
    if (ring) {
        ring.style.strokeDasharray = circ;
        ring.style.strokeDashoffset = offset;
    }
}

// Storage
function saveToStorage() {
    localStorage.setItem('recoverwell_state', JSON.stringify(state));
}

function loadFromStorage() {
    const saved = localStorage.getItem('recoverwell_state');
    if (saved) Object.assign(state, JSON.parse(saved));
}

// Modal
function showReportModal() {
    document.getElementById('report-modal').classList.add('active');
    generateReport();
}

function closeModal() {
    document.getElementById('report-modal').classList.remove('active');
}

function generateReport() {
    const el = document.getElementById('report-preview');
    const avg = state.painLogs.length > 0
        ? (state.painLogs.reduce((s, l) => s + l.pain, 0) / state.painLogs.length).toFixed(1)
        : 'N/A';

    el.innerHTML = `
        <h3>Recovery Report</h3>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Day ${state.currentDay} of ${state.totalDays}</strong></p>
        <hr>
        <h4>Pain Summary</h4>
        <p>Average: <strong>${avg}/10</strong></p>
        <p>Total logs: <strong>${state.painLogs.length}</strong></p>
        <hr>
        <h4>Exercises Today</h4>
        <p>${state.exercises.filter(e => e.completed).length} of ${state.exercises.length} completed</p>
        <hr>
        <h4>Recent Entries</h4>
        ${state.painLogs.length > 0
            ? state.painLogs.slice(0, 7).map(l =>
                `<p>${new Date(l.date).toLocaleDateString()} — Pain ${l.pain}/10${l.notes ? ' · ' + l.notes : ''}</p>`
            ).join('')
            : '<p>No entries yet</p>'}
        <hr>
        <p><em>Generated by RecoverWell</em></p>
    `;
}

function downloadReport() {
    const text = document.getElementById('report-preview').innerText;
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `recovery-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    closeModal();
}

document.addEventListener('DOMContentLoaded', init);
