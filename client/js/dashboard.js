import { getStats, getOperativos, deleteOperativo, deleteAllOperativos, getOperativo } from './api.js';
import { formatDate, showToast, generateReportText, copyToClipboard } from './utils.js';

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
            labels: ['Actas Simples', 'Retención Docs', 'Alcoholemia (+)', 'Ruido Molesto'],
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

// Attach history event listeners
function attachHistoryListeners() {
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
        ['Retención Documentos', retencionAuto, retencionMoto],
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

    // Recent Operations
    if (filteredOperativos.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('ÚLTIMOS OPERATIVOS', 15, yPosition);
        yPosition += 10;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        const recentOps = filteredOperativos.slice(0, 5);
        recentOps.forEach((op, idx) => {
            const fecha = op.fecha || 'Sin fecha';
            const lugar = op.lugar || 'Sin ubicación';
            const vehiculos = op.vehiculos_controlados_total || 0;
            const alcohol = (Number(op.alcoholemia_positiva_auto) || 0) +
                (Number(op.alcoholemia_positiva_moto) || 0);

            doc.text(`${idx + 1}. ${fecha} - ${lugar}`, 20, yPosition);
            doc.text(`Vehículos: ${vehiculos} | Alcoholemias: ${alcohol}`, 120, yPosition);
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

// Setup clear all button
export function setupClearAllButton() {
    document.getElementById('btn-clear-all').addEventListener('click', async () => {
        if (confirm('⚠️ ¿Eliminar TODOS los operativos? Esta acción no se puede deshacer.')) {
            try {
                await deleteAllOperativos();
                showToast('🗑️ Todos los operativos eliminados', 'success');
                await initDashboard();
            } catch (error) {
                showToast('Error al limpiar datos', 'error');
            }
        }
    });
}
