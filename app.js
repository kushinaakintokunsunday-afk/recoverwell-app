(function() {
    'use strict';

    // ========== UTILITIES ==========
    function escapeHtml(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function isLocalStorageAvailable() {
        try {
            const test = '__test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    function safeGetItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('localStorage read failed:', e);
            return null;
        }
    }

    function safeSetItem(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.warn('localStorage write failed:', e);
            showToast('Storage full. Some data may not save.');
            return false;
        }
    }

    function safeParseJSON(str) {
        try {
            return JSON.parse(str);
        } catch (e) {
            console.warn('JSON parse failed:', e);
            return null;
        }
    }

    function daysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        d1.setHours(0,0,0,0);
        d2.setHours(0,0,0,0);
        return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    function formatDateShort(dateStr) {
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function isToday(dateStr) {
        const d = new Date(dateStr);
        const now = new Date();
        return d.getFullYear() === now.getFullYear() &&
               d.getMonth() === now.getMonth() &&
               d.getDate() === now.getDate();
    }

    function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    // ========== IndexedDB FOR PHOTOS ==========
    const DB_NAME = 'RecoverWellDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'photos';

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = function(e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
            request.onsuccess = function(e) { resolve(e.target.result); };
            request.onerror = function(e) { reject(e.target.error); };
        });
    }

    async function savePhotoToDB(photo) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).put(photo);
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
            });
        } catch (e) {
            console.warn('IndexedDB save failed:', e);
            showToast('Failed to save photo');
        }
    }

    async function getPhotosFromDB() {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const request = tx.objectStore(STORE_NAME).getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (e) {
            console.warn('IndexedDB read failed:', e);
            return [];
        }
    }

    async function deletePhotoFromDB(id) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).delete(id);
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
            });
        } catch (e) {
            console.warn('IndexedDB delete failed:', e);
        }
    }

    async function clearPhotosFromDB() {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).clear();
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
            });
        } catch (e) {
            console.warn('IndexedDB clear failed:', e);
        }
    }

    function compressImage(file, maxWidth, quality) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    let w = img.width;
                    let h = img.height;
                    if (w > maxWidth) {
                        h = (maxWidth / w) * h;
                        w = maxWidth;
                    }
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob(function(blob) {
                        if (blob) {
                            const reader2 = new FileReader();
                            reader2.onload = function() {
                                resolve(reader2.result);
                            };
                            reader2.onerror = reject;
                            reader2.readAsDataURL(blob);
                        } else {
                            reject(new Error('Canvas toBlob failed'));
                        }
                    }, 'image/jpeg', quality || 0.7);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ========== APP STATE ==========
    let state = {
        setup: null,
        painLogs: [],
        exercises: [],
        viewAllLogs: false,
        lastReportText: ''
    };

    let objectURLs = [];

    function getDefaultState() {
        return {
            setup: null,
            painLogs: [],
            exercises: [
                { id: 1, name: 'Ankle Pumps', description: '20 reps · 3 sets', completed: false },
                { id: 2, name: 'Quad Sets', description: '10 reps · hold 5 sec', completed: false },
                { id: 3, name: 'Heel Slides', description: '15 reps · 2 sets', completed: false },
                { id: 4, name: 'Straight Leg Raises', description: '10 reps · each leg', completed: false }
            ],
            viewAllLogs: false,
            lastReportText: ''
        };
    }

    function saveState() {
        const toSave = {
            setup: state.setup,
            painLogs: state.painLogs,
            exercises: state.exercises,
            viewAllLogs: state.viewAllLogs
        };
        safeSetItem('recoverwell_state', JSON.stringify(toSave));
    }

    function loadState() {
        const raw = safeGetItem('recoverwell_state');
        if (!raw) return getDefaultState();
        const parsed = safeParseJSON(raw);
        if (!parsed) return getDefaultState();
        return {
            setup: parsed.setup || null,
            painLogs: Array.isArray(parsed.painLogs) ? parsed.painLogs : [],
            exercises: Array.isArray(parsed.exercises) && parsed.exercises.length > 0
                ? parsed.exercises
                : getDefaultState().exercises,
            viewAllLogs: false,
            lastReportText: ''
        };
    }

    // ========== CALCULATIONS ==========
    function getCurrentDay() {
        if (!state.setup) return 0;
        const start = new Date(state.setup.startDate);
        start.setHours(0,0,0,0);
        const now = new Date();
        now.setHours(0,0,0,0);
        return Math.max(1, daysBetween(start, now) + 1);
    }

    function getDaysLeft() {
        if (!state.setup) return 0;
        const current = getCurrentDay();
        return Math.max(0, state.setup.totalDays - current);
    }

    function getProgressPercent() {
        if (!state.setup) return 0;
        return Math.min(100, Math.round((getCurrentDay() / state.setup.totalDays) * 100));
    }

    function getTodayPainLog() {
        return state.painLogs.find(log => isToday(log.date));
    }

    function getRealStreak() {
        if (state.painLogs.length === 0) return 0;

        const sortedDates = [...new Set(state.painLogs.map(l => {
            const d = new Date(l.date);
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        }))].sort().reverse();

        if (sortedDates.length === 0) return 0;

        const today = new Date();
        today.setHours(0,0,0,0);
        const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

        if (sortedDates[0] !== todayKey && sortedDates[0] !== yesterdayKey) return 0;

        let streak = 1;
        let checkDate = new Date(sortedDates[0] === todayKey ? today : yesterday);

        for (let i = 1; i < sortedDates.length; i++) {
            const prev = new Date(checkDate);
            prev.setDate(prev.getDate() - 1);
            const prevKey = `${prev.getFullYear()}-${prev.getMonth()}-${prev.getDate()}`;
            if (sortedDates[i] === prevKey) {
                streak++;
                checkDate = prev;
            } else {
                break;
            }
        }
        return streak;
    }

    function getAvgPain() {
        if (state.painLogs.length === 0) return null;
        const sum = state.painLogs.reduce((s, l) => s + l.pain, 0);
        return (sum / state.painLogs.length).toFixed(1);
    }

    function getCompletedExercisesCount() {
        return state.exercises.filter(e => e.completed).length;
    }

    function getPainDescription(level) {
        const descriptions = {
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
        return descriptions[level] || '';
    }

    // ========== SCREEN MANAGEMENT ==========
    function hideAll() {
        document.getElementById('onboarding').classList.remove('active');
        document.getElementById('landing').style.display = 'none';
        document.getElementById('main-app').classList.add('hidden');
    }

    window.showOnboarding = function() {
        hideAll();
        document.getElementById('onboarding').classList.add('active');
    };

    window.showLanding = function() {
        hideAll();
        document.getElementById('landing').style.display = 'flex';
    };

    function showMainApp() {
        hideAll();
        document.getElementById('main-app').classList.remove('hidden');
        updateDashboard();
        if (window._pendingTab) {
            showTab(window._pendingTab);
            if (window._pendingTab === 'share') openShareOptions();
            window._pendingTab = null;
        }
    }

    window.skipOnboarding = function() {
        showMainApp();
    };

    window.showTab = function(tabName) {
        document.querySelectorAll('.tab').forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        const tab = document.querySelector(`[data-tab="${tabName}"]`);
        if (tab) {
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
        }
        const content = document.getElementById(tabName);
        if (content) content.classList.add('active');

        if (tabName === 'exercises') renderExercises();
        if (tabName === 'log') { renderLogHistory(); updateLogForm(); }
        if (tabName === 'photos') renderPhotos();
    };

    window.startAndGo = function(tab) {
        if (!state.setup) {
            showOnboarding();
            window._pendingTab = tab;
        } else {
            showMainApp();
            showTab(tab);
        }
    };

    window.openShareFromLanding = function() {
        if (!state.setup) {
            showOnboarding();
            window._pendingTab = 'share';
        } else {
            openShareOptions();
        }
    };

    // ========== ONBOARDING ==========
    function initOnboarding() {
        const form = document.getElementById('onboarding-form');
        const startInput = document.getElementById('setup-start');
        startInput.value = new Date().toISOString().split('T')[0];

        let setupPain = null;
        document.querySelectorAll('#setup-pain-grid .pain-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('#setup-pain-grid .pain-btn').forEach(b => b.classList.remove('selected'));
                this.classList.add('selected');
                setupPain = parseInt(this.dataset.pain);
            });
        });

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const name = document.getElementById('setup-name').value.trim();
            const surgery = document.getElementById('setup-surgery').value.trim();
            const startDate = document.getElementById('setup-start').value;
            const totalDays = parseInt(document.getElementById('setup-days').value);

            if (!name || !startDate || !totalDays) {
                showToast('Please fill in your name and dates');
                return;
            }

            state.setup = {
                name: name,
                surgery: surgery || 'Surgery',
                startDate: startDate,
                totalDays: totalDays
            };

            if (setupPain) {
                state.painLogs.push({
                    id: Date.now(),
                    date: new Date().toISOString(),
                    pain: setupPain,
                    notes: '',
                    sleep: 'not rated'
                });
            }

            saveState();
            showMainApp();
            if (window._pendingTab) {
                showTab(window._pendingTab);
                if (window._pendingTab === 'share') openShareOptions();
                window._pendingTab = null;
            }
        });
    }

    // ========== DASHBOARD ==========
    function updateDashboard() {
        if (!state.setup) return;

        const currentDay = getCurrentDay();
        const daysLeft = getDaysLeft();
        const pct = getProgressPercent();
        const avg = getAvgPain();
        const streak = getRealStreak();
        const done = getCompletedExercisesCount();
        const todayLog = getTodayPainLog();

        document.getElementById('app-title').textContent = 'RecoverWell';
        document.getElementById('header-greeting').textContent =
            `Day ${currentDay} of your ${escapeHtml(state.setup.surgery)} recovery`;

        document.getElementById('badge-day').textContent = `Day ${currentDay}`;
        document.getElementById('progress-percent').textContent = `${pct}%`;

        const infoEl = document.getElementById('progress-info');
        const startDateFormatted = new Date(state.setup.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const endDate = new Date(state.setup.startDate);
        endDate.setDate(endDate.getDate() + state.setup.totalDays);
        const endDateFormatted = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        infoEl.innerHTML = `
            <div class="info-row"><span class="info-label">Started</span><span class="info-value">${escapeHtml(startDateFormatted)}</span></div>
            <div class="info-row"><span class="info-label">Target</span><span class="info-value">${escapeHtml(endDateFormatted)}</span></div>
            <div class="info-row"><span class="info-label">Days left</span><span class="info-value highlight-text">${daysLeft} days</span></div>
        `;

        document.getElementById('pain-avg').textContent = avg !== null ? avg : '—';
        document.getElementById('exercises-done').textContent = done;
        document.getElementById('streak').textContent = streak;

        document.getElementById('todo-exercise').className = done === state.exercises.length && state.exercises.length > 0 ? 'todo-check done' : 'todo-check';
        document.getElementById('todo-exercise-sub').textContent = `${done}/${state.exercises.length} completed`;
        document.getElementById('todo-pain').className = todayLog ? 'todo-check done' : 'todo-check';

        updateProgressRing(pct);
    }

    function updateProgressRing(pct) {
        const circ = 2 * Math.PI * 50;
        const offset = circ - (pct / 100) * circ;
        const ring = document.querySelector('.progress-ring-fill');
        if (ring) {
            ring.style.strokeDasharray = circ;
            ring.style.strokeDashoffset = offset;
        }
    }

    // ========== EXERCISES ==========
    window.showAddExercise = function() {
        document.getElementById('add-exercise-form').classList.remove('hidden');
        document.getElementById('new-exercise-name').focus();
    };

    window.hideAddExercise = function() {
        document.getElementById('add-exercise-form').classList.add('hidden');
        document.getElementById('new-exercise-name').value = '';
        document.getElementById('new-exercise-desc').value = '';
    };

    window.addExercise = function() {
        const name = document.getElementById('new-exercise-name').value.trim();
        const desc = document.getElementById('new-exercise-desc').value.trim();
        if (!name) {
            showToast('Enter an exercise name');
            return;
        }
        const maxId = state.exercises.reduce((max, e) => Math.max(max, e.id), 0);
        state.exercises.push({ id: maxId + 1, name: name, description: desc || 'Exercise', completed: false });
        saveState();
        hideAddExercise();
        renderExercises();
    };

    window.toggleExercise = function(id) {
        const ex = state.exercises.find(e => e.id === id);
        if (ex) {
            ex.completed = !ex.completed;
            saveState();
            renderExercises();
            updateDashboard();
        }
    };

    window.deleteExercise = function(id) {
        state.exercises = state.exercises.filter(e => e.id !== id);
        saveState();
        renderExercises();
    };

    function renderExercises() {
        const list = document.getElementById('exercise-list');
        const done = getCompletedExercisesCount();
        const total = state.exercises.length;

        list.innerHTML = state.exercises.map(ex => `
            <div class="exercise-item ${ex.completed ? 'completed' : ''}" role="listitem">
                <div class="exercise-check ${ex.completed ? 'checked' : ''}" role="checkbox" aria-checked="${ex.completed}" tabindex="0" aria-label="${escapeHtml(ex.name)}" onclick="toggleExercise(${ex.id})" onkeydown="if(event.key==='Enter'||event.key===' ')toggleExercise(${ex.id})"></div>
                <div class="exercise-info">
                    <h4>${escapeHtml(ex.name)}</h4>
                    <p>${escapeHtml(ex.description)}</p>
                </div>
                <button class="btn-icon-only" onclick="deleteExercise(${ex.id})" aria-label="Delete ${escapeHtml(ex.name)}">×</button>
            </div>
        `).join('');

        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        document.getElementById('exercise-progress-fill').style.width = `${pct}%`;
        document.getElementById('exercise-progress-text').textContent = `${done} of ${total} completed`;
        document.getElementById('exercise-progress-bar').setAttribute('aria-valuenow', pct);
        document.getElementById('exercise-complete-card').style.display = done === total && total > 0 ? 'block' : 'none';
    }

    // ========== LOG ==========
    function updateLogForm() {
        const todayLog = getTodayPainLog();
        document.querySelectorAll('#pain-grid .pain-btn').forEach(b => {
            b.classList.remove('selected');
            b.setAttribute('aria-checked', 'false');
        });
        document.getElementById('pain-description').textContent = 'Tap a number above';
        document.querySelectorAll('.sleep-btn').forEach(b => {
            b.classList.remove('selected');
            b.setAttribute('aria-checked', 'false');
        });
        document.getElementById('log-notes').value = todayLog ? (todayLog.notes || '') : '';
        document.getElementById('notes-char-count').textContent = `${(todayLog?.notes || '').length}/500`;
    }

    function initLogListeners() {
        let selectedPain = null;
        let selectedRating = null;

        document.querySelectorAll('#pain-grid .pain-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                selectedPain = parseInt(this.dataset.pain);
                document.querySelectorAll('#pain-grid .pain-btn').forEach(b => {
                    b.classList.remove('selected');
                    b.setAttribute('aria-checked', 'false');
                });
                this.classList.add('selected');
                this.setAttribute('aria-checked', 'true');
                document.getElementById('pain-description').textContent = getPainDescription(selectedPain);
            });
        });

        document.querySelectorAll('.sleep-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                selectedRating = this.dataset.rating;
                document.querySelectorAll('.sleep-btn').forEach(b => {
                    b.classList.remove('selected');
                    b.setAttribute('aria-checked', 'false');
                });
                this.classList.add('selected');
                this.setAttribute('aria-checked', 'true');
            });
        });

        document.getElementById('log-notes').addEventListener('input', function() {
            document.getElementById('notes-char-count').textContent = `${this.value.length}/500`;
        });

        document.getElementById('save-log').addEventListener('click', function() {
            if (!selectedPain) {
                document.getElementById('pain-grid').style.animation = 'shake 0.4s';
                setTimeout(() => document.getElementById('pain-grid').style.animation = '', 400);
                showToast('Please select a pain level');
                return;
            }

            const existingIndex = state.painLogs.findIndex(l => isToday(l.date));
            const log = {
                id: existingIndex >= 0 ? state.painLogs[existingIndex].id : Date.now(),
                date: new Date().toISOString(),
                pain: selectedPain,
                notes: document.getElementById('log-notes').value.trim().slice(0, 500),
                sleep: selectedRating || 'not rated'
            };

            if (existingIndex >= 0) {
                state.painLogs[existingIndex] = log;
            } else {
                state.painLogs.push(log);
            }

            saveState();
            renderLogHistory();
            updateDashboard();

            const btn = document.getElementById('save-log');
            btn.textContent = '✓ Saved!';
            btn.style.background = '#059669';
            setTimeout(() => {
                btn.textContent = '💾 Save Today\'s Log';
                btn.style.background = '';
            }, 1500);

            selectedPain = null;
            selectedRating = null;
            updateLogForm();
        });
    }

    function renderLogHistory() {
        const el = document.getElementById('log-history');
        const logs = state.viewAllLogs ? state.painLogs : state.painLogs.slice(0, 5);

        document.getElementById('view-all-logs').textContent = state.viewAllLogs ? 'Show Less' : 'View All';

        if (logs.length === 0) {
            el.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px;">No logs yet</p>';
            return;
        }

        el.innerHTML = logs.map(log => {
            const d = formatDate(log.date);
            const cls = log.pain <= 3 ? 'pain-low' : log.pain <= 6 ? 'pain-medium' : 'pain-high';
            const painText = log.pain <= 3 ? 'Low' : log.pain <= 6 ? 'Medium' : 'High';
            return `
                <div class="log-entry" role="listitem">
                    <div class="date">${escapeHtml(d)}</div>
                    <span class="pain ${cls}">Pain ${log.pain}/10 (${painText})</span>
                    ${log.sleep && log.sleep !== 'not rated' ? `<span class="log-sleep">Sleep: ${escapeHtml(log.sleep)}</span>` : ''}
                    ${log.notes ? `<p class="notes">${escapeHtml(log.notes)}</p>` : ''}
                    <button class="btn-delete-log" onclick="deleteLog(${log.id})" aria-label="Delete log from ${escapeHtml(d)}">Delete</button>
                </div>
            `;
        }).join('');
    }

    window.toggleAllLogs = function() {
        state.viewAllLogs = !state.viewAllLogs;
        renderLogHistory();
    };

    window.deleteLog = function(id) {
        state.painLogs = state.painLogs.filter(l => l.id !== id);
        saveState();
        renderLogHistory();
        updateDashboard();
        showToast('Log deleted');
    };

    // ========== PHOTOS ==========
    async function handlePhotoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file');
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            showToast('File too large (max 20MB)');
            return;
        }

        try {
            showToast('Compressing photo...');
            const compressed = await compressImage(file, 800, 0.7);
            const photo = {
                id: Date.now(),
                data: compressed,
                date: new Date().toISOString()
            };
            await savePhotoToDB(photo);
            await renderPhotos();
            showToast('Photo saved!');
        } catch (err) {
            console.error('Photo save failed:', err);
            showToast('Failed to save photo');
        }

        e.target.value = '';
    }

    async function renderPhotos() {
        const grid = document.getElementById('photo-grid');
        const empty = document.getElementById('photo-empty');

        objectURLs.forEach(url => URL.revokeObjectURL(url));
        objectURLs = [];

        try {
            const photos = await getPhotosFromDB();
            if (photos.length === 0) {
                empty.style.display = 'block';
                grid.innerHTML = '';
                return;
            }

            empty.style.display = 'none';
            grid.innerHTML = photos.map(p => {
                const d = formatDateShort(p.date);
                return `
                    <div class="photo-item" role="listitem">
                        <img src="${p.data}" alt="Progress photo from ${escapeHtml(d)}" loading="lazy">
                        <div class="photo-date">${escapeHtml(d)}</div>
                        <button class="btn-delete-photo" onclick="deletePhoto(${p.id})" aria-label="Delete photo from ${escapeHtml(d)}">🗑️</button>
                    </div>
                `;
            }).join('');
        } catch (e) {
            empty.style.display = 'block';
            grid.innerHTML = '';
        }
    }

    window.deletePhoto = async function(id) {
        if (!confirm('Delete this photo?')) return;
        await deletePhotoFromDB(id);
        await renderPhotos();
        showToast('Photo deleted');
    };

    // ========== REPORT & SHARING ==========
    function generateReportText() {
        if (!state.setup) return '';
        const currentDay = getCurrentDay();
        const avg = getAvgPain();
        const streak = getRealStreak();
        const done = getCompletedExercisesCount();

        let text = `RECOVERY REPORT\n`;
        text += `================\n\n`;
        text += `Patient: ${state.setup.name}\n`;
        text += `Procedure: ${state.setup.surgery}\n`;
        text += `Date: ${new Date().toLocaleDateString()}\n`;
        text += `Day ${currentDay} of ${state.setup.totalDays}\n\n`;
        text += `PAIN SUMMARY\n`;
        text += `Average: ${avg !== null ? avg + '/10' : 'No data'}\n`;
        text += `Total logs: ${state.painLogs.length}\n`;
        text += `Current streak: ${streak} days\n\n`;
        text += `EXERCISES TODAY\n`;
        text += `${done} of ${state.exercises.length} completed\n\n`;
        text += `RECENT LOGS\n`;

        const recent = state.painLogs.slice(0, 14);
        if (recent.length > 0) {
            recent.forEach(l => {
                text += `${formatDate(l.date)}: Pain ${l.pain}/10`;
                if (l.sleep && l.sleep !== 'not rated') text += ` | Sleep: ${l.sleep}`;
                if (l.notes) text += ` | ${l.notes}`;
                text += `\n`;
            });
        } else {
            text += `No logs recorded yet\n`;
        }

        text += `\nGenerated by RecoverWell\n`;
        return text;
    }

    function generateReportHTML() {
        if (!state.setup) return '';
        const currentDay = getCurrentDay();
        const avg = getAvgPain();
        const done = getCompletedExercisesCount();

        let html = `<h3>Recovery Report</h3>`;
        html += `<p><strong>${escapeHtml(state.setup.name)}</strong> — ${escapeHtml(state.setup.surgery)}</p>`;
        html += `<p>${new Date().toLocaleDateString()} — Day ${currentDay} of ${state.setup.totalDays}</p>`;
        html += `<hr>`;
        html += `<h4>Pain Summary</h4>`;
        html += `<p>Average: <strong>${avg !== null ? avg + '/10' : 'N/A'}</strong></p>`;
        html += `<p>Logs: <strong>${state.painLogs.length}</strong></p>`;
        html += `<hr>`;
        html += `<h4>Exercises Today</h4>`;
        html += `<p>${done} of ${state.exercises.length} completed</p>`;
        html += `<hr>`;
        html += `<h4>Recent Entries</h4>`;

        const recent = state.painLogs.slice(0, 7);
        if (recent.length > 0) {
            recent.forEach(l => {
                html += `<p>${formatDate(l.date)} — Pain ${l.pain}/10${l.notes ? ' · ' + escapeHtml(l.notes) : ''}</p>`;
            });
        } else {
            html += `<p>No entries yet</p>`;
        }

        html += `<hr><p><em>Generated by RecoverWell</em></p>`;
        return html;
    }

    window.openShareOptions = function() {
        state.lastReportText = generateReportText();
        document.getElementById('report-modal').classList.add('active');
        document.getElementById('report-preview').innerHTML = generateReportHTML();
    };

    window.closeModal = function() {
        document.getElementById('report-modal').classList.remove('active');
    };

    window.shareReport = function() {
        state.lastReportText = generateReportText();
        document.getElementById('report-modal').classList.remove('active');
        document.getElementById('share-options-modal').classList.add('active');
    };

    window.closeShareOptions = function() {
        document.getElementById('share-options-modal').classList.remove('active');
    };

    window.shareViaNative = async function() {
        const text = state.lastReportText || generateReportText();
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Recovery Report', text: text });
            } catch (e) {
                if (e.name !== 'AbortError') showToast('Share cancelled');
            }
        } else {
            showToast('Device sharing not available. Try clipboard.');
        }
        closeShareOptions();
    };

    window.copyReportToClipboard = async function() {
        const text = state.lastReportText || generateReportText();
        try {
            await navigator.clipboard.writeText(text);
            showToast('Report copied to clipboard!');
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('Report copied!');
        }
        closeShareOptions();
    };

    window.shareViaEmail = function() {
        const text = state.lastReportText || generateReportText();
        const subject = encodeURIComponent(`Recovery Report - ${state.setup ? state.setup.name : 'Patient'}`);
        const body = encodeURIComponent(text);
        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
        closeShareOptions();
    };

    window.downloadReportFile = function() {
        const text = state.lastReportText || generateReportText();
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        objectURLs.push(url);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recovery-report-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
            URL.revokeObjectURL(url);
            objectURLs = objectURLs.filter(u => u !== url);
        }, 1000);
        closeShareOptions();
        showToast('Report downloaded!');
    };

    // ========== SETTINGS ==========
    window.toggleSettings = function() {
        const panel = document.getElementById('settings-panel');
        panel.classList.toggle('hidden');
    };

    window.exportData = function() {
        const exportObj = {
            setup: state.setup,
            painLogs: state.painLogs,
            exercises: state.exercises,
            exportDate: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        objectURLs.push(url);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recoverwell-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
            URL.revokeObjectURL(url);
            objectURLs = objectURLs.filter(u => u !== url);
        }, 1000);
        showToast('Data exported!');
    };

    window.resetAllData = async function() {
        if (!confirm('This will delete ALL your data. Are you sure?')) return;
        if (!confirm('This cannot be undone. Delete everything?')) return;
        localStorage.removeItem('recoverwell_state');
        await clearPhotosFromDB();
        state = getDefaultState();
        document.getElementById('settings-panel').classList.add('hidden');
        showLanding();
        showToast('All data deleted');
    };

    document.getElementById('import-input').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            const data = safeParseJSON(ev.target.result);
            if (!data || !data.setup) {
                showToast('Invalid backup file');
                return;
            }
            state.setup = data.setup;
            state.painLogs = Array.isArray(data.painLogs) ? data.painLogs : [];
            state.exercises = Array.isArray(data.exercises) ? data.exercises : getDefaultState().exercises;
            saveState();
            showMainApp();
            showToast('Data imported!');
        };
        reader.onerror = function() { showToast('Failed to read file'); };
        reader.readAsText(file);
        e.target.value = '';
    });

    // ========== KEYBOARD NAVIGATION ==========
    function setupKeyboardNav() {
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                if (document.getElementById('share-options-modal').classList.contains('active')) {
                    closeShareOptions();
                } else if (document.getElementById('report-modal').classList.contains('active')) {
                    closeModal();
                } else if (!document.getElementById('settings-panel').classList.contains('hidden')) {
                    document.getElementById('settings-panel').classList.add('hidden');
                }
            }
        });
    }

    // ========== INIT ==========
    function init() {
        state = loadState();

        if (!state.setup) {
            showLanding();
            initOnboarding();
        } else {
            const exercisesDone = getCompletedExercisesCount();
            const todayLog = getTodayPainLog();
            if (exercisesDone > 0 || todayLog) {
                state.exercises.forEach(e => e.completed = false);
                saveState();
            }
            showLanding();
            document.getElementById('continue-btn').style.display = 'block';
        }

        document.getElementById('photo-input').addEventListener('change', handlePhotoUpload);
        initLogListeners();
        setupKeyboardNav();

        if (!isLocalStorageAvailable()) {
            showToast('Storage unavailable. Data won\'t persist.');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
