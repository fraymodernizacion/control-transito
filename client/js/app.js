import { initDashboard } from './dashboard.js';
import { initForm } from './form.js';

// App initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize navigation
    initNavigation();

    // Initialize dashboard
    await initDashboard();

    // Initialize form
    initForm();

    // Register service worker
    registerServiceWorker();
});

// Navigation handling
function initNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    const views = document.querySelectorAll('.view');

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const viewId = tab.dataset.view;

            // Update active tab
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update active view
            views.forEach(v => v.classList.remove('active'));
            document.getElementById(`${viewId}-view`).classList.add('active');

            // Refresh dashboard when switching to it
            if (viewId === 'dashboard') {
                initDashboard();
            }
        });
    });
}

// Register service worker for PWA
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('ServiceWorker registered:', registration.scope);
        } catch (error) {
            console.log('ServiceWorker registration failed:', error);
        }
    }
}
