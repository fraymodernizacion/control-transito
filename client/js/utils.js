// Format date for display
export function formatDate(dateStr) {
    if (!dateStr) return 'Sin fecha';

    let date;

    // Handle different date formats from Google Sheets
    if (typeof dateStr === 'string') {
        // Try standard format first (YYYY-MM-DD)
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            date = new Date(dateStr + 'T12:00:00');
        }
        // Handle DD/MM/YYYY format
        else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            const [day, month, year] = dateStr.split('/');
            date = new Date(year, month - 1, day, 12, 0, 0);
        }
        // Handle ISO string
        else if (dateStr.includes('T')) {
            date = new Date(dateStr);
        }
        // Fallback
        else {
            date = new Date(dateStr);
        }
    } else if (typeof dateStr === 'number') {
        // Google Sheets serial date (days since Dec 30, 1899)
        date = new Date((dateStr - 25569) * 86400 * 1000);
    } else {
        date = new Date(dateStr);
    }

    // Check if valid
    if (isNaN(date.getTime())) {
        return 'Sin fecha';
    }

    return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// Format time for display
export function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
}

// Get today's date in YYYY-MM-DD format
export function getTodayDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

// Show toast notification
export function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Generate report text for sharing
export function generateReportText(operativo) {
    const lines = [
        `📋 *REPORTE DE OPERATIVO*`,
        `━━━━━━━━━━━━━━━━━━`,
        `📅 Fecha: ${formatDate(operativo.fecha)}`,
        `📍 Lugar: ${operativo.lugar || 'No especificado'}`,
        `🕐 Horario: ${formatTime(operativo.hora_inicio) || '--:--'} - ${formatTime(operativo.hora_fin) || '--:--'}`,
        `👮 Personal: ${operativo.personal || 'No especificado'}`,
        ``,
        `🚗 *CONTROL GENERAL*`,
        `• Vehículos Controlados: ${operativo.vehiculos_controlados_total}`,
        ``,
        `🚗 *SANCIONES - AUTOS*`,
        `• Actas Simples: ${operativo.actas_simples_auto || 0}`,
        `• Retención por doc: ${operativo.retencion_doc_auto || 0}`,
        `• Alcoholemia (+): ${operativo.alcoholemia_positiva_auto || 0}`,
        `• Ruido Molesto: ${operativo.actas_ruido_auto || 0}`,
        ``,
        `🏍️ *SANCIONES - MOTOS*`,
        `• Actas Simples: ${operativo.actas_simples_moto || 0}`,
        `• Retención por doc: ${operativo.retencion_doc_moto || 0}`,
        `• Alcoholemia (+): ${operativo.alcoholemia_positiva_moto || 0}`,
        `• Ruido Molesto: ${operativo.actas_ruido_moto || 0}`,
    ];

    if (operativo.actas_simples_camion || operativo.retencion_doc_camion || operativo.alcoholemia_positiva_camion || operativo.actas_ruido_camion) {
        lines.push(``);
        lines.push(`🚚 *SANCIONES - CAMIONES*`);
        lines.push(`• Actas Simples: ${operativo.actas_simples_camion || 0}`);
        lines.push(`• Retención por doc: ${operativo.retencion_doc_camion || 0}`);
        lines.push(`• Alcoholemia (+): ${operativo.alcoholemia_positiva_camion || 0}`);
        lines.push(`• Ruido Molesto: ${operativo.actas_ruido_camion || 0}`);
    }

    if (operativo.actas_simples_camioneta || operativo.retencion_doc_camioneta || operativo.alcoholemia_positiva_camioneta || operativo.actas_ruido_camioneta) {
        lines.push(``);
        lines.push(`🛻 *SANCIONES - CAMIONETAS*`);
        lines.push(`• Actas Simples: ${operativo.actas_simples_camioneta || 0}`);
        lines.push(`• Retención por doc: ${operativo.retencion_doc_camioneta || 0}`);
        lines.push(`• Alcoholemia (+): ${operativo.alcoholemia_positiva_camioneta || 0}`);
        lines.push(`• Ruido Molesto: ${operativo.actas_ruido_camioneta || 0}`);
    }

    if (operativo.actas_simples_colectivo || operativo.retencion_doc_colectivo || operativo.alcoholemia_positiva_colectivo || operativo.actas_ruido_colectivo) {
        lines.push(``);
        lines.push(`🚌 *SANCIONES - COLECTIVOS*`);
        lines.push(`• Actas Simples: ${operativo.actas_simples_colectivo || 0}`);
        lines.push(`• Retención por doc: ${operativo.retencion_doc_colectivo || 0}`);
        lines.push(`• Alcoholemia (+): ${operativo.alcoholemia_positiva_colectivo || 0}`);
        lines.push(`• Ruido Molesto: ${operativo.actas_ruido_colectivo || 0}`);
    }

    if (operativo.maxima_graduacion_gl > 0) {
        lines.push(``);
        lines.push(`🍺 *ALCOHOLEMIA*`);
        lines.push(`• Máx. Graduación: ${operativo.maxima_graduacion_gl} g/L`);
    }

    const vehicleTypes = ['auto', 'moto', 'camion', 'camioneta', 'colectivo'];
    let totalFaltas = 0;
    let totalAlcohol = 0;

    vehicleTypes.forEach(vh => {
        totalFaltas += (Number(operativo[`actas_simples_${vh}`]) || 0) +
            (Number(operativo[`retencion_doc_${vh}`]) || 0) +
            (Number(operativo[`alcoholemia_positiva_${vh}`]) || 0) +
            (Number(operativo[`actas_ruido_${vh}`]) || 0);

        totalAlcohol += (Number(operativo[`alcoholemia_positiva_${vh}`]) || 0);
    });

    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(`📊 *TOTALES*`);
    lines.push(`• Total Faltas: ${totalFaltas}`);
    lines.push(`• Alcoholemias (+): ${totalAlcohol}`);

    return lines.join('\n');
}

// Copy text to clipboard
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        } catch (e) {
            document.body.removeChild(textarea);
            return false;
        }
    }
}
