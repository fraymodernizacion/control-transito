import { initDashboard } from './dashboard.js?v=5';
import { initForm, resetForm } from './form.js?v=5';

// App initialization
async function startApp() {
    if (window.isAppInitialized) return;

    // Check if critical elements are present
    const criticalElements = ['dashboard-view', 'form-view', 'fecha', 'operativo-form'];
    const missingElements = criticalElements.filter(id => !document.getElementById(id));

    if (missingElements.length > 0) {
        console.warn('Waiting for elements to be ready:', missingElements);
        setTimeout(startApp, 100); // Try again in 100ms
        return;
    }

    window.isAppInitialized = true;
    console.log('DOM ready, starting initialization...');

    // Initialize navigation
    initNavigation();

    // Initialize dashboard (await data load)
    await initDashboard();

    // Initialize form
    initForm();

    // Register service worker
    registerServiceWorker();
}

// Start when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

// Navigation handling
function initNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    const views = document.querySelectorAll('.view');

    navTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const viewId = tab.dataset.view;

            // If clicking "Nuevo" tab manually, ensuring form is fresh
            if (viewId === 'form' && e.isTrusted) {
                resetForm();
            }

            // Update active tab
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update active view
            views.forEach(v => v.classList.remove('active'));
            const targetView = document.getElementById(`${viewId}-view`);
            if (targetView) targetView.classList.add('active');

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
