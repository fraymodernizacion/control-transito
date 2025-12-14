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
    // Large counter buttons
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

            // Add visual feedback
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 100);
        });
    });

    // Mini counter buttons (sanctions grid)
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

            // Add visual feedback
            btn.style.transform = 'scale(0.9)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 100);
        });
    });
}

// Setup form submission
function setupFormSubmission() {
    const form = document.getElementById('operativo-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

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
            showToast('✅ Operativo guardado exitosamente', 'success');

            // Reset form
            resetForm();

            // Switch to dashboard
            document.querySelector('[data-view="dashboard"]').click();

            // Refresh dashboard
            await initDashboard();
        } catch (error) {
            showToast('❌ Error al guardar operativo', 'error');
            console.error('Error:', error);
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
}

// Export reset function for external use
export { resetForm };
