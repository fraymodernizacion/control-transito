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
    // Build personal string from new fields
    const personalParts = [];
    if (operativo.personal_guardia_urbana > 0) {
        personalParts.push(`${operativo.personal_guardia_urbana} Guardia Urbana`);
    }
    if (operativo.personal_transito > 0) {
        personalParts.push(`${operativo.personal_transito} Tránsito`);
    }
    if (operativo.personal_bromatologia > 0) {
        personalParts.push(`${operativo.personal_bromatologia} Bromatología`);
    }
    const personalStr = personalParts.length > 0 ? personalParts.join(', ') : 'No especificado';

    const lines = [
        `📋 *REPORTE DE OPERATIVO*`,
        `━━━━━━━━━━━━━━━━━━`,
        `📅 Fecha: ${formatDate(operativo.fecha)}`,
        `📍 Lugar: ${operativo.lugar || 'No especificado'}`,
        `🕐 Horario: ${formatTime(operativo.hora_inicio) || '--:--'} - ${formatTime(operativo.hora_fin) || '--:--'}`,
        ``,
        `🏛️ *ÁREAS INVOLUCRADAS*`,
        `${operativo.areas_involucradas || 'No especificadas'}`,
        ``,
        `👮 *PERSONAL MUNICIPAL*`,
        `${personalStr}`,
        ``,
        `🚗 *CONTROL GENERAL*`,
        `• Vehículos Controlados: ${operativo.vehiculos_controlados_total}`,
        ``,
        `📝 *SANCIONES - AUTOS*`,
        `• Actas Simples: ${operativo.actas_simples_auto}`,
        `• Retención de documentación: ${operativo.retencion_doc_auto}`,
        `• Alcoholemia (+): ${operativo.alcoholemia_positiva_auto}`,
        `• Ruido Molesto: ${operativo.actas_ruido_auto}`,
        ``,
        `🏍️ *SANCIONES - MOTOS*`,
        `• Actas Simples: ${operativo.actas_simples_moto}`,
        `• Retención de documentación: ${operativo.retencion_doc_moto}`,
        `• Alcoholemia (+): ${operativo.alcoholemia_positiva_moto}`,
        `• Ruido Molesto: ${operativo.actas_ruido_moto}`,
    ];

    if (operativo.maxima_graduacion_gl > 0) {
        lines.push(``);
        lines.push(`🍺 *ALCOHOLEMIA*`);
        lines.push(`• Máx. Graduación: ${operativo.maxima_graduacion_gl} g/L`);
    }

    const totalFaltas =
        (operativo.actas_simples_auto || 0) + (operativo.actas_simples_moto || 0) +
        (operativo.retencion_doc_auto || 0) + (operativo.retencion_doc_moto || 0) +
        (operativo.alcoholemia_positiva_auto || 0) + (operativo.alcoholemia_positiva_moto || 0) +
        (operativo.actas_ruido_auto || 0) + (operativo.actas_ruido_moto || 0);

    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(`📊 *TOTALES*`);
    lines.push(`• Total Faltas: ${totalFaltas}`);
    lines.push(`• Alcoholemias (+): ${(operativo.alcoholemia_positiva_auto || 0) + (operativo.alcoholemia_positiva_moto || 0)}`);

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
