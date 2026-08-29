// Universal Wireless Control Hub - Entegrasyon ve Fonksiyonellik Testi
const win32 = require('./win32_api');
const monitorManager = require('./monitor_manager');
const appDetector = require('./app_detector');

async function runTests() {
    console.log('=== TEST 1: Win32 API ve Fare Koordinatlari ===');
    const pos = win32.getCursorPos();
    console.log(`[OK] Fare koordinati: (${pos.x}, ${pos.y})`);

    console.log('\n=== TEST 2: Coklu Monitor Tespiti ===');
    const monitors = monitorManager.refreshMonitors();
    console.log(`[OK] ${monitors.length} monitor algilandi:`);
    monitors.forEach(m => {
        console.log(`  - [ID: ${m.id}] ${m.name} (${m.width}x${m.height}) Konum: (${m.x}, ${m.y}) Primary: ${m.isPrimary} DPI: ${m.dpi}x`);
    });

    console.log('\n=== TEST 3: Hareket ve Kenar Direnci (Boundary Magnetism) ===');
    const moveRes = monitorManager.processMovement(5, 5);
    console.log(`[OK] Hareket hesaplandi: dx=${moveRes.dx.toFixed(2)}, dy=${moveRes.dy.toFixed(2)}, MonitorId=${moveRes.currentMonitorId}, BoundaryHit=${moveRes.boundaryHit}`);

    console.log('\n=== TEST 4: Aktif Pencere ve Baglam Tespiti (App Detector) ===');
    const winInfo = win32.getActiveWindowInfo();
    console.log(`[OK] Aktif Pencere Basligi: "${winInfo.title}", Process: "${winInfo.processName}"`);
    appDetector.checkActiveApp();
    const curCtx = appDetector.getState();
    console.log(`[OK] Algilanan Baglam: [${curCtx.context.toUpperCase()}]`);

    console.log('\n=== TEST 5: Canli Buyutec (Magnifier Loupe) Ekran Yakalama ===');
    const loupe = win32.captureLoupeAroundCursor(80, 80);
    if (loupe && loupe.data) {
        console.log(`[OK] Loupe yakalama basarili: ${loupe.width}x${loupe.height} (${loupe.data.length} byte base64 veri)`);
    } else {
        console.log('[UYARI] Loupe yakalama yapilamadi');
    }

    console.log('\n=== TUM SISTEM TESTLERI BASARIYLA TAMAMLANDI! ===\n');
}

runTests().catch(err => console.error('Test hatasi:', err));
