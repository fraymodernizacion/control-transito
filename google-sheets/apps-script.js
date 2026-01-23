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

    const headers = [
        'id', 'fecha', 'lugar', 'hora_inicio', 'hora_fin', 'personal',
        'vehiculos_controlados_total',
        'actas_simples_auto', 'actas_simples_moto', 'actas_simples_camion', 'actas_simples_camioneta', 'actas_simples_colectivo',
        'retencion_doc_auto', 'retencion_doc_moto', 'retencion_doc_camion', 'retencion_doc_camioneta', 'retencion_doc_colectivo',
        'alcoholemia_positiva_auto', 'alcoholemia_positiva_moto', 'alcoholemia_positiva_camion', 'alcoholemia_positiva_camioneta', 'alcoholemia_positiva_colectivo',
        'actas_ruido_auto', 'actas_ruido_moto', 'actas_ruido_camion', 'actas_ruido_camioneta', 'actas_ruido_colectivo',
        'maxima_graduacion_gl', 'created_at'
    ];

    // Si no existe la hoja, crearla con headers
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
        // Verificar si faltan headers
        const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const missingHeaders = headers.filter(h => !currentHeaders.includes(h));

        if (missingHeaders.length > 0) {
            // Re-escribir todos los headers para asegurar orden y existencia
            // Advertencia: esto asume que los datos están en el orden anterior.
            // Es más seguro solo agregar al final si no queremos reordenar, 
            // pero mi lógica de mapping usa nombres de headers así que el orden no importa tanto 
            // siempre que los datos existentes no se mezclen.
            // Para ser seguros, mantenemos los actuales y agregamos los nuevos antes de 'created_at'.

            const newHeaders = [...currentHeaders];
            const createdAtIdx = newHeaders.indexOf('created_at');

            missingHeaders.forEach(h => {
                if (createdAtIdx !== -1) {
                    newHeaders.splice(createdAtIdx, 0, h);
                } else {
                    newHeaders.push(h);
                }
            });

            sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
        }
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
            case 'update':
                // Aceptar datos desde parámetro 'data' (GET) o postData (POST)
                let data;
                if (e.parameter.data) {
                    data = JSON.parse(e.parameter.data);
                } else if (e.postData && e.postData.contents) {
                    data = JSON.parse(e.postData.contents);
                } else {
                    throw new Error('No se recibieron datos');
                }

                if (action === 'create') {
                    result = createOperativo(data);
                } else {
                    result = updateOperativo(e.parameter.id || data.id, data);
                }
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
        total_faltas_moto: 0,
        total_faltas_camion: 0,
        total_faltas_camioneta: 0,
        total_faltas_colectivo: 0
    };

    const vehicleTypes = ['auto', 'moto', 'camion', 'camioneta', 'colectivo'];

    operativos.forEach(op => {
        stats.total_vehiculos += Number(op.vehiculos_controlados_total) || 0;

        vehicleTypes.forEach(vh => {
            const alcoholemia = Number(op[`alcoholemia_positiva_${vh}`]) || 0;
            const simple = Number(op[`actas_simples_${vh}`]) || 0;
            const retencion = Number(op[`retencion_doc_${vh}`]) || 0;
            const ruido = Number(op[`actas_ruido_${vh}`]) || 0;

            stats.total_alcoholemia += alcoholemia;
            stats.total_actas_simples += simple;
            stats.total_retenciones += retencion;
            stats.total_ruidos += ruido;

            stats[`total_faltas_${vh}`] += (alcoholemia + simple + retencion + ruido);
        });
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
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Preparar fila basada en headers
    const newRow = headers.map(header => {
        if (header === 'id') return newId;
        if (header === 'created_at') return now;
        return data[header] || (header.includes('total') || header.includes('actas') || header.includes('retencion') || header.includes('alcoholemia') || header.includes('graduacion') ? 0 : '');
    });

    sheet.appendRow(newRow);

    return { id: newId, message: 'Operativo guardado exitosamente' };
}

// Actualizar operativo existente
function updateOperativo(id, data) {
    const sheet = getSheet();
    const values = sheet.getDataRange().getValues();
    const headers = values[0];

    for (let i = 1; i < values.length; i++) {
        if (values[i][0] == id) {
            const rowNumber = i + 1;
            const updatedRow = headers.map((header, index) => {
                if (header === 'id') return values[i][index];
                if (header === 'created_at') return values[i][index];
                if (data.hasOwnProperty(header)) return data[header];
                return values[i][index];
            });

            sheet.getRange(rowNumber, 1, 1, headers.length).setValues([updatedRow]);
            return { id: id, message: 'Operativo actualizado exitosamente' };
        }
    }

    return { error: 'Operativo no encontrado' };
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
