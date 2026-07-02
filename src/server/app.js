require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { initDatabase } = require('./db/db_manager');

// Import routers
const nodesRouter = require('./routes/nodes.routes');
const testCasesRouter = require('./routes/test-cases.routes');
const snippetsRouter = require('./routes/snippets.routes');
const aiRouter = require('./routes/ai.routes');
const providersRouter = require('./routes/providers.routes');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Map endpoints
app.use('/tree', nodesRouter);
app.use('/testcases', testCasesRouter);
app.use('/snippets', snippetsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/providers', providersRouter);

// Serve built frontend in production. Fall back to the Vite source folder for local checks.
const rootPath = path.dirname(path.dirname(__dirname));
const distPath = path.join(rootPath, 'dist');
const webSourcePath = path.join(rootPath, 'src', 'web');
const staticPath = fs.existsSync(distPath) ? distPath : webSourcePath;
app.use(express.static(staticPath));

let server;

// Start Express server after initializing database
initDatabase().then(() => {
    server = app.listen(port, () => {
        console.log(`Backend server running at http://localhost:${port}`);
    });
}).catch(err => {
    console.error('Failed to initialize database, shutting down:', err);
    process.exit(1);
});

process.on('SIGTERM', () => {
    if (server) server.close(() => process.exit(0));
    else process.exit(0);
});
process.on('SIGINT', () => {
    if (server) server.close(() => process.exit(0));
    else process.exit(0);
});
