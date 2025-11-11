// Application State
const state = {
    user: null,
    individuals: [],
    filteredIndividuals: [],
    translations: {},
    currentLang: 'es',
    sortField: null,
    sortDirection: 'asc'
};

// Field definitions for table columns
const FIELDS = [
    'id', 'id_osakidetza', 'id_clinic', 'name', 'last_names',
    'dni', 'birth_date', 'age', 'gender', 'prion_disease',
    'mutation', 'death_date', 'symptoms', 'samples'
];

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    try {
        // Load translations
        await loadTranslations();

        // Check if user is already logged in
        const user = await checkAuth();
        if (user) {
            state.user = user;
            state.currentLang = user.lang || 'es';
            showApp();
        } else {
            showLogin();
        }

        // Setup event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Initialization error:', error);
        showLogin();
    }
}

// Load translations from server
async function loadTranslations() {
    try {
        const response = await fetch('/api/translations');
        const data = await response.json();
        if (data.success) {
            state.translations = data.translations;
        }
    } catch (error) {
        console.error('Error loading translations:', error);
    }
}

// Check if user is authenticated
async function checkAuth() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const data = await response.json();
            return data.user;
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Language selector
    const langSelect = document.getElementById('language');
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            state.currentLang = e.target.value;
            updateLoginTexts();
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    // Clear search button
    const clearSearchBtn = document.getElementById('btn-clear-search');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', clearSearch);
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const language = document.getElementById('language').value;

    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = '';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            state.user = data.user;
            state.currentLang = data.user.lang || language;
            showApp();
        } else {
            errorDiv.textContent = translate('login.error');
        }
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = translate('login.error');
    }
}

// Handle logout
async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        state.user = null;
        state.individuals = [];
        state.filteredIndividuals = [];
        showLogin();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Handle search
function handleSearch(e) {
    const query = e.target.value.trim().toLowerCase();

    if (!query) {
        state.filteredIndividuals = [...state.individuals];
    } else {
        state.filteredIndividuals = state.individuals.filter(individual => {
            return Object.values(individual).some(value => {
                if (value === null || value === undefined) return false;
                return String(value).toLowerCase().includes(query);
            });
        });
    }

    renderTable();
    updateSearchResultsCount();
}

// Clear search
function clearSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.value = '';
    state.filteredIndividuals = [...state.individuals];
    renderTable();
    updateSearchResultsCount();
}

// Load individuals data
async function loadIndividuals() {
    showLoading();

    try {
        const response = await fetch('/api/individuals');
        const data = await response.json();

        if (data.success) {
            state.individuals = data.data;
            state.filteredIndividuals = [...data.data];
            renderTable();
            updateSearchResultsCount();
        } else {
            showNoResults();
        }
    } catch (error) {
        console.error('Error loading individuals:', error);
        showNoResults();
    } finally {
        hideLoading();
    }
}

// Render table
function renderTable() {
    const tableHeaders = document.getElementById('table-headers');
    const tableBody = document.getElementById('table-body');

    // Clear existing content
    tableHeaders.innerHTML = '';
    tableBody.innerHTML = '';

    if (state.filteredIndividuals.length === 0) {
        showNoResults();
        return;
    }

    hideNoResults();

    // Render headers
    FIELDS.forEach(field => {
        const th = document.createElement('th');
        th.textContent = translate(`table.${field}`);
        th.dataset.field = field;
        th.classList.add('sortable');

        if (state.sortField === field) {
            th.classList.add(state.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        }

        th.addEventListener('click', () => handleSort(field));
        tableHeaders.appendChild(th);
    });

    // Render rows
    state.filteredIndividuals.forEach(individual => {
        const tr = document.createElement('tr');

        FIELDS.forEach(field => {
            const td = document.createElement('td');
            let value = individual[field] || '';

            // Special formatting
            if (field === 'id' || field === 'id_osakidetza') {
                td.classList.add('cell-id');
            } else if (field === 'samples') {
                if (value.toLowerCase() === 'yes' || value.toLowerCase() === 'sí') {
                    td.classList.add('cell-samples-yes');
                    value = '✓';
                } else {
                    td.classList.add('cell-samples-no');
                    value = '—';
                }
            } else if (field === 'gender') {
                value = translate(`gender.${value}`) || value;
            }

            // Check if value is a URL
            if (isURL(value)) {
                const link = document.createElement('a');
                link.href = value;
                link.textContent = value;
                link.target = '_blank';
                link.classList.add('cell-link');
                td.appendChild(link);
            } else {
                td.textContent = value;
            }

            tr.appendChild(td);
        });

        tableBody.appendChild(tr);
    });
}

// Handle sorting
function handleSort(field) {
    if (state.sortField === field) {
        // Toggle direction
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortField = field;
        state.sortDirection = 'asc';
    }

    sortIndividuals();
    renderTable();
}

// Sort individuals
function sortIndividuals() {
    state.filteredIndividuals.sort((a, b) => {
        let aVal = a[state.sortField] || '';
        let bVal = b[state.sortField] || '';

        // Try to parse as numbers
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);

        if (!isNaN(aNum) && !isNaN(bNum)) {
            return state.sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // String comparison
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();

        if (state.sortDirection === 'asc') {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
    });
}

// Update search results count
function updateSearchResultsCount() {
    const countDiv = document.getElementById('search-results-count');
    const count = state.filteredIndividuals.length;
    const total = state.individuals.length;

    if (count === total) {
        countDiv.textContent = `${count} ${translate('search.results')}`;
    } else {
        countDiv.textContent = `${count} / ${total} ${translate('search.results')}`;
    }
}

// Show/hide screens
function showLogin() {
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
    updateLoginTexts();
}

function showApp() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    updateAppTexts();
    loadIndividuals();
}

// Update UI texts
function updateLoginTexts() {
    document.getElementById('login-title').textContent = translate('app.title');
    document.getElementById('login-subtitle').textContent = translate('app.subtitle');
    document.getElementById('label-username').textContent = translate('login.username');
    document.getElementById('label-password').textContent = translate('login.password');
    document.getElementById('label-language').textContent = translate('login.language');
    document.getElementById('btn-login').textContent = translate('login.submit');
}

function updateAppTexts() {
    document.getElementById('app-title').textContent = translate('app.title');
    document.getElementById('btn-logout').textContent = translate('nav.logout');

    const searchInput = document.getElementById('search-input');
    searchInput.placeholder = translate('search.placeholder');

    const userInfo = document.getElementById('user-info');
    if (state.user) {
        userInfo.textContent = `${translate('login.welcome')}, ${state.user.full_name}`;
    }
}

// Translation helper
function translate(key) {
    const keys = key.split('.');
    let value = state.translations[state.currentLang];

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return key;
        }
    }

    return value || key;
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function isURL(str) {
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showNoResults() {
    document.getElementById('no-results').classList.remove('hidden');
}

function hideNoResults() {
    document.getElementById('no-results').classList.add('hidden');
}
