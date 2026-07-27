const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { exec } = require("child_process");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || 'paltidxr.cloud';

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// ============ BASE DE DATOS DE DEPLOYS ============
const DEPLOYS_FILE = path.join(__dirname, "deploys.json");

function loadDeploys() {
    try {
        if (fs.existsSync(DEPLOYS_FILE)) {
            return JSON.parse(fs.readFileSync(DEPLOYS_FILE, "utf-8"));
        }
    } catch (e) {
        console.error("Error loading deploys:", e);
    }
    return {};
}

function saveDeploys(data) {
    try {
        fs.writeFileSync(DEPLOYS_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
        console.error("Error saving deploys:", e);
    }
}

let deploys = loadDeploys();

// ============ GENERAR ID ÚNICO ============
function generateId() {
    return crypto.randomBytes(8).toString('hex');
}

// ============ RUTAS ============

// Health check
app.get("/health", (req, res) => {
    res.json({
        status: "online",
        service: "PaltidxR Deploy API",
        version: "1.0.0",
        deploys: Object.keys(deploys).length,
        timestamp: new Date().toISOString()
    });
});

// Listar deploys
app.get("/api/deploys", (req, res) => {
    const list = Object.values(deploys);
    res.json({
        deploys: list,
        count: list.length
    });
});

// Crear deploy
app.post("/api/deploy", async (req, res) => {
    try {
        const { repo, token, branch, platform, subdomain, domain, ext } = req.body;

        if (!repo || !token) {
            return res.status(400).json({ error: "Repository and token are required" });
        }

        const fullDomain = `${subdomain || 'paltidxr'}.${domain || 'paltidxr'}.${ext || 'cloud'}`;
        const deployId = generateId();

        // Crear registro de deploy
        const deployData = {
            id: deployId,
            repo: repo,
            branch: branch || 'main',
            platform: platform || 'render',
            domain: fullDomain,
            url: `https://${fullDomain}`,
            status: 'deploying',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        deploys[deployId] = deployData;
        saveDeploys(deploys);

        // Simular deploy asíncrono con etapas
        const deployProcess = async () => {
            try {
                // Actualizar estado
                deployData.status = 'cloning';
                deployData.updatedAt = new Date().toISOString();
                saveDeploys(deploys);

                await sleep(1500);

                deployData.status = 'building';
                deployData.updatedAt = new Date().toISOString();
                saveDeploys(deploys);

                await sleep(2000);

                deployData.status = 'deploying';
                deployData.updatedAt = new Date().toISOString();
                saveDeploys(deploys);

                await sleep(1500);

                // Completar
                deployData.status = 'active';
                deployData.deployedAt = new Date().toISOString();
                deployData.updatedAt = new Date().toISOString();
                saveDeploys(deploys);

                console.log(`✅ Deployed ${repo} to ${fullDomain}`);
            } catch (error) {
                deployData.status = 'failed';
                deployData.error = error.message;
                deployData.updatedAt = new Date().toISOString();
                saveDeploys(deploys);
                console.error(`❌ Deploy failed: ${error.message}`);
            }
        };

        // Iniciar proceso asíncrono
        deployProcess();

        // Responder inmediatamente
        res.json({
            success: true,
            url: `https://${fullDomain}`,
            domain: fullDomain,
            deployId: deployId,
            status: 'deploying',
            message: `Deployment started for ${repo}. Check status at /api/deploy/${deployId}`
        });

    } catch (error) {
        console.error('Deploy error:', error);
        res.status(500).json({ error: "Deployment failed", message: error.message });
    }
});

// Obtener estado del deploy
app.get("/api/deploy/:id", (req, res) => {
    const deploy = deploys[req.params.id];
    if (deploy) {
        res.json(deploy);
    } else {
        res.status(404).json({ error: "Deploy not found" });
    }
});

// Eliminar deploy
app.delete("/api/deploy/:id", (req, res) => {
    if (deploys[req.params.id]) {
        delete deploys[req.params.id];
        saveDeploys(deploys);
        res.json({ success: true, message: "Deploy removed" });
    } else {
        res.status(404).json({ error: "Deploy not found" });
    }
});

// Función sleep para simular procesos
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Crear archivo deploys.json si no existe
if (!fs.existsSync(DEPLOYS_FILE)) {
    saveDeploys({});
}

app.listen(PORT, () => {
    console.log(`PaltidxR Deploy running on port ${PORT}`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api/deploys`);
});
