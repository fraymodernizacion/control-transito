import { getStats, getOperativos, deleteOperativo, deleteAllOperativos, getOperativo } from './api.js';
import { formatDate, showToast, generateReportText, copyToClipboard } from './utils.js';

let infraccionesChart = null;
let vehiculosChart = null;
let allOperativos = [];
let filteredOperativos = [];
let currentFilters = { date: 'all', vehicle: 'all' };

// Initialize dashboard
export async function initDashboard() {
    try {
        // Load all data
        allOperativos = await getOperativos();

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
    const dateFilter = document.getElementById('filter-date');
    const vehicleFilter = document.getElementById('filter-vehicle');
    const exportBtn = document.getElementById('btn-export');

    // Remove old listeners by replacing elements
    if (!dateFilter.dataset.initialized) {
        dateFilter.addEventListener('change', (e) => {
            currentFilters.date = e.target.value;
            applyFilters();
        });
        dateFilter.dataset.initialized = 'true';
    }

    if (!vehicleFilter.dataset.initialized) {
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
    filteredOperativos = allOperativos.filter(op => {
        // Date filter
        if (currentFilters.date !== 'all') {
            const opDate = parseDate(op.fecha);
            const now = new Date();
            now.setHours(0, 0, 0, 0);

            if (currentFilters.date === 'today') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (opDate < today || opDate > new Date()) return false;
            } else if (currentFilters.date === '7days') {
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                if (opDate < weekAgo) return false;
            } else if (currentFilters.date === 'month') {
                const monthAgo = new Date(now);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                if (opDate < monthAgo) return false;
            }
        }

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

// Export data
async function exportData() {
    const stats = calculateStats();

    // Generate CSV
    const headers = ['Fecha', 'Lugar', 'Hora Inicio', 'Hora Fin', 'Vehículos',
        'Actas Auto', 'Actas Moto', 'Retención Auto', 'Retención Moto',
        'Alcohol Auto', 'Alcohol Moto', 'Ruido Auto', 'Ruido Moto', 'Máx Graduación'];

    const rows = filteredOperativos.map(op => [
        op.fecha || '',
        op.lugar || '',
        op.hora_inicio || '',
        op.hora_fin || '',
        op.vehiculos_controlados_total || 0,
        op.actas_simples_auto || 0,
        op.actas_simples_moto || 0,
        op.retencion_doc_auto || 0,
        op.retencion_doc_moto || 0,
        op.alcoholemia_positiva_auto || 0,
        op.alcoholemia_positiva_moto || 0,
        op.actas_ruido_auto || 0,
        op.actas_ruido_moto || 0,
        op.maxima_graduacion_gl || 0
    ]);

    // Add summary row
    rows.push([]);
    rows.push(['RESUMEN']);
    rows.push(['Total Vehículos', stats.total_vehiculos]);
    rows.push(['Total Actas', stats.total_faltas]);
    rows.push(['Total Alcoholemias', stats.total_alcoholemia]);
    rows.push(['Tasa Positividad', `${stats.tasa_positividad}%`]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

    // Download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `operativos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast('📥 CSV descargado', 'success');
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
