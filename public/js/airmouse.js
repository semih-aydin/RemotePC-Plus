// Universal Wireless Control Hub - Endüstri Standardı Jiroskop Entegrasyon Motoru (Inertial Gyroscope Engine)
// Gürültülü manyetik pusulayı (alpha) tamamen devre dışı bırakır.
// Saf donanımsal jiroskop açısal hızını (rotationRate) entegre ederek SIFIR TİTREME sağlar.

class GyroscopeAirMouse {
    constructor() {
        this.active = false;

        // Ayarlar
        this.speedX = 3.2;         // Yatay hassasiyet
        this.speedY = 3.2;         // Dikey hassasiyet
        this.deadZone = 0.20;       // Durgunluk gürültü kapısı (deg/s): El sabitken titremeyi 0 yapar
        this.accelFactor = 1.35;   // Hızlı kol hareketinde geniş ekranları rahat aşma ivmesi

        this.invertX = false;
        this.invertY = false;

        this.lastTimestamp = null;
        this.gyroCount = 0;

        this.loadSettings();
        this.initUi();
        this.bindEvents();
    }

    initUi() {
        const sliderX = document.getElementById('gyro-sens-slider');
        const valX = document.getElementById('gyro-sens-val');
        const checkInvY = document.getElementById('chk-invert-y');
        const checkInvX = document.getElementById('chk-invert-x');
        const btnCenter = document.getElementById('btn-recenter-gyro');

        if (sliderX) {
            sliderX.value = this.speedX;
            sliderX.addEventListener('input', (e) => {
                this.speedX = parseFloat(e.target.value);
                this.speedY = parseFloat(e.target.value);
                if (valX) valX.textContent = `${this.speedX.toFixed(1)}x`;
                this.saveSettings();
            });
        }

        if (checkInvY) {
            checkInvY.checked = this.invertY;
            checkInvY.addEventListener('change', (e) => {
                this.invertY = e.target.checked;
                this.saveSettings();
            });
        }

        if (checkInvX) {
            checkInvX.checked = this.invertX;
            checkInvX.addEventListener('change', (e) => {
                this.invertX = e.target.checked;
                this.saveSettings();
            });
        }

        if (btnCenter) {
            btnCenter.addEventListener('click', () => {
                this.recenter();
            });
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('gyro_speed', JSON.stringify(this.speedX));
            localStorage.setItem('gyro_inv_x', JSON.stringify(this.invertX));
            localStorage.setItem('gyro_inv_y', JSON.stringify(this.invertY));
        } catch (e) {}
    }

    loadSettings() {
        try {
            const s = localStorage.getItem('gyro_speed');
            const ix = localStorage.getItem('gyro_inv_x');
            const iy = localStorage.getItem('gyro_inv_y');
            if (s) {
                this.speedX = JSON.parse(s);
                this.speedY = this.speedX;
            }
            if (ix) this.invertX = JSON.parse(ix);
            if (iy) this.invertY = JSON.parse(iy);
        } catch (e) {}
    }

    recenter() {
        window.haptics.click();
        // Farenin merkez monitöre ışınlanması için
        if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
            window.app.send({
                type: 'click',
                button: 'middle',
                state: 'click'
            });
        }
    }

    bindEvents() {
        // DeviceMotion içindeki pure gyroscope rotationRate olayını dinle
        window.addEventListener('devicemotion', (e) => this.handleDeviceMotion(e), true);
        
        // Generic Sensor API Gyroscope fallback
        try {
            if ('Gyroscope' in window) {
                const gyro = new Gyroscope({ frequency: 60 });
                gyro.addEventListener('reading', () => {
                    if (!this.active) return;
                    // rad/s to deg/s
                    const degX = gyro.x * (180 / Math.PI);
                    const degY = gyro.y * (180 / Math.PI);
                    const degZ = gyro.z * (180 / Math.PI);
                    this.processGyroRates(degZ, degX, performance.now());
                });
                gyro.start();
            }
        } catch (err) {}
    }

    handleDeviceMotion(e) {
        if (!this.active) return;

        const rot = e.rotationRate;
        if (!rot) return;

        const now = performance.now();
        if (this.lastTimestamp === null) {
            this.lastTimestamp = now;
            return;
        }

        const dt = Math.max(0.002, Math.min(0.1, (now - this.lastTimestamp) / 1000));
        this.lastTimestamp = now;

        // rot.alpha: Z ekseni (Yaw - Sağa/Sola Dönüş)
        // rot.beta:  X ekseni (Pitch - Yukarı/Aşağı Eğilme)
        // rot.gamma: Y ekseni (Roll)
        let rateYaw = rot.alpha || 0;
        let ratePitch = rot.beta || 0;

        // Bazı Android cihazlarda Z ekseni yerine gamma veya beta atanır
        if (Math.abs(rateYaw) < 0.05 && Math.abs(rot.gamma) > 0.1) {
            rateYaw = rot.gamma;
        }

        this.processGyroRates(rateYaw, ratePitch, now, dt);
    }

    processGyroRates(rateYaw, ratePitch, now, dt = 0.016) {
        this.gyroCount++;

        // 1. Durgunluk / Gürültü Kapısı (Deadband Filter): El sabitken SIFIR titreme
        const angularSpeed = Math.hypot(rateYaw, ratePitch);
        if (angularSpeed < this.deadZone) {
            this.updateHud(0, 0, angularSpeed, 'DURGUN (Sabit)');
            return;
        }

        // 2. Yönlendirme (Yukarı bakınca fare YUKARI gitmeli)
        // Telefon yukarı kalkarken ratePitch pozitiftir. Windows'ta ekranın yukarısı eksi (-) Y'dir.
        let rawDx = rateYaw;
        let rawDy = -ratePitch;

        if (this.invertX) rawDx = -rawDx;
        if (this.invertY) rawDy = -rawDy;

        // 3. İvmelenme Eğrisi (Geniş çift monitör geçişi için)
        let multiplierX = this.speedX * 22.0;
        let multiplierY = this.speedY * 22.0;

        if (angularSpeed > 5.0) {
            const boost = Math.pow(angularSpeed / 5.0, this.accelFactor - 1.0);
            multiplierX *= Math.min(3.0, boost);
            multiplierY *= Math.min(3.0, boost);
        }

        const finalDx = rawDx * multiplierX * dt * 60.0;
        const finalDy = rawDy * multiplierY * dt * 60.0;

        if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
            window.app.send({
                type: 'move',
                dx: finalDx,
                dy: finalDy,
                t: Date.now()
            });
        }

        this.updateHud(finalDx, finalDy, angularSpeed, 'HAREKETLİ');
    }

    updateHud(dx, dy, speed, state) {
        const hudStatus = document.getElementById('gyro-state-text');
        const hudMotion = document.getElementById('gyro-motion-text');

        if (hudStatus) {
            hudStatus.textContent = `Durum: ${state} (Hız: ${speed.toFixed(1)}°/s)`;
            hudStatus.style.color = state.includes('DURGUN') ? '#10b981' : '#38bdf8';
        }
        if (hudMotion) {
            hudMotion.textContent = `Haraket: dX=${dx.toFixed(1)}px | dY=${dy.toFixed(1)}px | Paket: ${this.gyroCount}`;
        }
    }

    setActive(isActive) {
        this.active = isActive;
        this.lastTimestamp = null;
    }
}

window.airMouse = new GyroscopeAirMouse();
