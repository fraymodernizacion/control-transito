import { createOperativo } from './api.js';
import { getTodayDate, showToast } from './utils.js';
import { initDashboard } from './dashboard.js';

// Initialize form
export function initForm() {
    // Set default date to today
    document.getElementById('fecha').value = getTodayDate();

    // Setup counter buttons
    setupCounterButtons();

    // Setup form submission
    setupFormSubmission();
}

// Setup counter buttons
function setupCounterButtons() {
    // Hero counter buttons (main vehicle counter)
    document.querySelectorAll('.hero-btn[data-field]').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const action = btn.dataset.action;
            const input = document.getElementById(field);
            let value = parseInt(input.value) || 0;

            if (action === 'plus') {
                value++;
            } else if (action === 'minus' && value > 0) {
                value--;
            }

            input.value = value;
        });
    });

    // Mini counter buttons (all card counters)
    document.querySelectorAll('.counter-mini-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const isPlus = btn.classList.contains('plus');
            const input = document.getElementById(field);
            let value = parseInt(input.value) || 0;

            if (isPlus) {
                value++;
            } else if (value > 0) {
                value--;
            }

            input.value = value;
        });
    });

    // Legacy selectors for backward compatibility
    document.querySelectorAll('.counter-btn[data-field]').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const action = btn.dataset.action;
            const input = document.getElementById(field);
            let value = parseInt(input.value) || 0;

            if (action === 'plus') {
                value++;
            } else if (action === 'minus' && value > 0) {
                value--;
            }

            input.value = value;
        });
    });

    document.querySelectorAll('.counter-btn-mini').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const isPlus = btn.classList.contains('plus');
            const input = document.getElementById(field);
            let value = parseInt(input.value) || 0;

            if (isPlus) {
                value++;
            } else if (value > 0) {
                value--;
            }

            input.value = value;
        });
    });
}

// Setup form submission
function setupFormSubmission() {
    const form = document.getElementById('operativo-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Disable button while saving
        const submitBtn = form.querySelector('.save-btn, .btn-primary');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
        }

        const formData = new FormData(form);
        const data = {
            fecha: formData.get('fecha'),
            lugar: formData.get('lugar'),
            hora_inicio: formData.get('hora_inicio'),
            hora_fin: formData.get('hora_fin'),
            personal: formData.get('personal'),
            vehiculos_controlados_total: parseInt(formData.get('vehiculos_controlados_total')) || 0,
            actas_simples_auto: parseInt(formData.get('actas_simples_auto')) || 0,
            actas_simples_moto: parseInt(formData.get('actas_simples_moto')) || 0,
            retencion_doc_auto: parseInt(formData.get('retencion_doc_auto')) || 0,
            retencion_doc_moto: parseInt(formData.get('retencion_doc_moto')) || 0,
            alcoholemia_positiva_auto: parseInt(formData.get('alcoholemia_positiva_auto')) || 0,
            alcoholemia_positiva_moto: parseInt(formData.get('alcoholemia_positiva_moto')) || 0,
            actas_ruido_auto: parseInt(formData.get('actas_ruido_auto')) || 0,
            actas_ruido_moto: parseInt(formData.get('actas_ruido_moto')) || 0,
            maxima_graduacion_gl: parseFloat(formData.get('maxima_graduacion_gl')) || 0
        };

        try {
            await createOperativo(data);
            showToast('✅ Operativo guardado', 'success');

            // Reset form
            resetForm();

            // Switch to dashboard
            document.querySelector('[data-view="dashboard"]').click();

            // Refresh dashboard
            await initDashboard();
        } catch (error) {
            showToast('❌ Error al guardar', 'error');
            console.error('Error:', error);
        } finally {
            // Re-enable button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            }
        }
    });
}

// Reset form to default values
function resetForm() {
    const form = document.getElementById('operativo-form');
    form.reset();

    // Reset date to today
    document.getElementById('fecha').value = getTodayDate();

    // Reset all number inputs to 0
    form.querySelectorAll('input[type="number"]').forEach(input => {
        input.value = '0';
    });

    // Close details section if open
    const details = form.querySelector('.form-details');
    if (details) {
        details.removeAttribute('open');
    }
}

// Export reset function for external use
export { resetForm };
