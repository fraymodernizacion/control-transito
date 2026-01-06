import { getStats, getOperativos, deleteOperativo, deleteAllOperativos } from './api.js';
import { formatDate, formatTime, showToast, generateReportText, copyToClipboard } from './utils.js';

let infraccionesChart = null;
let vehiculosChart = null;
let allOperativos = [];
let filteredOperativos = [];
let currentFilters = { dateFrom: null, dateTo: null, vehicle: 'all' };

// Initialize dashboard
export async function initDashboard() {
    try {
        // Load all data
        allOperativos = await getOperativos();

        // Set default date range (last 30 days)
        const today = new Date();
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);

        const dateFromInput = document.getElementById('filter-date-from');
        const dateToInput = document.getElementById('filter-date-to');

        if (dateFromInput && !dateFromInput.value) {
            dateFromInput.value = monthAgo.toISOString().split('T')[0];
        }
        if (dateToInput && !dateToInput.value) {
            dateToInput.value = today.toISOString().split('T')[0];
        }

        // Apply filters
        applyFilters();

        // Setup filter listeners (only once)
        setupFilterListeners();

        // Setup modal listeners (only once)
        setupModalListeners();
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Setup filter event listeners
function setupFilterListeners() {
    const dateFromInput = document.getElementById('filter-date-from');
    const dateToInput = document.getElementById('filter-date-to');
    const vehicleFilter = document.getElementById('filter-vehicle');
    const exportBtn = document.getElementById('btn-export');

    if (dateFromInput && !dateFromInput.dataset.initialized) {
        dateFromInput.addEventListener('change', applyFilters);
        dateFromInput.dataset.initialized = 'true';
    }

    if (dateToInput && !dateToInput.dataset.initialized) {
        dateToInput.addEventListener('change', applyFilters);
        dateToInput.dataset.initialized = 'true';
    }

    if (vehicleFilter && !vehicleFilter.dataset.initialized) {
        vehicleFilter.addEventListener('change', (e) => {
            currentFilters.vehicle = e.target.value;
            applyFilters();
        });
        vehicleFilter.dataset.initialized = 'true';
    }

    if (exportBtn && !exportBtn.dataset.initialized) {
        exportBtn.addEventListener('click', exportData);
        exportBtn.dataset.initialized = 'true';
    }

    // Today button
    const todayBtn = document.getElementById('btn-today');
    if (todayBtn && !todayBtn.dataset.initialized) {
        todayBtn.addEventListener('click', () => {
            const todayStr = new Date().toISOString().split('T')[0];
            const dateFromInput = document.getElementById('filter-date-from');
            const dateToInput = document.getElementById('filter-date-to');

            if (dateFromInput) dateFromInput.value = todayStr;
            if (dateToInput) dateToInput.value = todayStr;

            applyFilters();
            showToast('📅 Mostrando operativos de hoy', 'success');
        });
        todayBtn.dataset.initialized = 'true';
    }

    // Refresh button
    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn && !refreshBtn.dataset.initialized) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('refreshing');
            try {
                await initDashboard();
                showToast('🔄 Datos actualizados', 'success');
            } catch (error) {
                showToast('Error al actualizar', 'error');
            } finally {
                setTimeout(() => refreshBtn.classList.remove('refreshing'), 1000);
            }
        });
        refreshBtn.dataset.initialized = 'true';
    }
}

// Apply current filters
function applyFilters() {
    const dateFromInput = document.getElementById('filter-date-from');
    const dateToInput = document.getElementById('filter-date-to');
    const vehicleFilter = document.getElementById('filter-vehicle');

    const dateFrom = dateFromInput?.value ? new Date(dateFromInput.value + 'T00:00:00') : null;
    const dateTo = dateToInput?.value ? new Date(dateToInput.value + 'T23:59:59') : null;
    currentFilters.vehicle = vehicleFilter?.value || 'all';

    filteredOperativos = allOperativos.filter(op => {
        const opDate = parseDate(op.fecha);

        // Date range filter
        if (dateFrom && opDate < dateFrom) return false;
        if (dateTo && opDate > dateTo) return false;

        return true;
    });

    // Render everything with filtered data
    renderKPIs();
    renderCharts();
    renderHistory();
}

// Parse date from various formats
function parseDate(dateStr) {
    if (!dateStr) return new Date(0);

    if (typeof dateStr === 'string') {
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return new Date(dateStr + 'T12:00:00');
        } else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            const [day, month, year] = dateStr.split('/');
            return new Date(year, month - 1, day);
        } else if (dateStr.includes('T')) {
            return new Date(dateStr);
        }
    } else if (typeof dateStr === 'number') {
        return new Date((dateStr - 25569) * 86400 * 1000);
    }

    return new Date(dateStr);
}

// Calculate stats from filtered data
function calculateStats() {
    const stats = {
        total_vehiculos: 0,
        total_alcoholemia: 0,
        total_faltas: 0,
        total_actas_simples: 0,
        total_retenciones: 0,
        total_ruidos: 0,
        total_faltas_auto: 0,
        total_faltas_moto: 0,
        tasa_positividad: 0
    };

    filteredOperativos.forEach(op => {
        // Apply vehicle filter
        const includeAuto = currentFilters.vehicle === 'all' || currentFilters.vehicle === 'auto';
        const includeMoto = currentFilters.vehicle === 'all' || currentFilters.vehicle === 'moto';

        stats.total_vehiculos += Number(op.vehiculos_controlados_total) || 0;

        if (includeAuto) {
            stats.total_alcoholemia += Number(op.alcoholemia_positiva_auto) || 0;
            stats.total_actas_simples += Number(op.actas_simples_auto) || 0;
            stats.total_retenciones += Number(op.retencion_doc_auto) || 0;
            stats.total_ruidos += Number(op.actas_ruido_auto) || 0;
            stats.total_faltas_auto +=
                (Number(op.actas_simples_auto) || 0) +
                (Number(op.retencion_doc_auto) || 0) +
                (Number(op.alcoholemia_positiva_auto) || 0) +
                (Number(op.actas_ruido_auto) || 0);
        }

        if (includeMoto) {
            stats.total_alcoholemia += Number(op.alcoholemia_positiva_moto) || 0;
            stats.total_actas_simples += Number(op.actas_simples_moto) || 0;
            stats.total_retenciones += Number(op.retencion_doc_moto) || 0;
            stats.total_ruidos += Number(op.actas_ruido_moto) || 0;
            stats.total_faltas_moto +=
                (Number(op.actas_simples_moto) || 0) +
                (Number(op.retencion_doc_moto) || 0) +
                (Number(op.alcoholemia_positiva_moto) || 0) +
                (Number(op.actas_ruido_moto) || 0);
        }
    });

    stats.total_faltas = stats.total_actas_simples + stats.total_retenciones +
        stats.total_alcoholemia + stats.total_ruidos;

    stats.tasa_positividad = stats.total_vehiculos > 0
        ? ((stats.total_alcoholemia / stats.total_vehiculos) * 100).toFixed(1)
        : 0;

    return stats;
}

// Render KPIs
function renderKPIs() {
    const stats = calculateStats();

    document.getElementById('kpi-vehiculos').textContent = stats.total_vehiculos.toLocaleString();
    document.getElementById('kpi-alcoholemia').textContent = stats.total_alcoholemia.toLocaleString();
    document.getElementById('kpi-actas').textContent = stats.total_faltas.toLocaleString();
    document.getElementById('kpi-tasa').textContent = `${stats.tasa_positividad}%`;
}

// Render charts
function renderCharts() {
    const stats = calculateStats();

    // Destroy existing charts
    if (infraccionesChart) infraccionesChart.destroy();
    if (vehiculosChart) vehiculosChart.destroy();

    const colors = {
        actas: '#3b82f6',
        retenciones: '#8b5cf6',
        alcoholemia: '#ef4444',
        ruidos: '#f59e0b',
        autos: '#06b6d4',
        motos: '#10b981'
    };

    // Infracciones Donut Chart
    const infraccionesCtx = document.getElementById('chart-infracciones').getContext('2d');
    const hasInfracciones = stats.total_actas_simples || stats.total_retenciones ||
        stats.total_alcoholemia || stats.total_ruidos;

    infraccionesChart = new Chart(infraccionesCtx, {
        type: 'doughnut',
        data: {
            labels: ['Actas Simples', 'Retención de documentación', 'Alcoholemia (+)', 'Ruido Molesto'],
            datasets: [{
                data: hasInfracciones
                    ? [stats.total_actas_simples, stats.total_retenciones, stats.total_alcoholemia, stats.total_ruidos]
                    : [1, 1, 1, 1],
                backgroundColor: hasInfracciones
                    ? [colors.actas, colors.retenciones, colors.alcoholemia, colors.ruidos]
                    : ['#334155', '#334155', '#334155', '#334155'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        padding: 12,
                        font: { size: 10 },
                        usePointStyle: true
                    }
                },
                tooltip: { enabled: hasInfracciones }
            }
        }
    });

    // Vehiculos Bar Chart with datalabels
    const vehiculosCtx = document.getElementById('chart-vehiculos').getContext('2d');

    vehiculosChart = new Chart(vehiculosCtx, {
        type: 'bar',
        data: {
            labels: ['Autos', 'Motos'],
            datasets: [{
                label: 'Total Faltas',
                data: [stats.total_faltas_auto, stats.total_faltas_moto],
                backgroundColor: [colors.autos, colors.motos],
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#64748b' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { weight: 600 } }
                }
            }
        }
    });

    // Redraw charts on resize to fix mobile orientation changes
    window.addEventListener('resize', () => {
        if (infraccionesChart) infraccionesChart.resize();
        if (vehiculosChart) vehiculosChart.resize();
    }, { passive: true });
}

// Render history
function renderHistory() {
    const historyList = document.getElementById('history-list');

    if (filteredOperativos.length === 0) {
        historyList.innerHTML = `
      <div class="history-empty">
        <span class="history-empty-icon">📭</span>
        <p>No hay operativos registrados</p>
      </div>
    `;
        return;
    }

    const recentOperativos = filteredOperativos.slice(0, 10);

    historyList.innerHTML = recentOperativos.map(op => {
        const totalAlcohol = (Number(op.alcoholemia_positiva_auto) || 0) +
            (Number(op.alcoholemia_positiva_moto) || 0);
        return `
      <div class="history-item" data-id="${op.id}">
        <div class="history-item-info">
          <span class="history-item-date">${formatDate(op.fecha)}</span>
          <span class="history-item-lugar">${op.lugar || 'Sin ubicación especificada'}</span>
        </div>
        <div class="history-item-stats">
          <div class="history-stat">
            <span class="history-stat-value">${op.vehiculos_controlados_total || 0}</span>
            <span class="history-stat-label">🚗</span>
          </div>
          <div class="history-stat">
            <span class="history-stat-value">${totalAlcohol}</span>
            <span class="history-stat-label">🍺</span>
          </div>
        </div>
        <div class="history-item-actions">
          <button class="history-btn copy" title="Copiar reporte" data-id="${op.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          </button>
          <button class="history-btn delete" title="Eliminar operativo" data-id="${op.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    }).join('');

    attachHistoryListeners();
}

// Setup modal event listeners
function setupModalListeners() {
    const modal = document.getElementById('details-modal');
    const closeBtn = document.getElementById('btn-close-details');
    const overlay = modal.querySelector('.modal-overlay');

    if (!modal.dataset.initialized) {
        closeBtn.addEventListener('click', closeDetailsModal);
        overlay.addEventListener('click', closeDetailsModal);

        // Share button in modal
        const shareBtn = document.getElementById('btn-share-modal');
        shareBtn.addEventListener('click', async () => {
            const id = modal.dataset.currentId;
            const operativo = allOperativos.find(op => String(op.id) === String(id));
            if (operativo) {
                const reportText = generateReportText(operativo);
                const success = await copyToClipboard(reportText);
                if (success) {
                    const originalText = shareBtn.innerHTML;
                    shareBtn.innerHTML = '<span>✅ ¡Copiado!</span>';
                    shareBtn.classList.add('copied-wide');

                    showToast('📋 ¡Copiado para compartir!', 'success');

                    setTimeout(() => {
                        shareBtn.innerHTML = originalText;
                        shareBtn.classList.remove('copied-wide');
                    }, 2000);
                }
            }
        });

        modal.dataset.initialized = 'true';
    }
}

// Open details modal
function openDetailsModal(op) {
    const modal = document.getElementById('details-modal');
    const body = document.getElementById('details-body');
    const title = document.getElementById('details-subtitle');

    modal.dataset.currentId = op.id;
    title.textContent = `${formatDate(op.fecha)} — ${op.lugar || 'Sin ubicación'}`;

    // Prepare areas badges
    const areas = (op.areas_involucradas || '').split(',').filter(a => a.trim());
    const areasHtml = areas.length
        ? `<div class="detail-badge-list">${areas.map(a => `<span class="detail-badge">${a.trim()}</span>`).join('')}</div>`
        : '<span class="detail-value">No especificadas</span>';

    // Build personal string
    const personal = [];
    if (op.personal_guardia_urbana > 0) personal.push(`${op.personal_guardia_urbana} Guardia Urbana`);
    if (op.personal_transito > 0) personal.push(`${op.personal_transito} Tránsito`);
    if (op.personal_bromatologia > 0) personal.push(`${op.personal_bromatologia} Bromatología`);
    const personalStr = personal.join(', ') || 'Sin personal registrado';

    const totalFaltas = (Number(op.actas_simples_auto) || 0) + (Number(op.actas_simples_moto) || 0) +
        (Number(op.retencion_doc_auto) || 0) + (Number(op.retencion_doc_moto) || 0) +
        (Number(op.alcoholemia_positiva_auto) || 0) + (Number(op.alcoholemia_positiva_moto) || 0) +
        (Number(op.actas_ruido_auto) || 0) + (Number(op.actas_ruido_moto) || 0);

    body.innerHTML = `
        <div class="detail-grid">
            <section class="detail-section">
                <h3 class="detail-section-title">Información General</h3>
                <div class="detail-card">
                    <div class="detail-row">
                        <span class="detail-label">Horario</span>
                        <span class="detail-value">${formatTime(op.hora_inicio) || '--:--'} a ${formatTime(op.hora_fin) || '--:--'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Vehículos Controlados</span>
                        <span class="detail-value highlight">${op.vehiculos_controlados_total || 0}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total Infracciones</span>
                        <span class="detail-value">${totalFaltas}</span>
                    </div>
                </div>
            </section>

            <section class="detail-section">
                <h3 class="detail-section-title">Áreas y Personal</h3>
                <div class="detail-card">
                    <div class="detail-row" style="flex-direction: column; align-items: flex-start; gap: 8px;">
                        <span class="detail-label">Áreas Involucradas</span>
                        ${areasHtml}
                    </div>
                    <div class="detail-row" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                        <span class="detail-label">Personal Municipal</span>
                        <span class="detail-value">${personalStr}</span>
                    </div>
                </div>
            </section>

            <section class="detail-section">
                <h3 class="detail-section-title">Infracciones Detalladas</h3>
                <div class="detail-card">
                    <div class="detail-row">
                        <span class="detail-label">Alcoholemias (+)</span>
                        <span class="detail-value danger">${(Number(op.alcoholemia_positiva_auto) || 0) + (Number(op.alcoholemia_positiva_moto) || 0)}</span>
                    </div>
                    ${op.maxima_graduacion_gl > 0 ? `
                    <div class="detail-row">
                        <span class="detail-label">Máx. Graduación</span>
                        <span class="detail-value danger">${op.maxima_graduacion_gl} g/L</span>
                    </div>
                    ` : ''}
                    <div class="detail-row">
                        <span class="detail-label">Actas Simples (A/M)</span>
                        <span class="detail-value">${op.actas_simples_auto || 0} / ${op.actas_simples_moto || 0}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Retenciones (A/M)</span>
                        <span class="detail-value">${op.retencion_doc_auto || 0} / ${op.retencion_doc_moto || 0}</span>
                    </div>
                     <div class="detail-row">
                        <span class="detail-label">Ruidos Molestos (A/M)</span>
                        <span class="detail-value">${op.actas_ruido_auto || 0} / ${op.actas_ruido_moto || 0}</span>
                    </div>
                </div>
            </section>
        </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scroll
}

// Close details modal
function closeDetailsModal() {
    const modal = document.getElementById('details-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Attach history event listeners
function attachHistoryListeners() {
    // Click on item to open details
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.id;
            const operativo = allOperativos.find(op => String(op.id) === String(id));
            if (operativo) {
                openDetailsModal(operativo);
            }
        });
    });

    document.querySelectorAll('.history-btn.copy').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            try {
                // Use cached data instead of API call
                const operativo = allOperativos.find(op => String(op.id) === String(id));
                if (!operativo) {
                    showToast('Operativo no encontrado', 'error');
                    return;
                }
                const reportText = generateReportText(operativo);
                const success = await copyToClipboard(reportText);
                if (success) {
                    // Add visual feedback animation
                    btn.classList.add('copied');
                    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M5 13l4 4L19 7"/>
                    </svg>`;
                    showToast('📋 ¡Copiado al portapapeles!', 'success');

                    // Reset button after animation
                    setTimeout(() => {
                        btn.classList.remove('copied');
                        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>`;
                    }, 1500);
                } else {
                    showToast('Error al copiar', 'error');
                }
            } catch (error) {
                console.error('Copy error:', error);
                showToast('Error al generar reporte', 'error');
            }
        });
    });

    document.querySelectorAll('.history-btn.delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (confirm('¿Eliminar este operativo?')) {
                try {
                    await deleteOperativo(id);
                    showToast('🗑️ Operativo eliminado', 'success');
                    await initDashboard();
                } catch (error) {
                    showToast('Error al eliminar', 'error');
                }
            }
        });
    });
}

// Export to PDF
async function exportData() {
    const stats = calculateStats();
    const { jsPDF } = window.jspdf;

    // Get date range
    const dateFromInput = document.getElementById('filter-date-from');
    const dateToInput = document.getElementById('filter-date-to');
    const dateFrom = dateFromInput?.value || 'Inicio';
    const dateTo = dateToInput?.value || 'Fin';

    // Create PDF (A4 size)
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Load and add color logo (maintaining aspect ratio)
    try {
        const logoImg = await loadImage('img/logo-color.png');
        // Get image dimensions to maintain aspect ratio
        const img = new Image();
        img.src = logoImg;
        const aspectRatio = img.width / img.height;
        const logoHeight = 25;
        const logoWidth = logoHeight * aspectRatio;
        doc.addImage(logoImg, 'PNG', 15, 10, logoWidth, logoHeight);

        // Add organization legend next to logo
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text('Secretaría de Gobierno', pageWidth - 15, 18, { align: 'right' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Municipalidad de Fray Mamerto Esquiú', pageWidth - 15, 25, { align: 'right' });
        doc.setTextColor(0, 0, 0);

        yPosition = 45;
    } catch (e) {
        console.log('Logo not loaded:', e);
        // Still add the legend even without logo
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text('Secretaría de Gobierno', pageWidth - 15, 18, { align: 'right' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Municipalidad de Fray Mamerto Esquiú', pageWidth - 15, 25, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        yPosition = 35;
    }

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORME DE CONTROL VEHICULAR', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    // Date range
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${dateFrom} al ${dateTo}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;

    // Generation date
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    const today = new Date().toLocaleDateString('es-AR', {
        day: '2-digit', month: 'long', year: 'numeric'
    });
    doc.text(`Generado: ${today}`, pageWidth / 2, yPosition, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    yPosition += 12;

    // Summary Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN GENERAL', 15, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    const summaryData = [
        ['Total Vehículos Controlados:', stats.total_vehiculos.toString()],
        ['Total Actas/Faltas:', stats.total_faltas.toString()],
        ['Alcoholemias Positivas:', stats.total_alcoholemia.toString()],
        ['Tasa de Positividad:', `${stats.tasa_positividad}%`],
        ['Operativos Registrados:', filteredOperativos.length.toString()]
    ];

    summaryData.forEach(([label, value]) => {
        doc.text(label, 20, yPosition);
        doc.setFont('helvetica', 'bold');
        doc.text(value, 90, yPosition);
        doc.setFont('helvetica', 'normal');
        yPosition += 7;
    });

    yPosition += 10;

    // Breakdown Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DESGLOSE POR TIPO', 15, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Table header
    doc.setFillColor(100, 116, 139);
    doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Tipo de Infracción', 20, yPosition);
    doc.text('Autos', 100, yPosition);
    doc.text('Motos', 130, yPosition);
    doc.text('Total', 160, yPosition);
    yPosition += 8;

    doc.setTextColor(0, 0, 0);

    // Calculate per-type totals
    let actasAuto = 0, actasMoto = 0;
    let retencionAuto = 0, retencionMoto = 0;
    let alcoholAuto = 0, alcoholMoto = 0;
    let ruidoAuto = 0, ruidoMoto = 0;

    filteredOperativos.forEach(op => {
        actasAuto += Number(op.actas_simples_auto) || 0;
        actasMoto += Number(op.actas_simples_moto) || 0;
        retencionAuto += Number(op.retencion_doc_auto) || 0;
        retencionMoto += Number(op.retencion_doc_moto) || 0;
        alcoholAuto += Number(op.alcoholemia_positiva_auto) || 0;
        alcoholMoto += Number(op.alcoholemia_positiva_moto) || 0;
        ruidoAuto += Number(op.actas_ruido_auto) || 0;
        ruidoMoto += Number(op.actas_ruido_moto) || 0;
    });

    const tableRows = [
        ['Actas Simples', actasAuto, actasMoto],
        ['Retención de documentación', retencionAuto, retencionMoto],
        ['Alcoholemia Positiva', alcoholAuto, alcoholMoto],
        ['Ruido Molesto', ruidoAuto, ruidoMoto]
    ];

    tableRows.forEach(([tipo, autos, motos], idx) => {
        if (idx % 2 === 0) {
            doc.setFillColor(241, 245, 249);
            doc.rect(15, yPosition - 5, pageWidth - 30, 7, 'F');
        }
        doc.text(tipo, 20, yPosition);
        doc.text(autos.toString(), 100, yPosition);
        doc.text(motos.toString(), 130, yPosition);
        doc.text((autos + motos).toString(), 160, yPosition);
        yPosition += 7;
    });

    yPosition += 15;

    // Recent Operations with more details
    if (filteredOperativos.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('DETALLE DE OPERATIVOS', 15, yPosition);
        yPosition += 10;

        const recentOps = filteredOperativos.slice(0, 8);
        recentOps.forEach((op, idx) => {
            // Check if we need a new page
            if (yPosition > 260) {
                doc.addPage();
                yPosition = 20;
            }

            const fecha = op.fecha || 'Sin fecha';
            const lugar = op.lugar || 'Sin ubicación';
            const horario = `${formatTime(op.hora_inicio) || '--:--'} - ${formatTime(op.hora_fin) || '--:--'}`;
            const vehiculos = op.vehiculos_controlados_total || 0;
            const alcohol = (Number(op.alcoholemia_positiva_auto) || 0) +
                (Number(op.alcoholemia_positiva_moto) || 0);
            const graduacion = op.maxima_graduacion_gl || 0;
            const areas = op.areas_involucradas || 'No especificadas';

            // Operation header
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setFillColor(241, 245, 249);
            doc.rect(15, yPosition - 4, pageWidth - 30, 7, 'F');
            doc.text(`${idx + 1}. ${fecha} - ${lugar}`, 20, yPosition);
            doc.setFont('helvetica', 'normal');
            doc.text(`🕐 ${horario}`, pageWidth - 50, yPosition);
            yPosition += 8;

            // Details
            doc.setFontSize(9);
            doc.text(`Áreas: ${areas}`, 25, yPosition);
            yPosition += 5;

            let detailLine = `Vehículos: ${vehiculos} | Alcoholemias: ${alcohol}`;
            if (graduacion > 0) {
                detailLine += ` | Máx. Graduación: ${graduacion} g/L`;
            }
            doc.text(detailLine, 25, yPosition);
            yPosition += 8;
        });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Sistema de Control de Tránsito - Secretaría de Gobierno - Municipalidad de Fray Mamerto Esquiú', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Download
    doc.save(`informe_transito_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('📄 PDF descargado', 'success');
}

// Load image as base64
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = src;
    });
}

