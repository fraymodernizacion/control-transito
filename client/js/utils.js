// Format date for display
export function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
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
        `📝 *SANCIONES - AUTOS*`,
        `• Actas Simples: ${operativo.actas_simples_auto}`,
        `• Retención Docs: ${operativo.retencion_doc_auto}`,
        `• Alcoholemia (+): ${operativo.alcoholemia_positiva_auto}`,
        `• Ruido Molesto: ${operativo.actas_ruido_auto}`,
        ``,
        `🏍️ *SANCIONES - MOTOS*`,
        `• Actas Simples: ${operativo.actas_simples_moto}`,
        `• Retención Docs: ${operativo.retencion_doc_moto}`,
        `• Alcoholemia (+): ${operativo.alcoholemia_positiva_moto}`,
        `• Ruido Molesto: ${operativo.actas_ruido_moto}`,
    ];

    if (operativo.maxima_graduacion_gl > 0) {
        lines.push(``);
        lines.push(`🍺 *ALCOHOLEMIA*`);
        lines.push(`• Máx. Graduación: ${operativo.maxima_graduacion_gl} g/L`);
    }

    const totalFaltas =
        operativo.actas_simples_auto + operativo.actas_simples_moto +
        operativo.retencion_doc_auto + operativo.retencion_doc_moto +
        operativo.alcoholemia_positiva_auto + operativo.alcoholemia_positiva_moto +
        operativo.actas_ruido_auto + operativo.actas_ruido_moto;

    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(`📊 *TOTALES*`);
    lines.push(`• Total Faltas: ${totalFaltas}`);
    lines.push(`• Alcoholemias (+): ${operativo.alcoholemia_positiva_auto + operativo.alcoholemia_positiva_moto}`);

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
