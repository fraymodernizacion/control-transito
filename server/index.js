import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './db.js';
import operativosRouter from './routes/operativos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from client
app.use(express.static(join(__dirname, '../client')));

// API routes
app.use('/api/operativos', operativosRouter);

// Fallback to index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../client/index.html'));
});

// Initialize database and start server
async function start() {
    await initDatabase();
    app.listen(PORT, () => {
        console.log(`🚦 Servidor de Tránsito corriendo en http://localhost:${PORT}`);
    });
}

start();
