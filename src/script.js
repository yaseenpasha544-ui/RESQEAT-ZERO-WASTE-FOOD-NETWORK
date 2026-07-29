// ============================================
// Storage helper — falls back to in-memory if
// localStorage is unavailable (e.g. sandboxed
// preview contexts)
// ============================================
const memoryStore = {};
const storage = {
    get(key) {
        try { return localStorage.getItem(key); }
        catch (e) { return memoryStore[key] ?? null; }
    },
    set(key, value) {
        try { localStorage.setItem(key, value); }
        catch (e) { memoryStore[key] = value; }
    }
};

// ============================================
// Theme Toggle
// ============================================
function toggleTheme() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    storage.set('resqeat-theme', isDark ? 'dark' : 'light');
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}

function applySavedTheme() {
    if (storage.get('resqeat-theme') === 'dark') {
        document.body.classList.add('dark');
    }
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
}

// ============================================
// Loading Screen
// ============================================
function hideLoadingScreen() {
    const loading = document.getElementById('loading-screen');
    if (!loading || loading.dataset.hidden) return;
    loading.dataset.hidden = 'true';
    loading.style.opacity = '0';
    loading.style.visibility = 'hidden';
    setTimeout(() => { loading.style.display = 'none'; }, 800);
}

function initApp() {
    applySavedTheme();
    initDonations();
    initSlider();
    initScrollReveal();
    initCounters();
    setTimeout(hideLoadingScreen, 700);
}

// Run as soon as the DOM is parsed — don't wait on
// external resources (fonts, images) to finish loading,
// since that can hang in offline/sandboxed previews.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Hard safety net: no matter what, the loader is gone within 3s.
setTimeout(hideLoadingScreen, 3000);

// ============================================
// Donations System
// ============================================
let donations = [
    { id: 1, business: "Fresh Harvest Bakery", item: "Warm Croissants & Bread", qty: 6.5, hours: 5, location: "Downtown" },
    { id: 2, business: "Green Valley Groceries", item: "Organic Veggies Box", qty: 18, hours: 8, location: "East Side" },
    { id: 3, business: "Spice of Life", item: "Freshly Cooked Meals", qty: 12, hours: 4, location: "Central Market" }
];

let activeFilter = 'all';
const MAX_HOURS = 48;

function urgencyColor(hours) {
    if (hours <= 4) return 'var(--urgent)';
    if (hours <= 12) return '#E0A93E';
    return 'var(--sage)';
}

function ringMarkup(hours) {
    const radius = 22;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.max(0, Math.min(1, hours / MAX_HOURS));
    const offset = circumference * (1 - pct);
    const color = urgencyColor(hours);
    return `
        <div class="ring-wrap">
            <svg width="52" height="52">
                <circle class="ring-bg" cx="26" cy="26" r="${radius}"></circle>
                <circle class="ring-fg" cx="26" cy="26" r="${radius}"
                    style="stroke-dasharray:${circumference};stroke-dashoffset:${offset};stroke:${color};"></circle>
            </svg>
            <div class="ring-label">${hours}h</div>
        </div>
    `;
}

function renderDonations(list) {
    const container = document.getElementById('donations-container');
    if (!container) return;
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">🍽️</div>
                <p>No donations match right now — check back soon, or be the first to post one.</p>
            </div>
        `;
        return;
    }

    list.forEach((d, i) => {
        const card = document.createElement('div');
        card.className = 'donation-card';
        card.style.animationDelay = `${i * 0.06}s`;
        card.innerHTML = `
            <div class="card-header">
                <strong>${escapeHtml(d.business)}</strong>
                ${ringMarkup(d.hours)}
            </div>
            <div class="card-body">
                <h3>${escapeHtml(d.item)}</h3>
                <div class="card-meta">
                    <span>⚖️ ${d.qty} kg</span>
                    <span>📍 ${escapeHtml(d.location)}</span>
                </div>
                <span class="countdown-tag">⏳ ${d.hours}h left</span>
                <button onclick="claimDonation(${d.id})" class="claim-btn" style="margin-top:1rem;">Claim This Food 🍲</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function initDonations() {
    const saved = storage.get('resqeat-donations');
    if (saved) {
        try { donations = JSON.parse(saved); } catch (e) { /* keep defaults */ }
    }
    applyFiltersAndRender();
}

function getFilteredList() {
    const term = (document.getElementById('search-input')?.value || '').toLowerCase();
    let list = donations.filter(d =>
        d.business.toLowerCase().includes(term) ||
        d.item.toLowerCase().includes(term) ||
        d.location.toLowerCase().includes(term)
    );

    if (activeFilter === 'urgent') {
        list = list.filter(d => d.hours <= 4);
    } else if (activeFilter === 'soon') {
        list = [...list].sort((a, b) => a.hours - b.hours);
    }

    return list;
}

function applyFiltersAndRender() {
    renderDonations(getFilteredList());
}

function filterDonations() {
    applyFiltersAndRender();
}

function setFilter(filter, btnEl) {
    activeFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    applyFiltersAndRender();
}

function submitDonation(e) {
    e.preventDefault();
    const business = document.getElementById('business').value.trim();
    const item = document.getElementById('item').value.trim();
    const qty = parseFloat(document.getElementById('qty').value);
    const hours = parseInt(document.getElementById('hours').value, 10);
    const location = document.getElementById('loc').value.trim();

    if (!business || !item || !qty || !hours || !location) {
        showToast('Please fill in every field 🌱', 'warn');
        return;
    }

    const newDonation = { id: Date.now(), business, item, qty, hours, location };
    donations.unshift(newDonation);
    storage.set('resqeat-donations', JSON.stringify(donations));

    applyFiltersAndRender();
    e.target.reset();
    document.getElementById('hours').value = 6;
    showToast(`Donation posted — ${business} is now live on the feed.`, 'success');
    navigateToSection('claim');
}

function claimDonation(id) {
    const d = donations.find(x => x.id === id);
    if (!d) return;
    if (confirm(`Claim "${d.item}" from ${d.business}?`)) {
        donations = donations.filter(x => x.id !== id);
        storage.set('resqeat-donations', JSON.stringify(donations));
        applyFiltersAndRender();
        showToast(`Claimed! ${d.item} is on its way to someone in need. 🎉`, 'success');
    }
}

// ============================================
// Toasts
// ============================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) { alert(message); return; }

    const icon = type === 'success' ? '✅' : '⚠️';
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('leaving');
        setTimeout(() => toast.remove(), 350);
    }, 3200);
}

// ============================================
// Navigation
// ============================================
function navigateToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function toggleMobileNav() {
    const links = document.querySelector('.nav-links');
    if (!links) return;
    const isOpen = links.style.display === 'flex';
    links.style.display = isOpen ? 'none' : 'flex';
    links.style.flexDirection = 'column';
    links.style.position = 'absolute';
    links.style.top = '100%';
    links.style.left = '0';
    links.style.right = '0';
    links.style.background = 'var(--paper)';
    links.style.padding = '1rem 2rem';
    links.style.borderTop = '1px solid var(--line)';
}

// ============================================
// Impact Slider
// ============================================
let currentSlide = 0;

function initSlider() {
    const slidesWrap = document.getElementById('slides');
    const dotsWrap = document.getElementById('slider-dots');
    if (!slidesWrap || !dotsWrap) return;

    const count = slidesWrap.children.length;
    dotsWrap.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const dot = document.createElement('button');
        dot.className = 'dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
        dot.onclick = () => goToSlide(i);
        dotsWrap.appendChild(dot);
    }

    setInterval(() => changeSlide(1), 5000);
}

function updateSlidePosition() {
    const slidesWrap = document.getElementById('slides');
    if (!slidesWrap) return;
    slidesWrap.style.transform = `translateX(-${currentSlide * 100}%)`;
    document.querySelectorAll('.dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
    });
}

function changeSlide(direction) {
    const slidesWrap = document.getElementById('slides');
    if (!slidesWrap) return;
    const count = slidesWrap.children.length;
    currentSlide = (currentSlide + direction + count) % count;
    updateSlidePosition();
}

function goToSlide(i) {
    currentSlide = i;
    updateSlidePosition();
}

// ============================================
// Scroll Reveal
// ============================================
function initScrollReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
        items.forEach(el => el.classList.add('in-view'));
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    items.forEach(el => observer.observe(el));
}

// ============================================
// Animated Counters
// ============================================
function initCounters() {
    const counters = document.querySelectorAll('[data-count]');
    if (counters.length === 0) return;

    if (!('IntersectionObserver' in window)) {
        counters.forEach(el => {
            el.textContent = el.dataset.count + (el.dataset.suffix || '');
        });
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(el => observer.observe(el));
}

function animateCounter(el) {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const duration = 1400;
    const start = performance.now();

    function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.floor(target * eased);
        el.textContent = value.toLocaleString() + suffix;
        if (progress < 1) requestAnimationFrame(tick);
        else el.textContent = target.toLocaleString() + suffix;
    }
    requestAnimationFrame(tick);
}

// ============================================
// Keyboard Support
// ============================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const links = document.querySelector('.nav-links');
        if (links && window.innerWidth <= 860) links.style.display = 'none';
    }
});
