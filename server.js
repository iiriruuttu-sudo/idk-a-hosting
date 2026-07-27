const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============ DOMINIO BASE ============
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'host.cloud';
console.log(`🌐 Base Domain: ${BASE_DOMAIN}`);

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));
app.use(express.static(__dirname));

// ============ BASE DE DATOS SCRIPTS ============
const SCRIPTS_FILE = path.join(__dirname, "scripts.json");

function loadScripts() {
    try {
        if (fs.existsSync(SCRIPTS_FILE)) {
            return JSON.parse(fs.readFileSync(SCRIPTS_FILE, "utf-8"));
        }
    } catch (e) { console.error("Error loading scripts:", e); }
    return {};
}

function saveScripts(scripts) {
    try {
        fs.writeFileSync(SCRIPTS_FILE, JSON.stringify(scripts, null, 2), "utf-8");
    } catch (e) { console.error("Error saving scripts:", e); }
}

let scriptsDB = loadScripts();

// ============ BASE DE DATOS DEPLOYS ============
const DEPLOYS_FILE = path.join(__dirname, "deploys.json");

function loadDeploys() {
    try {
        if (fs.existsSync(DEPLOYS_FILE)) {
            return JSON.parse(fs.readFileSync(DEPLOYS_FILE, "utf-8"));
        }
    } catch (e) { console.error("Error loading deploys:", e); }
    return {};
}

function saveDeploys(data) {
    try {
        fs.writeFileSync(DEPLOYS_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) { console.error("Error saving deploys:", e); }
}

let deploys = loadDeploys();

// ============ GENERADORES ============
function generateUniqueId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateSubdomain() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateCustomSubdomain(name) {
    return name.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').substring(0, 30) || 'project';
}

// ============ RATE LIMITER ============
const hits = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX = 100;

function rateLimiter(req, res, next) {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "?";
    const now = Date.now();
    const r = hits.get(ip);
    if (!r || now - r.start > WINDOW) {
        hits.set(ip, { count: 1, start: now });
        return next();
    }
    r.count++;
    if (r.count > MAX) {
        const retry = Math.ceil((WINDOW - (now - r.start)) / 1000);
        res.set("Retry-After", String(retry));
        return res.status(429).json({ error: "Too many requests", retryAfter: retry });
    }
    next();
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, r] of hits) {
        if (now - r.start > WINDOW) hits.delete(ip);
    }
}, 5 * 60 * 1000);

// ============ ANTI-BROWSER ============
function blockBrowsers(req, res, next) {
    if (!req.path.includes('/files/v1/loaders/')) return next();

    const ua = req.headers["user-agent"] || "";
    const uaLower = ua.toLowerCase();

    const isBrowser = uaLower.includes("chrome") || uaLower.includes("firefox") ||
        uaLower.includes("safari") || uaLower.includes("edg") || uaLower.includes("opr") ||
        uaLower.includes("trident") || uaLower.includes("webkit");

    const isExecutor = uaLower.includes("roblox") || uaLower.includes("synapse") ||
        uaLower.includes("krnl") || uaLower.includes("scriptware") || uaLower.includes("jjsploit") ||
        uaLower.includes("protosmasher") || uaLower.includes("fluxus") || uaLower.includes("vega") ||
        uaLower.includes("evon") || uaLower.includes("celery") || uaLower.includes("hydrogen") ||
        uaLower.includes("swift") || uaLower.includes("sirius") || uaLower.includes("electron") ||
        uaLower.includes("wearedevs") || uaLower.includes("luarmor") || uaLower.includes("paltidxr");

    const isUnknown = !ua || ua.length < 5;

    if (isBrowser && !isExecutor && !isUnknown) {
        const loaderCode = `loadstring(game:HttpGet("https://${BASE_DOMAIN}/files/v1/loaders/script.lua", true))()`;
        return res.status(403).type("html").send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Access Denied - Host Cloud</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0b12;
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #e0e0e0;
            padding: 20px;
        }
        .glass-card {
            background: rgba(20, 21, 31, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 24px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            text-align: center;
        }
        .icon { font-size: 72px; margin-bottom: 16px; }
        h1 { font-size: 24px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
        .subtitle { color: #888; font-size: 14px; margin-bottom: 24px; }
        .badge {
            display: inline-block;
            margin-top: 12px;
            padding: 4px 16px;
            background: rgba(139, 92, 246, 0.1);
            border: 1px solid rgba(139, 92, 246, 0.15);
            border-radius: 20px;
            font-size: 11px;
            color: #a78bfa;
        }
        .code-box {
            background: rgba(9, 10, 18, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 12px;
            padding: 16px 20px;
            margin-top: 16px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            color: #a78bfa;
            word-break: break-all;
            text-align: left;
            white-space: pre-wrap;
            line-height: 1.8;
            overflow-wrap: break-word;
        }
        .btn-copy {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            padding: 8px 20px;
            color: #e0e0e0;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 12px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .btn-copy:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(139, 92, 246, 0.3);
        }
        .btn-copy.copied {
            background: rgba(52, 211, 153, 0.15);
            border-color: rgba(52, 211, 153, 0.3);
            color: #34d399;
        }
        .footer-link {
            margin-top: 20px;
            font-size: 12px;
            color: #4a4a5a;
        }
        .footer-link a {
            color: #a78bfa;
            text-decoration: none;
        }
        .footer-link a:hover { text-decoration: underline; }
        .toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: rgba(20, 21, 31, 0.95);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(52, 211, 153, 0.3);
            border-radius: 12px;
            padding: 12px 24px;
            color: #e0e0e0;
            font-size: 14px;
            z-index: 1000;
            opacity: 0;
            transition: all 0.5s ease;
        }
        .toast.show {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    </style>
</head>
<body>
    <div class="glass-card">
        <div class="icon">🔒</div>
        <h1>You Are Blocked</h1>
        <p class="subtitle">Your browser has been detected and access is restricted.</p>
        <div class="badge">Browser Detected</div>

        <div class="code-box" id="codeDisplay">${loaderCode}</div>

        <button class="btn-copy" id="copyBtn" onclick="copyCode()">
            <i class="fa-regular fa-copy"></i>
            Copy Code
        </button>

        <div class="footer-link">
            This code has been protected by API hosting protection.<br>
            If you want to protect your code too, go to<br>
            <a href="https://${BASE_DOMAIN}" target="_blank">https://${BASE_DOMAIN}</a>
        </div>
    </div>

    <div id="toast" class="toast">
        <i class="fa-regular fa-circle-check mr-2" style="color:#34d399;"></i>
        <span id="toastMessage">Copied to clipboard!</span>
    </div>

    <script>
        const codeToCopy = "${loaderCode}";

        function copyCode() {
            navigator.clipboard.writeText(codeToCopy).then(() => {
                const btn = document.getElementById('copyBtn');
                btn.classList.add('copied');
                btn.innerHTML = '<i class="fa-regular fa-check"></i> Copied!';
                showToast('Code copied to clipboard!');
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Code';
                }, 2500);
            }).catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = codeToCopy;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showToast('Code copied to clipboard!');
            });
        }

        function showToast(message) {
            const toast = document.getElementById('toast');
            const msg = document.getElementById('toastMessage');
            msg.textContent = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2500);
        }
    </script>
</body>
</html>
        `);
    }
    next();
}

// ============ HEADERS DE SEGURIDAD ============
app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// ============ LOGGER ============
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ============ VALIDACIÓN ============
function validateScriptId(req, res, next) {
    const scriptId = req.params.scriptId;
    if (!scriptId || scriptId.length < 3) {
        return res.status(400).json({ error: "Invalid script ID" });
    }
    if (scriptId.includes('..') || scriptId.includes('/') || scriptId.includes('\\')) {
        return res.status(400).json({ error: "Invalid script ID format" });
    }
    next();
}

// ============ ROBOTS.TXT ============
app.get("/robots.txt", (req, res) => {
    const robots = `User-agent: *
Allow: /
Disallow: /files/v1/loaders/

Sitemap: https://${BASE_DOMAIN}/sitemap.xml`;
    res.header('Content-Type', 'text/plain');
    res.send(robots);
});

// ============ SITEMAP.XML ============
app.get("/sitemap.xml", (req, res) => {
    const activeDomains = Object.values(deploys)
        .filter(d => d.status === 'active')
        .map(d => `  <url>\n    <loc>${d.url}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`)
        .join('\n');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${BASE_DOMAIN}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${activeDomains}
</urlset>`;
    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
});

// ============ RUTA PRINCIPAL ============
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ============ HOSTING SCRIPTS ============
app.post("/api/scripts", rateLimiter, (req, res) => {
    try {
        const { script, name } = req.body;

        if (!script || script.length < 10) {
            return res.status(400).json({ success: false, error: "Script too short or empty" });
        }

        if (script.length > 1000000) {
            return res.status(400).json({ success: false, error: "Script too large. Maximum 1MB" });
        }

        let scriptId = generateUniqueId();
        while (scriptsDB[scriptId + '.lua']) {
            scriptId = generateUniqueId();
        }

        const fileName = `${scriptId}.lua`;
        const userScriptName = name || 'unnamed';

        const protectedScript = `--[[ Host Cloud Protected ]]--
--[[ Script ID: ${scriptId} ]]--
--[[ Protection: Host Cloud ACTIVE ]]--

--[[ ⚠️ DO NOT MODIFY THIS SCRIPT ⚠️ ]]--
--[[ Your script starts here ]]--

${script}

--[[ End of script ]]--
--[[ Host Cloud | ID: ${scriptId} ]]--`;

        scriptsDB[fileName] = {
            id: fileName,
            name: userScriptName,
            scriptId: scriptId,
            content: protectedScript,
            created: new Date().toISOString(),
            protected: true
        };

        saveScripts(scriptsDB);

        const url = `https://${BASE_DOMAIN}/files/v1/loaders/${fileName}`;

        res.json({
            success: true,
            url: url,
            scriptId: scriptId,
            name: userScriptName,
            created: new Date().toISOString(),
            message: "Script hosted successfully with Host Cloud protection"
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

app.get("/files/v1/loaders/:scriptId",
    rateLimiter,
    blockBrowsers,
    validateScriptId,
    (req, res) => {
        const scriptId = req.params.scriptId;
        scriptsDB = loadScripts();

        if (scriptsDB[scriptId]) {
            const scriptData = scriptsDB[scriptId];
            console.log(`[${new Date().toISOString()}] Script served: ${scriptId}`);
            res.type("text").send(scriptData.content);
        } else {
            res.status(404).type("text").send("Script not found");
        }
    }
);

app.get("/api/scripts", rateLimiter, (req, res) => {
    scriptsDB = loadScripts();
    const scriptList = Object.keys(scriptsDB).map(key => ({
        id: scriptsDB[key].id,
        scriptId: scriptsDB[key].scriptId,
        name: scriptsDB[key].name,
        created: scriptsDB[key].created
    }));

    res.json({
        scripts: scriptList,
        count: scriptList.length
    });
});

// ============ DEPLOY PROYECTOS ============
app.post("/api/deploy", rateLimiter, async (req, res) => {
    try {
        const { repo, token, branch, platform, projectName } = req.body;

        if (!repo || !token) {
            return res.status(400).json({ error: "Repository and token are required" });
        }

        let subdomain;
        if (projectName && projectName.trim()) {
            subdomain = generateCustomSubdomain(projectName);
            const exists = Object.values(deploys).some(d => d.subdomain === subdomain);
            if (exists) {
                subdomain = subdomain + '-' + crypto.randomBytes(3).toString('hex');
            }
        } else {
            subdomain = generateSubdomain();
        }

        const deployId = crypto.randomBytes(8).toString('hex');
        const fullDomain = `${subdomain}.${BASE_DOMAIN}`;
        const fullUrl = `https://${fullDomain}`;

        const deployData = {
            id: deployId,
            repo: repo,
            branch: branch || 'main',
            platform: platform || 'render',
            subdomain: subdomain,
            domain: fullDomain,
            url: fullUrl,
            status: 'deploying',
            projectName: projectName || 'unnamed',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        deploys[deployId] = deployData;
        saveDeploys(deploys);

        // Proceso de deploy simulado
        const deployProcess = async () => {
            try {
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

                deployData.status = 'active';
                deployData.deployedAt = new Date().toISOString();
                deployData.updatedAt = new Date().toISOString();
                saveDeploys(deploys);

                console.log(`✅ Deployed ${repo} → ${fullUrl}`);
            } catch (error) {
                deployData.status = 'failed';
                deployData.error = error.message;
                deployData.updatedAt = new Date().toISOString();
                saveDeploys(deploys);
                console.error(`❌ Deploy failed: ${error.message}`);
            }
        };

        deployProcess();

        res.json({
            success: true,
            url: fullUrl,
            domain: fullDomain,
            subdomain: subdomain,
            deployId: deployId,
            baseDomain: BASE_DOMAIN,
            status: 'deploying',
            message: `Your code has been deployed and successfully added to domain ${fullDomain}`
        });

    } catch (error) {
        console.error('Deploy error:', error);
        res.status(500).json({ error: "Deployment failed", message: error.message });
    }
});

app.get("/api/deploys", rateLimiter, (req, res) => {
    const list = Object.values(deploys);
    res.json({
        deploys: list,
        count: list.length,
        baseDomain: BASE_DOMAIN
    });
});

app.get("/api/deploy/:id", (req, res) => {
    const deploy = deploys[req.params.id];
    if (deploy) {
        res.json(deploy);
    } else {
        res.status(404).json({ error: "Deploy not found" });
    }
});

app.delete("/api/deploy/:id", (req, res) => {
    if (deploys[req.params.id]) {
        const deploy = deploys[req.params.id];
        delete deploys[req.params.id];
        saveDeploys(deploys);
        res.json({
            success: true,
            message: `Deploy ${deploy.subdomain}.${BASE_DOMAIN} removed`
        });
    } else {
        res.status(404).json({ error: "Deploy not found" });
    }
});

app.get("/api/domains", (req, res) => {
    const activeDomains = Object.values(deploys)
        .filter(d => d.status === 'active')
        .map(d => ({
            url: d.url,
            subdomain: d.subdomain,
            project: d.projectName,
            deployedAt: d.deployedAt
        }));

    res.json({
        baseDomain: BASE_DOMAIN,
        totalDomains: activeDomains.length,
        domains: activeDomains
    });
});

// ============ HEALTH CHECK ============
app.get("/health", (req, res) => {
    const scriptCount = Object.keys(scriptsDB).length;
    const deployCount = Object.keys(deploys).length;
    const activeDomains = Object.values(deploys).filter(d => d.status === 'active').length;

    res.json({
        status: "online",
        service: "Host Cloud API",
        version: "2.0.0",
        baseDomain: BASE_DOMAIN,
        scripts: scriptCount,
        deploys: deployCount,
        totalDomains: activeDomains,
        timestamp: new Date().toISOString()
    });
});

// ============ FUNCIÓN SLEEP ============
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ INICIALIZACIÓN ============
if (!fs.existsSync(SCRIPTS_FILE)) {
    saveScripts({});
}
if (!fs.existsSync(DEPLOYS_FILE)) {
    saveDeploys({});
}

app.listen(PORT, () => {
    console.log(`✅ Host Cloud running on port ${PORT}`);
    console.log(`🌐 Base Domain: https://${BASE_DOMAIN}`);
    console.log(`📡 API: https://${BASE_DOMAIN}/api/scripts`);
    console.log(`🚀 Deploy: https://${BASE_DOMAIN}/api/deploy`);
    console.log(`💚 Health: https://${BASE_DOMAIN}/health`);
});
