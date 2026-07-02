const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3001;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Initialize DB if not exists
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ nodes: [], testCases: {} }, null, 2));
}

function readDB() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Get Tree
app.get('/tree', (req, res) => {
    const db = readDB();
    res.json(db.nodes || []);
});

// Add Node
app.post('/tree', (req, res) => {
    const db = readDB();
    const { parentId, name, type, context } = req.body;
    if (!name || !['project', 'module', 'screen', 'feature'].includes(type)) {
        return res.status(400).json({ error: 'Invalid node payload' });
    }
    const newNode = {
        id: 'node_' + Date.now().toString(),
        parentId: parentId || null,
        name,
        type, // 'project', 'module', 'screen', 'feature'
        context: context || ''
    };
    db.nodes.push(newNode);
    writeDB(db);
    res.json(newNode);
});

// Rename Node
app.put('/tree/:id', (req, res) => {
    const db = readDB();
    const node = db.nodes.find(n => n.id === req.params.id);
    if (node) {
        node.name = req.body.name;
        writeDB(db);
        res.json(node);
    } else {
        res.status(404).json({ error: 'Node not found' });
    }
});

// Delete Node (and children recursively)
app.delete('/tree/:id', (req, res) => {
    const db = readDB();
    const idsToDelete = new Set([req.params.id]);
    
    // Recursive find children
    let added = true;
    while(added) {
        added = false;
        db.nodes.forEach(n => {
            if (idsToDelete.has(n.parentId) && !idsToDelete.has(n.id)) {
                idsToDelete.add(n.id);
                added = true;
            }
        });
    }

    db.nodes = db.nodes.filter(n => !idsToDelete.has(n.id));
    idsToDelete.forEach(id => {
        delete db.testCases[id];
    });

    writeDB(db);
    res.json({ success: true });
});

// Get Test Cases for Node
app.get('/testcases/:nodeId', (req, res) => {
    const db = readDB();
    res.json(db.testCases[req.params.nodeId] || []);
});

// Save Test Cases for Node
app.post('/testcases/:nodeId', (req, res) => {
    const db = readDB();
    const nodeId = req.params.nodeId;
    if (!Array.isArray(req.body.testCases)) {
        return res.status(400).json({ error: 'testCases must be an array' });
    }
    if (!db.testCases[nodeId]) {
        db.testCases[nodeId] = [];
    }
    
    const newTCs = req.body.testCases || [];
    
    if (req.body.replace) {
        db.testCases[nodeId] = newTCs;
    } else {
        // Append unique by ID
        const existingMap = new Map(db.testCases[nodeId].map(tc => [tc.id, tc]));
        newTCs.forEach(tc => {
            existingMap.set(tc.id, tc);
        });
        db.testCases[nodeId] = Array.from(existingMap.values());
    }

    writeDB(db);
    res.json(db.testCases[nodeId]);
});

// Get Snippets
app.get('/snippets', (req, res) => {
    const db = readDB();
    res.json(db.snippets || []);
});

// Save Snippets
app.post('/snippets', (req, res) => {
    const db = readDB();
    db.snippets = req.body.snippets || [];
    writeDB(db);
    res.json({ success: true });
});


const server = app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
