// Universal Wireless Control Hub - 3D Uzamsal Lazer Kumanda Motoru (3D Spatial Raycaster)
// 1 Euro Titreme Önleme Filtresi ve 2 Köşe (Sol-Üst / Sağ-Alt) Mutlak Kalibrasyon

class OneEuroFilter {
    constructor(freq = 60, minCutoff = 0.4, beta = 0.06, dCutoff = 1.0) {
        this.freq = freq;
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
        this.xPrev = null;
        this.dxPrev = 0;
        this.tPrev = null;
    }

    alpha(cutoff, dt) {
        const tau = 1.0 / (2 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / dt);
    }

    filter(x, timestamp = performance.now() / 1000) {
        if (this.tPrev === null) {
            this.tPrev = timestamp;
            this.xPrev = x;
            this.dxPrev = 0;
            return x;
        }

        const dt = Math.max(0.001, timestamp - this.tPrev);
        this.tPrev = timestamp;

        const dx = (x - this.xPrev) / dt;
        const alphaD = this.alpha(this.dCutoff, dt);
        const dxHat = alphaD * dx + (1 - alphaD) * this.dxPrev;
        this.dxPrev = dxHat;

        const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
        const alpha = this.alpha(cutoff, dt);
        const xHat = alpha * x + (1 - alpha) * this.xPrev;
        this.xPrev = xHat;

        return xHat;
    }

    reset() {
        this.xPrev = null;
        this.tPrev = null;
        this.dxPrev = 0;
    }
}

class AirMouseController {
    constructor() {
        this.active = false;
        this.mode = 'laser'; // 'laser' (mutlak lazer) veya 'relative' (goreli yumusak)

        // 2 Köşe Kalibrasyon Değerleri
        this.calib = {
            yawLeft: null,
            pitchTop: null,
            yawRight: null,
            pitchBottom: null
        };
        this.isCalibrated = false;

        // Eksen Ters Çevirme (Inversion) Ayarları
        this.invertX = false;
        this.invertY = false;

        // 1 Euro Filtreleri
        this.filterX = new OneEuroFilter(60, 0.4, 0.06, 1.0);
        this.filterY = new OneEuroFilter(60, 0.4, 0.06, 1.0);

        // Sanal Masaüstü Bounding Box
        this.screenBounds = { minX: 0, maxX: 1920, minY: 0, maxY: 1080, width: 1920, height: 1080 };

        // Canlı Açı Değerleri
        this.currentRay = { yaw: 0, pitch: 0 };
        this.lastRaw = { alpha: 0, beta: 0, gamma: 0 };

        this.loadSavedSettings();
        this.init();
    }

    init() {
        // Kalibrasyon Butonları
        const btnSetTopLeft = document.getElementById('calib-set-topleft');
        const btnSetBottomRight = document.getElementById('calib-set-bottomright');
        const btnResetCalib = document.getElementById('calib-reset-btn');
        const checkInvertY = document.getElementById('chk-invert-y');
        const checkInvertX = document.getElementById('chk-invert-x');
        const modeToggle = document.getElementById('laser-mode-select');

        if (btnSetTopLeft) {
            btnSetTopLeft.addEventListener('click', () => this.recordCorner('topleft'));
        }
        if (btnSetBottomRight) {
            btnSetBottomRight.addEventListener('click', () => this.recordCorner('bottomright'));
        }
        if (btnResetCalib) {
            btnResetCalib.addEventListener('click', () => this.resetCalibration());
        }

        if (checkInvertY) {
            checkInvertY.checked = this.invertY;
            checkInvertY.addEventListener('change', (e) => {
                this.invertY = e.target.checked;
                this.saveSettings();
            });
        }
        if (checkInvertX) {
            checkInvertX.checked = this.invertX;
            checkInvertX.addEventListener('change', (e) => {
                this.invertX = e.target.checked;
                this.saveSettings();
            });
        }

        if (modeToggle) {
            modeToggle.addEventListener('change', (e) => {
                this.mode = e.target.value;
                this.filterX.reset();
                this.filterY.reset();
            });
        }

        window.addEventListener('deviceorientation', (e) => this.handleOrientation(e), true);
        window.addEventListener('deviceorientationabsolute', (e) => this.handleOrientation(e), true);
    }

    // Telefonun 3 Boyutlu İleri Doğrultu Vektörünü Hesapla (Ray Vector)
    calculatePointerRay(alpha, beta, gamma) {
        const deg2rad = Math.PI / 180;
        const a = (alpha || 0) * deg2rad;
        const b = (beta || 0) * deg2rad;
        const g = (gamma || 0) * deg2rad;

        // Telefonun tepe vektörü (0, 1, 0)
        const vx = -Math.sin(a) * Math.cos(b) - Math.sin(g) * Math.cos(a) * Math.sin(b);
        const vy =  Math.cos(a) * Math.cos(b) - Math.sin(g) * Math.sin(a) * Math.sin(b);
        const vz =  Math.cos(g) * Math.sin(b);

        // Yatay Yaw (Sol/Sağ) ve Dikey Pitch (Yukarı/Aşağı)
        const yaw = Math.atan2(vx, vy) * (180 / Math.PI);
        const pitch = Math.asin(Math.max(-1, Math.min(1, vz))) * (180 / Math.PI);

        return { yaw, pitch };
    }

    // Ekran Sınırlarını Güncelle
    updateScreenBounds(monitors) {
        if (!monitors || monitors.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        monitors.forEach(m => {
            if (m.x < minX) minX = m.x;
            if (m.y < minY) minY = m.y;
            if (m.x + m.width > maxX) maxX = m.x + m.width;
            if (m.y + m.height > maxY) maxY = m.y + m.height;
        });

        this.screenBounds = {
            minX, minY, maxX, maxY,
            width: maxX - minX || 1920,
            height: maxY - minY || 1080
        };
    }

    // 2 Köşe Kaydetme (Sol-Üst & Sağ-Alt)
    recordCorner(corner) {
        const ray = this.currentRay;
        if (ray.yaw === 0 && ray.pitch === 0) {
            alert('Sensör verisi bekleniyor. Lütfen telefonu hareket ettirin.');
            return;
        }

        if (corner === 'topleft') {
            this.calib.yawLeft = ray.yaw;
            this.calib.pitchTop = ray.pitch;
            const ind = document.getElementById('calib-topleft-ind');
            if (ind) ind.textContent = `✓ (${ray.yaw.toFixed(1)}°, ${ray.pitch.toFixed(1)}°)`;
        } else if (corner === 'bottomright') {
            this.calib.yawRight = ray.yaw;
            this.calib.pitchBottom = ray.pitch;
            const ind = document.getElementById('calib-bottomright-ind');
            if (ind) ind.textContent = `✓ (${ray.yaw.toFixed(1)}°, ${ray.pitch.toFixed(1)}°)`;
        }

        if (this.calib.yawLeft !== null && this.calib.yawRight !== null) {
            this.isCalibrated = true;
            this.saveSettings();
            const statusBox = document.getElementById('calib-status-box');
            if (statusBox) statusBox.textContent = '🎉 Kalibrasyon Tamam! Telefon artık ekranlarınızı tam olarak hedefliyor.';
            window.haptics.success();
        } else {
            window.haptics.click();
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('laser_calib_data', JSON.stringify(this.calib));
            localStorage.setItem('laser_invert_x', JSON.stringify(this.invertX));
            localStorage.setItem('laser_invert_y', JSON.stringify(this.invertY));
        } catch (e) {}
    }

    loadSavedSettings() {
        try {
            const c = localStorage.getItem('laser_calib_data');
            const ix = localStorage.getItem('laser_invert_x');
            const iy = localStorage.getItem('laser_invert_y');
            if (c) {
                this.calib = JSON.parse(c);
                if (this.calib.yawLeft !== null && this.calib.yawRight !== null) {
                    this.isCalibrated = true;
                }
            }
            if (ix) this.invertX = JSON.parse(ix);
            if (iy) this.invertY = JSON.parse(iy);
        } catch (e) {}
    }

    resetCalibration() {
        this.calib = { yawLeft: null, pitchTop: null, yawRight: null, pitchBottom: null };
        this.isCalibrated = false;
        try {
            localStorage.removeItem('laser_calib_data');
        } catch (e) {}

        const ind1 = document.getElementById('calib-topleft-ind');
        const ind2 = document.getElementById('calib-bottomright-ind');
        const statusBox = document.getElementById('calib-status-box');

        if (ind1) ind1.textContent = 'Kaydedilmedi';
        if (ind2) ind2.textContent = 'Kaydedilmedi';
        if (statusBox) statusBox.textContent = 'Kalibre edilmedi. Lütfen 1 ve 2. adımları tamamlayın.';
        window.haptics.click();
    }

    handleOrientation(e) {
        if (!this.active) return;
        if (e.beta === null || e.gamma === null) return;

        this.lastRaw = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };

        // 3D İleri Yön Işın Açısını Hesapla
        const ray = this.calculatePointerRay(e.alpha, e.beta, e.gamma);
        this.currentRay = ray;

        const curYaw = ray.yaw;
        const curPitch = ray.pitch;

        // === 1. MUTLAK LAZER MODU ===
        if (this.mode === 'laser' && this.isCalibrated && this.calib.yawLeft !== null && this.calib.yawRight !== null) {
            const yawSpan = this.calib.yawRight - this.calib.yawLeft;
            const pitchSpan = this.calib.pitchTop - this.calib.pitchBottom;

            if (Math.abs(yawSpan) > 1 && Math.abs(pitchSpan) > 1) {
                // X Oranı (0.0: Sol Ekran Sınırı, 1.0: Sağ Ekran Sınırı)
                let tX = (curYaw - this.calib.yawLeft) / yawSpan;

                // Y Oranı: Yukarı baktığında (pitch = pitchTop) -> tY = 0.0 (Ekranın Üstü)
                //          Aşağı baktığında (pitch = pitchBottom) -> tY = 1.0 (Ekranın Altı)
                let tY = (this.calib.pitchTop - curPitch) / pitchSpan;

                // Eksen Ters Çevirme Kontrolleri
                if (this.invertX) tX = 1.0 - tX;
                if (this.invertY) tY = 1.0 - tY;

                // Ekran Taşma Toleransı
                tX = Math.max(-0.02, Math.min(1.02, tX));
                tY = Math.max(-0.02, Math.min(1.02, tY));

                const rawTargetX = this.screenBounds.minX + tX * this.screenBounds.width;
                const rawTargetY = this.screenBounds.minY + tY * this.screenBounds.height;

                // 1 Euro Titreme Önleme Filtresi
                const nowSec = performance.now() / 1000;
                const filteredX = this.filterX.filter(rawTargetX, nowSec);
                const filteredY = this.filterY.filter(rawTargetY, nowSec);

                if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
                    window.app.send({
                        type: 'move_abs',
                        x: filteredX,
                        y: filteredY,
                        yaw: curYaw,
                        pitch: curPitch,
                        t: Date.now()
                    });
                }

                this.renderHud(curYaw, curPitch, filteredX, filteredY);
                return;
            }
        }

        // === 2. GÖRELİ MOD ===
        if (this.lastYawRel === undefined) {
            this.lastYawRel = curYaw;
            this.lastPitchRel = curPitch;
            return;
        }

        let dYaw = curYaw - this.lastYawRel;
        let dPitch = curPitch - this.lastPitchRel;
        this.lastYawRel = curYaw;
        this.lastPitchRel = curPitch;

        if (this.invertX) dYaw = -dYaw;
        if (this.invertY) dPitch = -dPitch;

        if (Math.abs(dYaw) > 60) dYaw = 0;
        if (Math.abs(dPitch) > 60) dPitch = 0;

        if (Math.hypot(dYaw, dPitch) < 0.03) return;

        const nowSec = performance.now() / 1000;
        const smoothDx = this.filterX.filter(dYaw * 32.0, nowSec);
        // Pitch yukarı çıktığında fareyi yukarı götür (Windows koordinatında Y eksiye gider)
        const smoothDy = this.filterY.filter(-dPitch * 32.0, nowSec);

        if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
            window.app.send({
                type: 'move',
                dx: smoothDx,
                dy: smoothDy,
                t: Date.now()
            });
        }

        this.renderHud(curYaw, curPitch);
    }

    renderHud(yaw, pitch, targetX = null, targetY = null) {
        const hudAngles = document.getElementById('hud-angles');
        const hudTarget = document.getElementById('hud-target');

        if (hudAngles) {
            hudAngles.textContent = `Açı (Yaw / Pitch): ${yaw.toFixed(1)}° / ${pitch.toFixed(1)}°`;
        }
        if (hudTarget) {
            if (targetX !== null && targetY !== null) {
                hudTarget.textContent = `Hedef Koordinat: (${Math.round(targetX)}, ${Math.round(targetY)})`;
            } else {
                hudTarget.textContent = `Mod: Göreli Yumuşak`;
            }
        }
    }

    setActive(isActive) {
        this.active = isActive;
        if (isActive) {
            this.filterX.reset();
            this.filterY.reset();
            this.lastYawRel = undefined;
            if (window.app && window.app.monitors) {
                this.updateScreenBounds(window.app.monitors);
            }
        }
    }
}

window.airMouse = new AirMouseController();
