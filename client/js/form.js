import { createOperativo, updateOperativo } from './api.js?v=5';
import { getTodayDate, showToast } from './utils.js?v=5';
import { initDashboard } from './dashboard.js?v=5';

let editingId = null;

// Initialize form
export function initForm() {
    // Set default date to today
    const fechaEl = document.getElementById('fecha');
    if (fechaEl) {
        fechaEl.value = getTodayDate();
    } else {
        console.warn('Element with id "fecha" not found');
    }

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

    // Checkbox selected class helper
    document.querySelectorAll('.checkbox-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const container = checkbox.closest('.checkbox-item');
            if (container) container.classList.toggle('selected', checkbox.checked);
        });
    });
}

// Update summary in real-time
function updateSummary() {
    const getValue = (id) => parseInt(document.getElementById(id)?.value) || 0;

    // Vehicles
    const vehiculos = getValue('vehiculos_controlados_total');

    // Total faults
    const vehicleTypes = ['auto', 'moto', 'camion', 'camioneta', 'colectivo'];
    let faltas = 0;
    let alcohol = 0;

    vehicleTypes.forEach(vh => {
        faltas += getValue(`actas_simples_${vh}`) +
            getValue(`retencion_doc_${vh}`) +
            getValue(`alcoholemia_positiva_${vh}`) +
            getValue(`actas_ruido_${vh}`);

        alcohol += getValue(`alcoholemia_positiva_${vh}`);
    });

    const safeUpdate = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    safeUpdate('summary-vehiculos', vehiculos);
    safeUpdate('summary-faltas', faltas);
    safeUpdate('summary-alcohol', alcohol);
}

// Setup form submission
function setupFormSubmission() {
    const form = document.getElementById('operativo-form');
    const submitBtn = document.getElementById('submit-btn');

    if (!form || !submitBtn) {
        console.warn('Form elements "operativo-form" or "submit-btn" not found');
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Show loading state
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        const formData = new FormData(form);

        // Get selected areas as comma-separated string
        const areasCheckboxes = form.querySelectorAll('input[name="areas_involucradas"]:checked');
        const areasInvolucradas = Array.from(areasCheckboxes).map(cb => cb.value).join(', ');

        const personal_gu = parseInt(formData.get('personal_guardia_urbana')) || 0;
        const personal_tr = parseInt(formData.get('personal_transito')) || 0;
        const personal_br = parseInt(formData.get('personal_bromatologia')) || 0;

        const data = {
            fecha: formData.get('fecha'),
            lugar: formData.get('lugar'),
            hora_inicio: formData.get('hora_inicio'),
            hora_fin: formData.get('hora_fin'),
            areas_involucradas: areasInvolucradas,
            personal_guardia_urbana: personal_gu,
            personal_transito: personal_tr,
            personal_bromatologia: personal_br,
            personal: personal_gu + personal_tr + personal_br,
            vehiculos_controlados_total: parseInt(formData.get('vehiculos_controlados_total')) || 0,
            maxima_graduacion_gl: parseFloat(formData.get('maxima_graduacion_gl')) || 0
        };

        const vehicleTypes = ['auto', 'moto', 'camion', 'camioneta', 'colectivo'];
        const categories = ['actas_simples', 'retencion_doc', 'alcoholemia_positiva', 'actas_ruido'];

        categories.forEach(cat => {
            vehicleTypes.forEach(vh => {
                const fieldName = `${cat}_${vh}`;
                data[fieldName] = parseInt(formData.get(fieldName)) || 0;
            });
        });

        try {
            if (editingId) {
                await updateOperativo(editingId, data);
                showToast('✅ Operativo actualizado', 'success');
            } else {
                await createOperativo(data);
                showToast('✅ Operativo guardado', 'success');
            }

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

// Populate form for editing
export function editOperativo(operativo) {
    editingId = operativo.id;
    const form = document.getElementById('operativo-form');
    if (!form) return;

    // Fill the form
    Object.keys(operativo).forEach(key => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) {
            // Check if it's a date or time field
            if (key === 'fecha') {
                // If it's a date object or ISO string, format it
                try {
                    const date = new Date(operativo[key]);
                    if (!isNaN(date)) {
                        input.value = date.toISOString().split('T')[0];
                    } else {
                        input.value = operativo[key];
                    }
                } catch (e) {
                    input.value = operativo[key];
                }
            } else if (key === 'areas_involucradas') {
                const areas = operativo[key] ? operativo[key].split(', ') : [];
                form.querySelectorAll('input[name="areas_involucradas"]').forEach(cb => {
                    cb.checked = areas.includes(cb.value);
                    const container = cb.closest('.checkbox-item');
                    if (container) container.classList.toggle('selected', cb.checked);
                });
            } else {
                input.value = operativo[key];
            }
        }
    });

    // Update submit button text
    const submitBtnText = document.querySelector('.submit-btn-text');
    if (submitBtnText) {
        submitBtnText.textContent = '✓ Actualizar Operativo';
    }

    // Scroll to top of the view
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Switch to form view
    document.querySelector('[data-view="form"]').click();

    updateSummary();
}

// Reset form to default values
export function resetForm() {
    const form = document.getElementById('operativo-form');
    if (!form) return;
    form.reset();

    editingId = null;

    // Reset submit button text
    const submitBtnText = document.querySelector('.submit-btn-text');
    if (submitBtnText) {
        submitBtnText.textContent = '✓ Guardar Operativo';
    }

    // Reset date to today
    document.getElementById('fecha').value = getTodayDate();

    // Reset all number inputs to 0
    form.querySelectorAll('input[type="number"]').forEach(input => {
        input.value = '0';
    });

    // Reset areas checkboxes
    form.querySelectorAll('input[name="areas_involucradas"]').forEach(cb => {
        cb.checked = false;
        const container = cb.closest('.checkbox-item');
        if (container) container.classList.remove('selected');
    });

    // Update summary
    updateSummary();
}
