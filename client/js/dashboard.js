import { getStats, getOperativos, deleteOperativo, getOperativo } from './api.js';
import { formatDate, showToast, generateReportText, copyToClipboard } from './utils.js';
import { editOperativo } from './form.js';

let infraccionesChart = null;
let vehiculosChart = null;
let allOperativos = [];
let filteredOperativos = [];
let currentFilters = { dateFrom: null, dateTo: null, vehicle: 'all' };

// Initialize dashboard
export async function initDashboard() {
    try {
        // Load all data
        console.log('initDashboard started');
        console.log('kpi-vehiculos exists:', !!document.getElementById('kpi-vehiculos'));
        console.log('chart-infracciones exists:', !!document.getElementById('chart-infracciones'));
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

        // Setup modal close listener (only once)
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
        total_faltas_camion: 0,
        total_faltas_camioneta: 0,
        total_faltas_colectivo: 0,
        tasa_positividad: 0
    };

    const vehicleTypes = ['auto', 'moto', 'camion', 'camioneta', 'colectivo'];

    filteredOperativos.forEach(op => {
        stats.total_vehiculos += Number(op.vehiculos_controlados_total) || 0;

        vehicleTypes.forEach(vh => {
            const isSelected = currentFilters.vehicle === 'all' || currentFilters.vehicle === vh;

            const alcoholemia = Number(op[`alcoholemia_positiva_${vh}`]) || 0;
            const actasSimples = Number(op[`actas_simples_${vh}`]) || 0;
            const retencion = Number(op[`retencion_doc_${vh}`]) || 0;
            const ruido = Number(op[`actas_ruido_${vh}`]) || 0;

            const totalVh = alcoholemia + actasSimples + retencion + ruido;
            stats[`total_faltas_${vh}`] += totalVh;

            if (isSelected) {
                stats.total_alcoholemia += alcoholemia;
                stats.total_actas_simples += actasSimples;
                stats.total_retenciones += retencion;
                stats.total_ruidos += ruido;
            }
        });
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

    const elements = {
        'kpi-vehiculos': stats.total_vehiculos.toLocaleString(),
        'kpi-alcoholemia': stats.total_alcoholemia.toLocaleString(),
        'kpi-actas': stats.total_faltas.toLocaleString(),
        'kpi-tasa': `${stats.tasa_positividad}%`
    };

    Object.entries(elements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        } else {
            console.warn(`Element with id "${id}" not found`);
        }
    });
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
        motos: '#10b981',
        camion: '#6366f1',
        camioneta: '#a855f7',
        colectivo: '#ec4899'
    };

    // Infracciones Donut Chart
    const infraccionesCtx = document.getElementById('chart-infracciones').getContext('2d');
    const hasInfracciones = stats.total_actas_simples || stats.total_retenciones ||
        stats.total_alcoholemia || stats.total_ruidos;

    infraccionesChart = new Chart(infraccionesCtx, {
        type: 'doughnut',
        data: {
            labels: ['Actas Simples', 'Retención por doc', 'Alcoholemia (+)', 'Ruido Molesto'],
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

    const chartData = [
        stats.total_faltas_auto,
        stats.total_faltas_moto,
        stats.total_faltas_camion,
        stats.total_faltas_camioneta,
        stats.total_faltas_colectivo
    ];

    vehiculosChart = new Chart(vehiculosCtx, {
        type: 'bar',
        data: {
            labels: ['Autos', 'Motos', 'Camiones', 'Camionetas', 'Colectivos'],
            datasets: [{
                label: 'Total Faltas',
                data: chartData,
                backgroundColor: [colors.autos, colors.motos, colors.camion, colors.camioneta, colors.colectivo],
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
                    ticks: { color: '#94a3b8', font: { weight: 600 }, font: { size: 9 } }
                }
            }
        }
    });
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

    // Sort by date (newest first) before rendering
    const sortedOperativos = [...filteredOperativos].sort((a, b) => {
        return parseDate(b.fecha) - parseDate(a.fecha);
    });

    historyList.innerHTML = sortedOperativos.map(op => {
        const vehicleTypes = ['auto', 'moto', 'camion', 'camioneta', 'colectivo'];
        let totalAlcohol = 0;
        vehicleTypes.forEach(vh => {
            totalAlcohol += (Number(op[`alcoholemia_positiva_${vh}`]) || 0);
        });

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
          <button class="history-btn edit" title="Modificar operativo" data-id="${op.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
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

// Attach history event listeners
function attachHistoryListeners() {
    document.querySelectorAll('.history-btn.edit').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            try {
                btn.classList.add('loading');
                const operativo = await getOperativo(id);
                editOperativo(operativo);
            } catch (error) {
                showToast('Error al cargar operativo', 'error');
            } finally {
                btn.classList.remove('loading');
            }
        });
    });

    document.querySelectorAll('.history-btn.copy').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            try {
                const operativo = await getOperativo(id);
                const reportText = generateReportText(operativo);
                const success = await copyToClipboard(reportText);
                if (success) {
                    showToast('📋 Reporte copiado', 'success');
                } else {
                    showToast('Error al copiar', 'error');
                }
            } catch (error) {
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
                    btn.classList.add('loading');
                    await deleteOperativo(id);
                    showToast('🗑️ Operativo eliminado', 'success');
                    await initDashboard();
                } catch (error) {
                    showToast('Error al eliminar', 'error');
                } finally {
                    btn.classList.remove('loading');
                }
            }
        });
    });

    // Detail click
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', async () => {
            const id = item.dataset.id;
            try {
                // Add a small delay for better UX if needed or just fetch
                const operativo = await getOperativo(id);
                showDetail(operativo);
            } catch (error) {
                showToast('Error al cargar detalle', 'error');
            }
        });
    });
}

// Show detail modal
function showDetail(operativo) {
    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalSubtitle = document.getElementById('modal-subtitle');
    const modalBody = document.getElementById('modal-body');

    if (!modal || !modalBody) return;

    modalTitle.textContent = `${operativo.lugar || 'Sin ubicación'}`;
    modalSubtitle.textContent = formatDate(operativo.fecha);

    const vehicleTypes = ['auto', 'moto', 'camion', 'camioneta', 'colectivo'];
    const vehicleLabels = { auto: 'Auto', moto: 'Moto', camion: 'Camión', camioneta: 'Camioneta', colectivo: 'Colectivo' };

    let statsHtml = '';

    vehicleTypes.forEach(vh => {
        const simples = Number(operativo[`actas_simples_${vh}`]) || 0;
        const docs = Number(operativo[`retencion_doc_${vh}`]) || 0;
        const alcohol = Number(operativo[`alcoholemia_positiva_${vh}`]) || 0;
        const ruidos = Number(operativo[`actas_ruido_${vh}`]) || 0;

        if (simples || docs || alcohol || ruidos) {
            statsHtml += `
                <div class="detail-vehicle-card">
                    <div class="detail-vehicle-header">
                        <strong>${vehicleLabels[vh]}</strong>
                    </div>
                    <div class="detail-vehicle-grid">
                        <div class="detail-stat"><span>Actas:</span> <strong>${simples}</strong></div>
                        <div class="detail-stat"><span>Docs:</span> <strong>${docs}</strong></div>
                        <div class="detail-stat"><span>Alc (+):</span> <strong>${alcohol}</strong></div>
                        <div class="detail-stat"><span>Ruido:</span> <strong>${ruidos}</strong></div>
                    </div>
                </div>
            `;
        }
    });

    modalBody.innerHTML = `
        <div class="detail-header-stats">
            <div class="detail-h-item"><span>Inicio:</span> ${operativo.hora_inicio || '--:--'}</div>
            <div class="detail-h-item"><span>Fin:</span> ${operativo.hora_fin || '--:--'}</div>
            <div class="detail-h-item"><span>Personal:</span> ${operativo.personal || '-'}</div>
            <div class="detail-h-item"><span>Controlados:</span> <strong>${operativo.vehiculos_controlados_total || 0}</strong></div>
        </div>
        <div class="detail-vehicles-container">
            ${statsHtml || '<p class="detail-empty">No se registraron infracciones.</p>'}
        </div>
        ${operativo.maxima_graduacion_gl > 0 ? `
            <div class="detail-alcohol-max">
                🍺 Máxima Graduación: <strong>${operativo.maxima_graduacion_gl} g/L</strong>
            </div>
        ` : ''}
    `;

    // Setup buttons
    document.getElementById('modal-btn-copy').onclick = () => {
        const text = generateReportText(operativo);
        copyToClipboard(text);
        showToast('📋 Reporte copiado', 'success');
    };

    document.getElementById('modal-btn-edit').onclick = () => {
        modal.classList.remove('active');
        editOperativo(operativo);
    };

    modal.classList.add('active');
}

// Setup modal close listeners
function setupModalListeners() {
    const modal = document.getElementById('detail-modal');
    const closeBtn = document.getElementById('modal-close');
    const overlay = modal?.querySelector('.modal-overlay');

    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.remove('active');
    }
    if (overlay) {
        overlay.onclick = () => modal.classList.remove('active');
    }
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

    // Load and add color logo
    try {
        const logoImg = await loadImage('img/logo-color.png');
        doc.addImage(logoImg, 'PNG', 15, 10, 45, 22);
        yPosition = 42;
    } catch (e) {
        console.log('Logo not loaded:', e);
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

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    // Table header
    doc.setFillColor(100, 116, 139);
    doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Categoría', 20, yPosition);
    doc.text('Autos', 70, yPosition);
    doc.text('Motos', 95, yPosition);
    doc.text('Camiones', 120, yPosition);
    doc.text('Camionetas', 145, yPosition);
    doc.text('Colectivos', 175, yPosition);
    yPosition += 8;

    doc.setTextColor(0, 0, 0);

    const vehicleTypes = ['auto', 'moto', 'camion', 'camioneta', 'colectivo'];
    const categories = [
        { id: 'actas_simples', label: 'Actas Simples' },
        { id: 'retencion_doc', label: 'Retención por doc' },
        { id: 'alcoholemia_positiva', label: 'Alcoholemia (+)' },
        { id: 'actas_ruido', label: 'Ruido Molesto' }
    ];

    categories.forEach((cat, idx) => {
        if (idx % 2 === 0) {
            doc.setFillColor(241, 245, 249);
            doc.rect(15, yPosition - 5, pageWidth - 30, 7, 'F');
        }

        doc.text(cat.label, 20, yPosition);

        let startX = 70;
        vehicleTypes.forEach(vh => {
            let count = 0;
            filteredOperativos.forEach(op => {
                count += Number(op[`${cat.id}_${vh}`]) || 0;
            });
            doc.text(count.toString(), startX, yPosition);
            startX += 25;
            if (vh === 'camioneta') startX += 5; // Extra space for Camionetas label offset
        });

        yPosition += 7;
    });

    yPosition += 15;

    // Recent Operations
    if (filteredOperativos.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('ÚLTIMOS OPERATIVOS', 15, yPosition);
        yPosition += 10;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        const sortedOps = [...filteredOperativos].sort((a, b) => parseDate(b.fecha) - parseDate(a.fecha));
        sortedOps.forEach((op, idx) => {
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
            }
            const fecha = op.fecha || 'Sin fecha';
            const lugar = op.lugar || 'Sin ubicación';
            const vehiculos = op.vehiculos_controlados_total || 0;

            let alcohol = 0;
            vehicleTypes.forEach(vh => {
                alcohol += (Number(op[`alcoholemia_positiva_${vh}`]) || 0);
            });

            doc.text(`${idx + 1}. ${fecha} - ${lugar}`, 20, yPosition);
            doc.text(`Vehículos: ${vehiculos} | Alcoholemias: ${alcohol}`, 140, yPosition);
            yPosition += 6;
        });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Sistema de Control de Tránsito - Municipalidad', pageWidth / 2, pageHeight - 10, { align: 'center' });

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


