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

    // Initial summary update
    updateSummary();
}

// Setup counter buttons
function setupCounterButtons() {
    // Big counter buttons (vehicles)
    document.querySelectorAll('.big-counter-btn').forEach(btn => {
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
            updateSummary();
        });
    });

    // Mini counter buttons (infractions)
    document.querySelectorAll('.mini-counter-btn').forEach(btn => {
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
            updateSummary();
        });
    });

    // Listen for manual input changes
    document.querySelectorAll('#operativo-form input[type="number"]').forEach(input => {
        input.addEventListener('change', updateSummary);
        input.addEventListener('input', updateSummary);
    });
}

// Update summary in real-time
function updateSummary() {
    const getValue = (id) => parseInt(document.getElementById(id)?.value) || 0;

    // Vehicles
    const vehiculos = getValue('vehiculos_controlados_total');
    document.getElementById('summary-vehiculos').textContent = vehiculos;

    // Total faults
    const faltas =
        getValue('actas_simples_auto') + getValue('actas_simples_moto') +
        getValue('retencion_doc_auto') + getValue('retencion_doc_moto') +
        getValue('alcoholemia_positiva_auto') + getValue('alcoholemia_positiva_moto') +
        getValue('actas_ruido_auto') + getValue('actas_ruido_moto');
    document.getElementById('summary-faltas').textContent = faltas;

    // Alcoholemia
    const alcohol = getValue('alcoholemia_positiva_auto') + getValue('alcoholemia_positiva_moto');
    document.getElementById('summary-alcohol').textContent = alcohol;
}

// Setup form submission
function setupFormSubmission() {
    const form = document.getElementById('operativo-form');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Show loading state
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        const formData = new FormData(form);

        // Get selected areas as comma-separated string
        const areasCheckboxes = form.querySelectorAll('input[name="areas_involucradas"]:checked');
        const areasInvolucradas = Array.from(areasCheckboxes).map(cb => cb.value).join(', ');

        const data = {
            fecha: formData.get('fecha'),
            lugar: formData.get('lugar'),
            hora_inicio: formData.get('hora_inicio'),
            hora_fin: formData.get('hora_fin'),
            areas_involucradas: areasInvolucradas,
            personal_guardia_urbana: parseInt(formData.get('personal_guardia_urbana')) || 0,
            personal_transito: parseInt(formData.get('personal_transito')) || 0,
            personal_bromatologia: parseInt(formData.get('personal_bromatologia')) || 0,
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
            // Remove loading state
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
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

    // Update summary
    updateSummary();
}

// Export reset function
export { resetForm };
