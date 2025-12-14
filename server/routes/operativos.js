import express from 'express';
import { getDb, saveDatabase } from '../db.js';

const router = express.Router();

// GET all operativos
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM operativos ORDER BY fecha DESC, created_at DESC');
        const operativos = [];
        while (stmt.step()) {
            operativos.push(stmt.getAsObject());
        }
        stmt.free();
        res.json(operativos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET dashboard stats
router.get('/stats', (req, res) => {
    try {
        const db = getDb();
        const stmt = db.prepare(`
      SELECT 
        COALESCE(SUM(vehiculos_controlados_total), 0) as total_vehiculos,
        COALESCE(SUM(alcoholemia_positiva_auto + alcoholemia_positiva_moto), 0) as total_alcoholemia,
        COALESCE(SUM(actas_simples_auto + actas_simples_moto), 0) as total_actas_simples,
        COALESCE(SUM(retencion_doc_auto + retencion_doc_moto), 0) as total_retenciones,
        COALESCE(SUM(actas_ruido_auto + actas_ruido_moto), 0) as total_ruidos,
        COALESCE(SUM(actas_simples_auto + retencion_doc_auto + alcoholemia_positiva_auto + actas_ruido_auto), 0) as total_faltas_auto,
        COALESCE(SUM(actas_simples_moto + retencion_doc_moto + alcoholemia_positiva_moto + actas_ruido_moto), 0) as total_faltas_moto
      FROM operativos
    `);

        let stats = {
            total_vehiculos: 0,
            total_alcoholemia: 0,
            total_actas_simples: 0,
            total_retenciones: 0,
            total_ruidos: 0,
            total_faltas_auto: 0,
            total_faltas_moto: 0
        };

        if (stmt.step()) {
            stats = stmt.getAsObject();
        }
        stmt.free();

        const totalFaltas = stats.total_actas_simples + stats.total_retenciones + stats.total_alcoholemia + stats.total_ruidos;
        const tasaPositividad = stats.total_vehiculos > 0
            ? ((stats.total_alcoholemia / stats.total_vehiculos) * 100).toFixed(2)
            : 0;

        res.json({
            ...stats,
            total_faltas: totalFaltas,
            tasa_positividad: parseFloat(tasaPositividad)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET single operativo
router.get('/:id', (req, res) => {
    try {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM operativos WHERE id = ?');
        stmt.bind([parseInt(req.params.id)]);

        if (stmt.step()) {
            const operativo = stmt.getAsObject();
            stmt.free();
            res.json(operativo);
        } else {
            stmt.free();
            res.status(404).json({ error: 'Operativo no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST new operativo
router.post('/', (req, res) => {
    try {
        const db = getDb();
        const {
            fecha, lugar, hora_inicio, hora_fin, personal,
            vehiculos_controlados_total,
            actas_simples_auto, actas_simples_moto,
            retencion_doc_auto, retencion_doc_moto,
            alcoholemia_positiva_auto, alcoholemia_positiva_moto,
            actas_ruido_auto, actas_ruido_moto,
            maxima_graduacion_gl
        } = req.body;

        db.run(`
      INSERT INTO operativos (
        fecha, lugar, hora_inicio, hora_fin, personal,
        vehiculos_controlados_total,
        actas_simples_auto, actas_simples_moto,
        retencion_doc_auto, retencion_doc_moto,
        alcoholemia_positiva_auto, alcoholemia_positiva_moto,
        actas_ruido_auto, actas_ruido_moto,
        maxima_graduacion_gl
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            fecha, lugar || '', hora_inicio || '', hora_fin || '', personal || '',
            vehiculos_controlados_total || 0,
            actas_simples_auto || 0, actas_simples_moto || 0,
            retencion_doc_auto || 0, retencion_doc_moto || 0,
            alcoholemia_positiva_auto || 0, alcoholemia_positiva_moto || 0,
            actas_ruido_auto || 0, actas_ruido_moto || 0,
            maxima_graduacion_gl || 0
        ]);

        const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
        saveDatabase();

        res.status(201).json({ id: lastId, message: 'Operativo guardado exitosamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE single operativo
router.delete('/:id', (req, res) => {
    try {
        const db = getDb();
        db.run('DELETE FROM operativos WHERE id = ?', [parseInt(req.params.id)]);
        const changes = db.getRowsModified();

        if (changes === 0) {
            return res.status(404).json({ error: 'Operativo no encontrado' });
        }

        saveDatabase();
        res.json({ message: 'Operativo eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE all operativos (admin)
router.delete('/', (req, res) => {
    try {
        const db = getDb();
        db.run('DELETE FROM operativos');
        saveDatabase();
        res.json({ message: 'Todos los operativos eliminados' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
