const http = require('http');
const https = require('https');
const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const os = require('os');
const fs = require('fs');
const dgram = require('dgram');
const qrcode = require('qrcode');
const selfsigned = require('selfsigned');

const win32 = require('./win32_api');
const monitorManager = require('./monitor_manager');
const appDetector = require('./app_detector');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ayarlari yukleyelim
let settings = {};
try {
    settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
} catch (e) {
    console.log('settings.json yuklenemedi');
}

const HTTP_PORT = process.env.PORT || settings.httpPort || 5000;
const HTTPS_PORT = process.env.HTTPS_PORT || settings.httpsPort || 5443;

// Yerel IP adresini bulalim (Wi-Fi veya Ethernet)
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Sadece IPv4 ve loopback olmayanlari alalim
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const localIp = getLocalIpAddress();
const httpUrl = `http://${localIp}:${HTTP_PORT}`;
const httpsUrl = `https://${localIp}:${HTTPS_PORT}`;

// Gecerli modern TLS sertifikasi olustur veya yukle (ERR_SSL_VERSION_OR_CIPHER_MISMATCH hatasini onler)
const { execSync } = require('child_process');

function getOrGenerateCert(ip) {
    const certPath = path.join(__dirname, 'server.pfx');
    if (!fs.existsSync(certPath)) {
        try {
            console.log(`[SSL] Yeni TLS sertifikasi uretiliyor (IP: ${ip})...`);
            const psCmd = `$cert = New-SelfSignedCertificate -DnsName "${ip}", "localhost", "127.0.0.1" -CertStoreLocation "cert:\\CurrentUser\\My" -KeyExportPolicy Exportable -KeyLength 2048 -KeyAlgorithm RSA -HashAlgorithm SHA256; $pwd = ConvertTo-SecureString -String "remotepc123" -Force -AsPlainText; Export-PfxCertificate -Cert $cert -FilePath "${certPath.replace(/\\/g, '\\\\')}" -Password $pwd`;
            execSync(`powershell -Command "${psCmd}"`, { stdio: 'ignore' });
        } catch (e) {
            console.log('PowerShell sertifika olusturma hatasi:', e.message);
        }
    }
    if (fs.existsSync(certPath)) {
        return {
            pfx: fs.readFileSync(certPath),
            passphrase: 'remotepc123'
        };
    }
    return null;
}

const sslOptions = getOrGenerateCert(localIp);

// Gelismis Gelistirici Log Formatlayici (Developer Debug Logger)
function log(level, subsystem, message, meta = null) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 23);
    const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
    console.log(`[${timestamp}] [${level.padEnd(5)}] [${subsystem.padEnd(12)}] ${message}${metaStr}`);
}

// HTTP ve HTTPS Sunuculari olusturalim
const httpServer = http.createServer(app);
const httpsServer = https.createServer(sslOptions, app);

// WebSocket sunuculari
const wssHttp = new WebSocketServer({ server: httpServer });
const wssHttps = new WebSocketServer({ server: httpsServer });

const allClients = new Set();

// Baglanan tum istemcilere WebSocket yonetimi
function handleWebSocketConnection(ws, req) {
    allClients.add(ws);
    const clientIp = req.socket.remoteAddress;
    const proto = req.socket.encrypted ? 'WSS (Secure)' : 'WS (Plain)';
    const userAgent = req.headers['user-agent'] || 'unknown';

    log('INFO', 'WS:CONN', `Client connected: ${clientIp} via ${proto}`, {
        activeClients: allClients.size,
        userAgent: userAgent.substring(0, 45) + '...'
    });

    // Ilk baglantida monitorler ve mevcut context bilgisini yolla
    const initData = {
        type: 'init',
        monitors: monitorManager.monitors,
        context: appDetector.currentContext,
        processName: appDetector.currentProcess,
        windowTitle: appDetector.currentTitle,
        settings: monitorManager.settings,
        serverTime: Date.now()
    };
    ws.send(JSON.stringify(initData));

    let packetCount = 0;
    let lastLogTime = Date.now();

    ws.on('message', (msgBuffer) => {
        try {
            const data = JSON.parse(msgBuffer.toString());
            packetCount++;

            switch (data.type) {
                case 'move':
                    const moveResult = monitorManager.processMovement(data.dx || 0, data.dy || 0);
                    if (data.t) {
                        ws.send(JSON.stringify({
                            type: 'move_ack',
                            t: data.t,
                            boundaryHit: moveResult.boundaryHit,
                            monId: moveResult.currentMonitorId
                        }));
                    }
                    if (Date.now() - lastLogTime > 150) {
                        log('DEBUG', 'INPUT:MOVE', `dx=${(data.dx || 0).toFixed(2)} dy=${(data.dy || 0).toFixed(2)}`, {
                            monId: moveResult.currentMonitorId,
                            boundary: moveResult.boundaryHit
                        });
                        lastLogTime = Date.now();
                    }
                    break;

                case 'move_abs':
                    // Mutlak Lazer Konumlandirma (Laser Pointer Raycasting)
                    win32.setCursorPos(data.x, data.y);
                    if (Date.now() - lastLogTime > 150) {
                        log('DEBUG', 'INPUT:LASER', `abs_x=${Math.round(data.x)} abs_y=${Math.round(data.y)}`);
                        lastLogTime = Date.now();
                    }
                    break;

                case 'click':
                    log('INFO', 'INPUT:CLICK', `button=${data.button || 'left'} state=${data.state || 'click'}`);
                    win32.mouseClick(data.button || 'left', data.state || 'click');
                    break;

                case 'scroll':
                    log('DEBUG', 'INPUT:SCROLL', `dy=${(data.dy || 0).toFixed(2)} dx=${(data.dx || 0).toFixed(2)}`);
                    win32.scrollWheel(data.dy || 0, data.dx || 0);
                    break;

                case 'zoom':
                    log('INFO', 'INPUT:ZOOM', `delta=${data.delta}`);
                    win32.zoom(data.delta || 0);
                    break;

                case 'key':
                    log('INFO', 'INPUT:KEY', `key=${data.key} state=${data.state || 'press'}`);
                    win32.keyPress(data.key, data.state || 'press');
                    break;

                case 'type':
                    log('INFO', 'INPUT:TYPE', `text="${data.text}"`);
                    if (data.text) {
                        win32.typeString(data.text);
                    }
                    break;

                case 'macro':
                    log('INFO', 'INPUT:MACRO', `keys=${JSON.stringify(data.keys)}`);
                    if (data.keys && Array.isArray(data.keys)) {
                        win32.runCombo(data.keys);
                    }
                    break;

                case 'media':
                    log('INFO', 'INPUT:MEDIA', `action=${data.action}`);
                    win32.mediaControl(data.action);
                    break;

                case 'presentation':
                    log('INFO', 'INPUT:PRES', `action=${data.action}`);
                    win32.presentationControl(data.action);
                    break;

                case 'monitor_jump':
                    const jumpRes = monitorManager.jumpToMonitor(data.monitorId);
                    log('INFO', 'MONITOR:JUMP', `Target Display ID=${data.monitorId}`, jumpRes);
                    if (jumpRes) {
                        ws.send(JSON.stringify({
                            type: 'monitor_jumped',
                            monitorId: jumpRes.monitorId,
                            x: jumpRes.x,
                            y: jumpRes.y
                        }));
                    }
                    break;

                case 'loupe_req':
                    const loupe = win32.captureLoupeAroundCursor(data.width || 120, data.height || 120);
                    if (loupe) {
                        ws.send(JSON.stringify({
                            type: 'loupe_frame',
                            data: loupe.data,
                            x: loupe.x,
                            y: loupe.y,
                            width: loupe.width,
                            height: loupe.height
                        }));
                    }
                    break;

                case 'ping':
                    ws.send(JSON.stringify({
                        type: 'pong',
                        t: data.t,
                        serverTime: Date.now()
                    }));
                    break;
            }
        } catch (err) {
            log('ERROR', 'WS:MSG_ERR', err.message);
        }
    });

    ws.on('close', (code, reason) => {
        allClients.delete(ws);
        log('WARN', 'WS:DISCONN', `Client disconnected: ${clientIp} code=${code}`, {
            totalPacketsProcessed: packetCount,
            remainingClients: allClients.size
        });
    });

    ws.on('error', (err) => {
        log('ERROR', 'WS:SOCKET_ERR', err.message);
    });
}

wssHttp.on('connection', handleWebSocketConnection);
wssHttps.on('connection', handleWebSocketConnection);

// Aktif pencere degistiginde tum bagli telefonlara haber ver (Dinamik Arayuz Degisimi)
appDetector.on('contextChange', (info) => {
    const payload = JSON.stringify({
        type: 'context_update',
        context: info.context,
        processName: info.processName,
        windowTitle: info.windowTitle
    });

    for (const client of allClients) {
        if (client.readyState === 1) { // OPEN
            client.send(payload);
        }
    }
});

// REST API Uclari
app.get('/api/info', (req, res) => {
    res.json({
        appName: 'Universal Wireless Control Hub (Remote-PC-Plus)',
        localIp: localIp,
        httpUrl: httpUrl,
        httpsUrl: httpsUrl,
        clientsCount: allClients.size,
        monitors: monitorManager.monitors,
        context: appDetector.getState(),
        settings: monitorManager.settings
    });
});

// Ayarlari guncelle
app.post('/api/settings', (req, res) => {
    try {
        const newSettings = req.body;
        monitorManager.settings = Object.assign(monitorManager.settings, newSettings);
        fs.writeFileSync('./settings.json', JSON.stringify(monitorManager.settings, null, 2), 'utf8');
        monitorManager.refreshMonitors();
        appDetector.loadRules();

        // Tum istemcilere guncel ayarlari gonder
        const updateMsg = JSON.stringify({
            type: 'settings_updated',
            settings: monitorManager.settings,
            monitors: monitorManager.monitors
        });
        for (const c of allClients) {
            if (c.readyState === 1) c.send(updateMsg);
        }

        res.json({ success: true, settings: monitorManager.settings });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// QR Code gorseli uret
app.get('/api/qr', async (req, res) => {
    try {
        // Varsayilan olarak HTTP linkini verelim (Guvenlik uyarisi ve SSL hatasi vermeden aninda acilir)
        const isHttps = req.query.https === 'true';
        const targetUrl = isHttps ? httpsUrl : httpUrl;
        const qrSvg = await qrcode.toDataURL(targetUrl, {
            errorCorrectionLevel: 'M',
            margin: 2,
            scale: 8,
            color: { dark: '#00e5ff', light: '#0d1117' }
        });
        res.json({ url: targetUrl, qr: qrSvg });
    } catch (e) {
        res.status(500).send('QR olusturulamadi');
    }
});

// Yonlendirmeler
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// UDP Discovery yayini (Otomatik Ag Kesfi)
const udpServer = dgram.createSocket('udp4');
udpServer.on('error', (err) => {
    console.log('UDP yayin hatasi:', err.message);
});

udpServer.on('message', (msg, rinfo) => {
    const messageStr = msg.toString();
    if (messageStr.includes('DISCOVER_REMOTEPC')) {
        const responseData = JSON.stringify({
            name: os.hostname(),
            ip: localIp,
            httpPort: HTTP_PORT,
            httpsPort: HTTPS_PORT
        });
        udpServer.send(responseData, rinfo.port, rinfo.address);
    }
});

udpServer.bind(5055, () => {
    try {
        udpServer.setBroadcast(true);
        console.log('[Discovery] UDP otomatik eslesme yayini aktif (Port 5055).');
    } catch (e) {}
});

// Sunuculari baslat
httpServer.listen(HTTP_PORT, () => {
    console.log(`[HTTP] Sunucu baslatildi: ${httpUrl}`);
});

if (sslOptions) {
    httpsServer.listen(HTTPS_PORT, () => {
        console.log(`[HTTPS] Guvenli sunucu baslatildi: ${httpsUrl}`);
    });
}

// Arka plan pencere takipcisini baslat
appDetector.start(800);

// Terminalde QR Code ve Bilgi Paneli Basalim
setTimeout(async () => {
    console.log('\n=============================================================');
    console.log('       UNIVERSAL WIRELESS CONTROL HUB (Remote-PC-Plus)        ');
    console.log('=============================================================');
    console.log(`[1] Mobil Baglanti (ONERILEN - Dogrudan): ${httpUrl}`);
    console.log(`[2] Mobil Baglanti (HTTPS):              ${httpsUrl}`);
    console.log(`[3] Masaustu Kontrol Paneli:             http://localhost:${HTTP_PORT}/admin`);
    console.log('-------------------------------------------------------------');
    console.log('Telefonunuzun tarayicisindan (Chrome/Safari) su adresi acin:');
    console.log(`👉  ${httpUrl}`);
    console.log('veya asagidaki QR kodu telefon kameranizla okutun:\n');

    try {
        const terminalQR = await qrcode.toString(httpUrl, { type: 'terminal', small: true });
        console.log(terminalQR);
    } catch (e) {
        console.log('QR kod terminale basilamadi.');
    }
    console.log('=============================================================\n');
}, 300);
