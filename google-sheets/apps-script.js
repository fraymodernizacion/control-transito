/**
 * Google Apps Script - API para Control de Tránsito
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Abre tu Google Sheet
 * 2. Ve a Extensiones > Apps Script
 * 3. Borra todo el contenido y pega este código
 * 4. Guarda (Ctrl+S)
 * 5. Click en "Implementar" > "Nueva implementación"
 * 6. Selecciona tipo: "Aplicación web"
 * 7. Ejecutar como: "Yo"
 * 8. Acceso: "Cualquier usuario"
 * 9. Copia la URL que te da
 * 
 * IMPORTANTE: Después de actualizar el código, necesitas:
 * - Ir a "Implementar" > "Administrar implementaciones"
 * - Editar la implementación existente o crear una nueva versión
 */

// Nombre de la hoja donde están los datos
const SHEET_NAME = 'Operativos';

// Obtener la hoja activa
function getSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    // Si no existe la hoja, crearla con headers
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        const headers = [
            'id', 'fecha', 'lugar', 'hora_inicio', 'hora_fin',
            'areas_involucradas', 'personal_guardia_urbana', 'personal_transito', 'personal_bromatologia',
            'personal', 'vehiculos_controlados_total',
            'actas_simples_auto', 'actas_simples_moto',
            'retencion_doc_auto', 'retencion_doc_moto',
            'alcoholemia_positiva_auto', 'alcoholemia_positiva_moto',
            'actas_ruido_auto', 'actas_ruido_moto',
            'maxima_graduacion_gl', 'created_at'
        ];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    return sheet;
}

// Manejar requests GET
function doGet(e) {
    return handleRequest(e);
}

// Manejar requests POST
function doPost(e) {
    return handleRequest(e);
}

function handleRequest(e) {
    const action = e.parameter.action || 'getAll';

    try {
        let result;

        switch (action) {
            case 'getAll':
                result = getAllOperativos();
                break;
            case 'getStats':
                result = getStats();
                break;
            case 'getOne':
                result = getOperativo(e.parameter.id);
                break;
            case 'create':
                // Aceptar datos desde parámetro 'data' (GET) o postData (POST)
                let data;
                if (e.parameter.data) {
                    data = JSON.parse(e.parameter.data);
                } else if (e.postData && e.postData.contents) {
                    data = JSON.parse(e.postData.contents);
                } else {
                    throw new Error('No se recibieron datos');
                }
                result = createOperativo(data);
                break;
            case 'delete':
                result = deleteOperativo(e.parameter.id);
                break;
            case 'deleteAll':
                result = deleteAllOperativos();
                break;
            default:
                result = { error: 'Acción no válida' };
        }

        return ContentService
            .createTextOutput(JSON.stringify(result))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService
            .createTextOutput(JSON.stringify({ error: error.message }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// Obtener todos los operativos
function getAllOperativos() {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return [];

    const headers = data[0];
    const operativos = [];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[0]) { // Si tiene ID
            const operativo = {};
            headers.forEach((header, index) => {
                operativo[header] = row[index];
            });
            operativos.push(operativo);
        }
    }

    // Ordenar por fecha descendente
    operativos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    return operativos;
}

// Obtener estadísticas
function getStats() {
    const operativos = getAllOperativos();

    let stats = {
        total_vehiculos: 0,
        total_alcoholemia: 0,
        total_actas_simples: 0,
        total_retenciones: 0,
        total_ruidos: 0,
        total_faltas_auto: 0,
        total_faltas_moto: 0
    };

    operativos.forEach(op => {
        stats.total_vehiculos += Number(op.vehiculos_controlados_total) || 0;
        stats.total_alcoholemia += (Number(op.alcoholemia_positiva_auto) || 0) + (Number(op.alcoholemia_positiva_moto) || 0);
        stats.total_actas_simples += (Number(op.actas_simples_auto) || 0) + (Number(op.actas_simples_moto) || 0);
        stats.total_retenciones += (Number(op.retencion_doc_auto) || 0) + (Number(op.retencion_doc_moto) || 0);
        stats.total_ruidos += (Number(op.actas_ruido_auto) || 0) + (Number(op.actas_ruido_moto) || 0);

        stats.total_faltas_auto +=
            (Number(op.actas_simples_auto) || 0) +
            (Number(op.retencion_doc_auto) || 0) +
            (Number(op.alcoholemia_positiva_auto) || 0) +
            (Number(op.actas_ruido_auto) || 0);

        stats.total_faltas_moto +=
            (Number(op.actas_simples_moto) || 0) +
            (Number(op.retencion_doc_moto) || 0) +
            (Number(op.alcoholemia_positiva_moto) || 0) +
            (Number(op.actas_ruido_moto) || 0);
    });

    stats.total_faltas = stats.total_actas_simples + stats.total_retenciones + stats.total_alcoholemia + stats.total_ruidos;
    stats.tasa_positividad = stats.total_vehiculos > 0
        ? parseFloat(((stats.total_alcoholemia / stats.total_vehiculos) * 100).toFixed(2))
        : 0;

    return stats;
}

// Obtener un operativo por ID
function getOperativo(id) {
    const operativos = getAllOperativos();
    const operativo = operativos.find(op => op.id == id);

    if (!operativo) {
        return { error: 'Operativo no encontrado' };
    }

    return operativo;
}

// Crear nuevo operativo
function createOperativo(data) {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();

    // Generar nuevo ID
    let newId = 1;
    if (lastRow > 1) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().filter(id => id);
        if (ids.length > 0) {
            newId = Math.max(...ids) + 1;
        }
    }

    const now = new Date().toISOString();

    // Calcular personal total
    const personalTotal = (data.personal_guardia_urbana || 0) +
        (data.personal_transito || 0) +
        (data.personal_bromatologia || 0);

    const newRow = [
        newId,
        data.fecha || '',
        data.lugar || '',
        data.hora_inicio || '',
        data.hora_fin || '',
        data.areas_involucradas || '',
        data.personal_guardia_urbana || 0,
        data.personal_transito || 0,
        data.personal_bromatologia || 0,
        personalTotal,
        data.vehiculos_controlados_total || 0,
        data.actas_simples_auto || 0,
        data.actas_simples_moto || 0,
        data.retencion_doc_auto || 0,
        data.retencion_doc_moto || 0,
        data.alcoholemia_positiva_auto || 0,
        data.alcoholemia_positiva_moto || 0,
        data.actas_ruido_auto || 0,
        data.actas_ruido_moto || 0,
        data.maxima_graduacion_gl || 0,
        now
    ];

    sheet.appendRow(newRow);

    return { id: newId, message: 'Operativo guardado exitosamente' };
}

// Eliminar un operativo
function deleteOperativo(id) {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
        if (data[i][0] == id) {
            sheet.deleteRow(i + 1);
            return { message: 'Operativo eliminado' };
        }
    }

    return { error: 'Operativo no encontrado' };
}

// Eliminar todos los operativos
function deleteAllOperativos() {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
    }

    return { message: 'Todos los operativos eliminados' };
}
