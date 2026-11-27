const http = require('http');
const https = require('https');
const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const os = require('os');
const fs = require('fs');
const dgram = require('dgram');
const qrcode = require('qrcode');

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

const { execSync, exec } = require('child_process');

// Sanal ag adaptörlerini (WSL, Hyper-V, Docker, VMware, VirtualBox, VPN) eleyerek gercek Wi-Fi/Ethernet LAN IP'lerini bul
function getAllLanIps() {
    const interfaces = os.networkInterfaces();
    const candidates = [];
    const virtualPattern = /(vethernet|wsl|docker|hyper-v|virtualbox|vmware|vbox|loopback|tailscale|zerotier|hamachi|nordlynx|wireguard|tun|tap|bluetooth)/i;

    for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs) continue;
        for (const iface of addrs) {
            if (iface.family !== 'IPv4' || iface.internal) continue;
            if (iface.address.startsWith('169.254.')) continue; // APIPA

            let score = 0;
            if (virtualPattern.test(name)) score -= 100;
            if (/wi-?fi|wlan|wireless/i.test(name)) score += 50;
            if (/ethernet|lan/i.test(name)) score += 45;
            if (iface.address.startsWith('192.168.')) score += 30;
            else if (iface.address.startsWith('10.')) score += 20;
            else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(iface.address)) score += 10;

            candidates.push({ name, address: iface.address, score });
        }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates;
}

function getLocalIpAddress() {
    const all = getAllLanIps();
    return all.length > 0 ? all[0].address : '127.0.0.1';
}

const lanInterfaces = getAllLanIps();
const localIp = lanInterfaces.length > 0 ? lanInterfaces[0].address : '127.0.0.1';
const httpUrl = `http://${localIp}:${HTTP_PORT}`;
const httpsUrl = `https://${localIp}:${HTTPS_PORT}`;

// Gecerli modern TLS sertifikasi olustur veya yukle (ERR_SSL_VERSION_OR_CIPHER_MISMATCH hatasini onler)

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

// Canli Telemetri & Debug Kaydedici (Son 200 Hareket Ornegi)
const telemetryBuffer = [];
function recordTelemetry(sample) {
    if (telemetryBuffer.length > 200) telemetryBuffer.shift();
    telemetryBuffer.push({
        t: Date.now(),
        ...sample
    });
}

// HTTP ve HTTPS Sunuculari olusturalim (sslOptions null ise cokmeyi onle)
const httpServer = http.createServer(app);
const httpsServer = sslOptions ? https.createServer(sslOptions, app) : null;

// WebSocket sunuculari (perMessageDeflate devre disi: Gecikmeyi minimuma indirmek icin sikistirma kapatildi)
const wssOptions = { perMessageDeflate: false, maxPayload: 1024 * 64 };
const wssHttp = new WebSocketServer({ server: httpServer, ...wssOptions });
const wssHttps = httpsServer ? new WebSocketServer({ server: httpsServer, ...wssOptions }) : null;

const allClients = new Set();
const authFailures = new Map(); // IP -> { count, lockedUntil }

// Yalnizca yerel makineden (localhost) erisim kontrolu
function requireLocalhost(req, res, next) {
    const ip = req.socket.remoteAddress || '';
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (!isLocal) {
        return res.status(403).json({ success: false, error: 'Bu uca yalnizca yerel bilgisayardan (localhost) erisilebilir.' });
    }
    next();
}

// Baglanan tum istemcilere WebSocket yonetimi
function handleWebSocketConnection(ws, req) {
    allClients.add(ws);
    
    // Nagle Algoritmasini Devre Disi Birak (TCP_NODELAY: Gecikmeyi 1-2ms seviyesine indirir)
    if (ws._socket && ws._socket.setNoDelay) {
        ws._socket.setNoDelay(true);
    }

    const clientIp = req.socket.remoteAddress;
    const proto = req.socket.encrypted ? 'WSS (Secure)' : 'WS (Plain)';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const isPinEnabled = !!(monitorManager.settings.security && monitorManager.settings.security.pinAuthEnabled);
    ws.isAuthenticated = !isPinEnabled;

    log('INFO', 'WS:CONN', `Client connected: ${clientIp} via ${proto} [TCP_NODELAY=ON, AuthRequired=${!ws.isAuthenticated}]`, {
        activeClients: allClients.size,
        userAgent: userAgent.substring(0, 40)
    });

    // Ilk baglantida monitorler ve mevcut context bilgisini yolla
    const initData = {
        type: 'init',
        monitors: monitorManager.monitors,
        context: appDetector.currentContext,
        processName: appDetector.currentProcess,
        windowTitle: appDetector.currentTitle,
        settings: monitorManager.settings,
        requiresAuth: !ws.isAuthenticated,
        serverTime: Date.now()
    };
    ws.send(JSON.stringify(initData));

    let packetCount = 0;
    let lastLogTime = Date.now();

    ws.on('message', (msgBuffer) => {
        try {
            const data = JSON.parse(msgBuffer.toString());
            packetCount++;

            // Kimlik Dogrulama Mesaji (Rate Limit korumali)
            if (data.type === 'auth') {
                const now = Date.now();
                const failRecord = authFailures.get(clientIp) || { count: 0, lockedUntil: 0 };
                if (failRecord.lockedUntil > now) {
                    const waitSec = Math.ceil((failRecord.lockedUntil - now) / 1000);
                    ws.send(JSON.stringify({ type: 'auth_result', success: false, error: `Çok fazla hatalı deneme. ${waitSec} sn bekleyin.` }));
                    return;
                }

                const targetPin = (monitorManager.settings.security && monitorManager.settings.security.pin) ? monitorManager.settings.security.pin : '1234';
                if (data.pin === targetPin) {
                    authFailures.delete(clientIp);
                    ws.isAuthenticated = true;
                    ws.send(JSON.stringify({ type: 'auth_result', success: true }));
                    log('INFO', 'AUTH', `Client authenticated successfully from ${clientIp}`);
                } else {
                    failRecord.count += 1;
                    if (failRecord.count >= 5) {
                        failRecord.lockedUntil = now + 30000;
                        failRecord.count = 0;
                    }
                    authFailures.set(clientIp, failRecord);
                    ws.send(JSON.stringify({ type: 'auth_result', success: false, error: 'Hatalı PIN kodu!' }));
                    log('WARN', 'AUTH', `Client authentication failed from ${clientIp}`);
                }
                return;
            }

            // PIN Dogrulamasi Gerekliyse ve Dogrulanmamissa diger mesajlari reddet
            if (!ws.isAuthenticated) {
                ws.send(JSON.stringify({ type: 'auth_required' }));
                return;
            }

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
                    recordTelemetry({
                        type: 'move',
                        dx: data.dx,
                        dy: data.dy,
                        monId: moveResult.currentMonitorId,
                        client_t: data.t
                    });
                    if (Date.now() - lastLogTime > 150) {
                        log('DEBUG', 'INPUT:MOVE', `dx=${(data.dx || 0).toFixed(2)} dy=${(data.dy || 0).toFixed(2)}`, {
                            monId: moveResult.currentMonitorId,
                            boundary: moveResult.boundaryHit
                        });
                        lastLogTime = Date.now();
                    }
                    break;

                case 'move_abs':
                    win32.setCursorPos(data.x, data.y);
                    recordTelemetry({
                        type: 'laser_abs',
                        x: data.x,
                        y: data.y,
                        rawYaw: data.yaw,
                        rawPitch: data.pitch,
                        client_t: data.t
                    });
                    if (Date.now() - lastLogTime > 150) {
                        log('DEBUG', 'INPUT:LASER', `abs_x=${Math.round(data.x)} abs_y=${Math.round(data.y)}`, {
                            yaw: data.yaw,
                            pitch: data.pitch
                        });
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

                // === YENI PRO OZELLIKLER: PANO, UYGULAMA ACICI, GUC KONTROLU ===
                case 'clipboard_set':
                    if (typeof data.text === 'string' && data.text.length <= 20000) {
                        const b64 = Buffer.from(data.text, 'utf16le').toString('base64');
                        const ps = `$t=[System.Text.Encoding]::Unicode.GetString([System.Convert]::FromBase64String('${b64}')); Set-Clipboard -Value $t`;
                        exec(`powershell -NoProfile -Command "${ps}"`, (err) => {
                            if (!err && data.paste) {
                                win32.runCombo(['ctrl', 'v']);
                            }
                            ws.send(JSON.stringify({ type: 'clipboard_ack', success: !err, pasted: !!data.paste }));
                        });
                    }
                    break;

                case 'clipboard_get':
                    exec('powershell -NoProfile -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-Clipboard -Raw"', { encoding: 'utf8' }, (err, stdout) => {
                        ws.send(JSON.stringify({
                            type: 'clipboard_data',
                            text: err ? '' : (stdout || '').trim()
                        }));
                    });
                    break;

                case 'open_url':
                    if (typeof data.url === 'string' && /^https?:\/\//i.test(data.url.trim())) {
                        const safeUrl = data.url.trim().replace(/"/g, '');
                        exec(`start "" "${safeUrl}"`, { shell: 'cmd.exe' });
                        log('INFO', 'ACTION:URL', safeUrl);
                    }
                    break;

                case 'launch_app': {
                    const appCommands = {
                        browser: 'start "" "https://www.google.com"',
                        youtube: 'start "" "https://www.youtube.com"',
                        spotify: 'start "" "spotify:"',
                        explorer: 'start "" explorer.exe',
                        notepad: 'start "" notepad.exe',
                        calc: 'start "" calc.exe',
                        settings: 'start "" ms-settings:',
                        taskmgr: 'start "" taskmgr.exe'
                    };
                    const cmd = appCommands[data.app];
                    if (cmd) {
                        exec(cmd, { shell: 'cmd.exe' });
                        log('INFO', 'ACTION:APP', `launch=${data.app}`);
                    }
                    break;
                }

                case 'system_power':
                    log('INFO', 'ACTION:POWER', `action=${data.action}`);
                    if (data.action === 'lock') {
                        exec('rundll32.exe user32.dll,LockWorkStation');
                    } else if (data.action === 'sleep') {
                        exec('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)"');
                    } else if (data.action === 'display_off') {
                        exec('powershell -NoProfile -Command "(Add-Type \'[DllImport(\\\"user32.dll\\\")]public static extern int SendMessage(int h,int m,int w,int l);\' -Name a -Pas)::SendMessage(-1,0x0112,0xF170,2)"');
                    }
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
if (wssHttps) wssHttps.on('connection', handleWebSocketConnection);

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

// Canli Sistem Telemetrisi (CPU, RAM, Pil) — yalnizca bagli istemci varken 4 saniyede bir
let prevCpuInfo = os.cpus();
function getCpuPercent() {
    const cur = os.cpus();
    let idleDiff = 0;
    let totalDiff = 0;
    for (let i = 0; i < cur.length; i++) {
        const p = prevCpuInfo[i] ? prevCpuInfo[i].times : cur[i].times;
        const c = cur[i].times;
        const pTotal = p.user + p.nice + p.sys + p.idle + p.irq;
        const cTotal = c.user + c.nice + c.sys + c.idle + c.irq;
        idleDiff += (c.idle - p.idle);
        totalDiff += (cTotal - pTotal);
    }
    prevCpuInfo = cur;
    if (totalDiff <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((1 - idleDiff / totalDiff) * 100)));
}

setInterval(() => {
    if (allClients.size === 0) return;
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ramPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
    const cpuPercent = getCpuPercent();
    const battery = win32.getBatteryStatus();

    const payload = JSON.stringify({
        type: 'system_stats',
        cpu: cpuPercent,
        ram: ramPercent,
        battery: battery.percent,
        charging: battery.charging
    });

    for (const client of allClients) {
        if (client.readyState === 1 && client.isAuthenticated) {
            client.send(payload);
        }
    }
}, 4000);

// Hizli kesif (Discovery) ping ucu — Android/Web istemcilerin LAN taramasinda <5ms'de dogrulamasi icin
app.get('/api/ping', (req, res) => {
    res.json({
        app: 'RemotePC+',
        version: '2.3.0',
        name: os.hostname(),
        ip: localIp,
        ips: lanInterfaces.map(i => i.address),
        httpPort: HTTP_PORT,
        httpsPort: HTTPS_PORT
    });
});

// REST API Uclari
app.get('/api/info', (req, res) => {
    res.json({
        appName: 'RemotePC+',
        hostname: os.hostname(),
        localIp: localIp,
        allIps: lanInterfaces,
        httpUrl: httpUrl,
        httpsUrl: httpsUrl,
        clientsCount: allClients.size,
        monitors: monitorManager.monitors,
        context: appDetector.getState(),
        settings: monitorManager.settings
    });
});

// Ayarlari guncelle (Yalnizca localhost)
app.post('/api/settings', requireLocalhost, (req, res) => {
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

// Canli Telemetri Verisini Getir
app.get('/api/telemetry', (req, res) => {
    res.json({
        count: telemetryBuffer.length,
        data: telemetryBuffer
    });
});

// Istemciden toplu sensor logu kaydet
app.post('/api/telemetry', (req, res) => {
    const logs = req.body;
    if (Array.isArray(logs)) {
        logs.forEach(recordTelemetry);
    } else if (logs) {
        recordTelemetry(logs);
    }
    res.json({ success: true, count: telemetryBuffer.length });
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
            color: { dark: '#f5f5f7', light: '#1c1c1e' }
        });
        res.json({ url: targetUrl, qr: qrSvg });
    } catch (e) {
        res.status(500).send('QR olusturulamadi');
    }
});

// Yonlendirmeler
app.get('/admin', requireLocalhost, (req, res) => {
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
        // Istegi gonderen telefonla ayni /24 alt agindaki IP'yi sec (en dogru IP garantisi)
        const remotePrefix = (rinfo.address || '').split('.').slice(0, 3).join('.');
        const matchingIface = lanInterfaces.find(i => i.address.startsWith(remotePrefix + '.'));
        const bestIp = matchingIface ? matchingIface.address : localIp;

        const responseData = JSON.stringify({
            app: 'RemotePC+',
            name: os.hostname(),
            ip: bestIp,
            ips: lanInterfaces.map(i => i.address),
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

// Sunuculari 0.0.0.0 uzerinde baslat (tum yerel ag arayuzlerinden erisim garantisi)
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`[HTTP] Sunucu baslatildi: ${httpUrl} (Bind: 0.0.0.0:${HTTP_PORT})`);
    if (lanInterfaces.length > 1) {
        console.log(`[NET] Tum algilanan LAN IP'leri: ${lanInterfaces.map(i => `${i.address} (${i.name})`).join(', ')}`);
    }
});

if (httpsServer) {
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
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
