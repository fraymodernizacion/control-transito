// Google Apps Script API URL
const API_BASE = 'https://script.google.com/macros/s/AKfycbxBSlg39rwx01YK-93tuDUc3tZd6Yi1VBQfCGXfAgw4ytIvJlR5S14leO0eydAzjLXSBg/exec';

// Helper para hacer requests a Google Apps Script
async function gFetch(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            redirect: 'follow',
            mode: 'cors'
        });
        return response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

// Para POST requests, Google Apps Script necesita que los datos vayan como form
async function gPost(action, data = null) {
    const url = `${API_BASE}?action=${action}`;

    try {
        // Usamos un form para evitar CORS preflight
        const formData = new FormData();
        if (data) {
            formData.append('data', JSON.stringify(data));
        }

        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        return response.json();
    } catch (error) {
        // Si falla el POST normal, intentamos con GET para escrituras también
        // (Apps Script puede manejar GET para operaciones de escritura)
        console.log('POST failed, trying GET fallback...');

        if (data) {
            const params = new URLSearchParams();
            params.append('action', action);
            params.append('data', JSON.stringify(data));

            const response = await fetch(`${API_BASE}?${params.toString()}`);
            return response.json();
        }

        throw error;
    }
}

// Fetch all operativos
export async function getOperativos() {
    return gFetch(`${API_BASE}?action=getAll`);
}

// Fetch dashboard stats
export async function getStats() {
    return gFetch(`${API_BASE}?action=getStats`);
}

// Fetch single operativo
export async function getOperativo(id) {
    return gFetch(`${API_BASE}?action=getOne&id=${id}`);
}

// Create new operativo
export async function createOperativo(data) {
    // Para crear, pasamos los datos como parámetro en la URL (GET con parámetros)
    // Esto evita problemas de CORS con preflight
    const params = new URLSearchParams();
    params.append('action', 'create');
    params.append('data', JSON.stringify(data));

    return gFetch(`${API_BASE}?${params.toString()}`);
}

// Delete single operativo
export async function deleteOperativo(id) {
    return gFetch(`${API_BASE}?action=delete&id=${id}`);
}

// Delete all operativos
export async function deleteAllOperativos() {
    return gFetch(`${API_BASE}?action=deleteAll`);
}
