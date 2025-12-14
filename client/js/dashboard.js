import { getStats, getOperativos, deleteOperativo, deleteAllOperativos, getOperativo } from './api.js';
import { formatDate, showToast, generateReportText, copyToClipboard } from './utils.js';

let infraccionesChart = null;
let vehiculosChart = null;

// Initialize dashboard
export async function initDashboard() {
    await Promise.all([loadKPIs(), loadCharts(), loadHistory()]);
}

// Load KPI values
async function loadKPIs() {
    try {
        const stats = await getStats();

        document.getElementById('kpi-vehiculos').textContent = stats.total_vehiculos.toLocaleString();
        document.getElementById('kpi-alcoholemia').textContent = stats.total_alcoholemia.toLocaleString();
        document.getElementById('kpi-actas').textContent = stats.total_faltas.toLocaleString();
        document.getElementById('kpi-tasa').textContent = `${stats.tasa_positividad}%`;
    } catch (error) {
        console.error('Error loading KPIs:', error);
    }
}

// Load charts
async function loadCharts() {
    try {
        const stats = await getStats();

        // Destroy existing charts
        if (infraccionesChart) {
            infraccionesChart.destroy();
        }
        if (vehiculosChart) {
            vehiculosChart.destroy();
        }

        // Chart colors
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
        const hasInfracciones = stats.total_actas_simples || stats.total_retenciones || stats.total_alcoholemia || stats.total_ruidos;

        infraccionesChart = new Chart(infraccionesCtx, {
            type: 'doughnut',
            data: {
                labels: ['Actas Simples', 'Retenciones', 'Alcoholemia', 'Ruidos'],
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
                            padding: 15,
                            font: { size: 11 },
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        enabled: hasInfracciones
                    }
                }
            }
        });

        // Vehiculos Bar Chart
        const vehiculosCtx = document.getElementById('chart-vehiculos').getContext('2d');
        const hasVehiculos = stats.total_faltas_auto || stats.total_faltas_moto;

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
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#64748b'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: { weight: 600 }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading charts:', error);
    }
}

// Load history
async function loadHistory() {
    try {
        const operativos = await getOperativos();
        const historyList = document.getElementById('history-list');

        if (operativos.length === 0) {
            historyList.innerHTML = `
        <div class="history-empty">
          <span class="history-empty-icon">📭</span>
          <p>No hay operativos registrados</p>
        </div>
      `;
            return;
        }

        // Show last 10 operativos
        const recentOperativos = operativos.slice(0, 10);

        historyList.innerHTML = recentOperativos.map(op => {
            const totalAlcohol = op.alcoholemia_positiva_auto + op.alcoholemia_positiva_moto;
            return `
        <div class="history-item" data-id="${op.id}">
          <div class="history-item-info">
            <span class="history-item-date">${formatDate(op.fecha)}</span>
            <span class="history-item-lugar">${op.lugar || 'Sin ubicación'}</span>
          </div>
          <div class="history-item-stats">
            <div class="history-stat">
              <span class="history-stat-value">${op.vehiculos_controlados_total}</span>
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
            <button class="history-btn delete" title="Eliminar" data-id="${op.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/>
              </svg>
            </button>
          </div>
        </div>
      `;
        }).join('');

        // Attach event listeners
        attachHistoryListeners();
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Attach history event listeners
function attachHistoryListeners() {
    // Copy buttons
    document.querySelectorAll('.history-btn.copy').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            try {
                const operativo = await getOperativo(id);
                const reportText = generateReportText(operativo);
                const success = await copyToClipboard(reportText);
                if (success) {
                    showToast('📋 Reporte copiado al portapapeles', 'success');
                } else {
                    showToast('Error al copiar', 'error');
                }
            } catch (error) {
                showToast('Error al generar reporte', 'error');
            }
        });
    });

    // Delete buttons
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
