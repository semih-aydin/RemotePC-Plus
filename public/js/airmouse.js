// Universal Wireless Control Hub - Otomatik Bias Dengeleyicili & Debriyajlı (Clutch) Jiroskop Motoru
// Donanımsal sensör kaymasını (drift/bias) otomatik sıfırlar, masa üzerinde sıfır hareket garantisi verir.

class GyroscopeAirMouse {
    constructor() {
        this.active = false;
        this.clutchMode = true; // true: Ekrana dokunurken hareket et (Hold to Move), false: Surekli acik
        this.isClutchEngaged = false;

        // Ayarlar
        this.speed = 2.4;
        this.noiseThreshold = 0.65; // Gürültü eşiği (deg/s)

        // Otomatik Bias / Durgunluk Kalibrasyonu (Sıfır Noktası Düzeltici)
        this.biasYaw = 0.0;
        this.biasPitch = 0.0;
        this.biasSamples = [];
        this.isCalibratedBias = false;

        this.invertX = false;
        this.invertY = false;

        this.lastTimestamp = null;
        this.packetCount = 0;

        this.loadSettings();
        this.initUi();
        this.bindEvents();
    }

    initUi() {
        const sliderSens = document.getElementById('gyro-sens-slider');
        const valSens = document.getElementById('gyro-sens-val');
        const checkInvY = document.getElementById('chk-invert-y');
        const checkInvX = document.getElementById('chk-invert-x');
        const clutchToggle = document.getElementById('chk-clutch-mode');
        const touchZone = document.getElementById('airmouse-touch-surface');
        const btnCalibBias = document.getElementById('btn-calibrate-bias');

        if (sliderSens) {
            sliderSens.value = this.speed;
            sliderSens.addEventListener('input', (e) => {
                this.speed = parseFloat(e.target.value);
                if (valSens) valSens.textContent = `${this.speed.toFixed(1)}x`;
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

        if (clutchToggle) {
            clutchToggle.checked = this.clutchMode;
            clutchToggle.addEventListener('change', (e) => {
                this.clutchMode = e.target.checked;
                this.saveSettings();
                this.updateClutchUi();
            });
        }

        if (btnCalibBias) {
            btnCalibBias.addEventListener('click', () => {
                this.recalibrateBias();
            });
        }

        // Debriyaj (Hold-to-Move) Dokunmatik Alanı
        if (touchZone) {
            touchZone.addEventListener('touchstart', (e) => {
                this.isClutchEngaged = true;
                this.updateClutchUi();
                window.haptics.click();
            }, { passive: true });

            touchZone.addEventListener('touchend', (e) => {
                this.isClutchEngaged = false;
                this.updateClutchUi();
            }, { passive: true });

            touchZone.addEventListener('touchcancel', (e) => {
                this.isClutchEngaged = false;
                this.updateClutchUi();
            }, { passive: true });
        }
    }

    updateClutchUi() {
        const hudState = document.getElementById('gyro-state-text');
        const touchZone = document.getElementById('airmouse-touch-surface');

        if (this.clutchMode) {
            if (this.isClutchEngaged) {
                if (hudState) hudState.textContent = 'Durum: AKTİF (TUTULUYOR)';
                if (hudState) hudState.style.color = '#10b981';
                if (touchZone) touchZone.style.borderColor = '#2563eb';
            } else {
                if (hudState) hudState.textContent = 'Durum: KİLİTLİ (Hareket için parmağınızı basılı tutun)';
                if (hudState) hudState.style.color = '#888';
                if (touchZone) touchZone.style.borderColor = '#333';
            }
        } else {
            if (hudState) hudState.textContent = 'Durum: SÜREKLİ AÇIK';
            if (hudState) hudState.style.color = '#38bdf8';
            if (touchZone) touchZone.style.borderColor = '#38bdf8';
        }
    }

    recalibrateBias() {
        this.biasSamples = [];
        this.isCalibratedBias = false;
        const hudState = document.getElementById('gyro-state-text');
        if (hudState) hudState.textContent = 'Kalibrasyon: 1 sn telefonu sabit tutun...';
        window.haptics.click();
    }

    saveSettings() {
        try {
            localStorage.setItem('gyro_speed_val', JSON.stringify(this.speed));
            localStorage.setItem('gyro_inv_x', JSON.stringify(this.invertX));
            localStorage.setItem('gyro_inv_y', JSON.stringify(this.invertY));
            localStorage.setItem('gyro_clutch', JSON.stringify(this.clutchMode));
        } catch (e) {}
    }

    loadSettings() {
        try {
            const s = localStorage.getItem('gyro_speed_val');
            const ix = localStorage.getItem('gyro_inv_x');
            const iy = localStorage.getItem('gyro_inv_y');
            const c = localStorage.getItem('gyro_clutch');
            if (s) this.speed = JSON.parse(s);
            if (ix) this.invertX = JSON.parse(ix);
            if (iy) this.invertY = JSON.parse(iy);
            if (c) this.clutchMode = JSON.parse(c);
        } catch (e) {}
    }

    bindEvents() {
        window.addEventListener('devicemotion', (e) => this.handleDeviceMotion(e), true);
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

        const dt = Math.max(0.005, Math.min(0.05, (now - this.lastTimestamp) / 1000));
        this.lastTimestamp = now;

        let rawYaw = rot.alpha || 0;
        let rawPitch = rot.beta || 0;

        if (Math.abs(rawYaw) < 0.05 && Math.abs(rot.gamma) > 0.1) {
            rawYaw = rot.gamma;
        }

        // 1. Otomatik Sıfır Noktası (Bias/Drift) Öğrenme
        if (!this.isCalibratedBias) {
            this.biasSamples.push({ yaw: rawYaw, pitch: rawPitch });
            if (this.biasSamples.length >= 30) {
                let sumY = 0, sumP = 0;
                this.biasSamples.forEach(s => { sumY += s.yaw; sumP += s.pitch; });
                this.biasYaw = sumY / this.biasSamples.length;
                this.biasPitch = sumP / this.biasSamples.length;
                this.isCalibratedBias = true;
                this.updateClutchUi();
            }
            return;
        }

        // Bias Düzeltmesi (Sensör kaymasını çıkar)
        const cleanYaw = rawYaw - this.biasYaw;
        const cleanPitch = rawPitch - this.biasPitch;
        const speed = Math.hypot(cleanYaw, cleanPitch);

        // 2. Debriyaj Kontrolü (Hold-to-Move aktifse ve basılmıyorsa hiçbir şey yollama)
        if (this.clutchMode && !this.isClutchEngaged) {
            return;
        }

        // 3. Gürültü Eşiği (Telefon masada veya elde hareketsizken 0 paket yolla)
        if (speed < this.noiseThreshold) {
            // Yavaş harekette bias'ı yavaşça güncelle (Adaptive Drift Cancellation)
            if (speed < 0.3) {
                this.biasYaw = 0.98 * this.biasYaw + 0.02 * rawYaw;
                this.biasPitch = 0.98 * this.biasPitch + 0.02 * rawPitch;
            }
            return;
        }

        // 4. Koordinat Hesaplama
        let dx = cleanYaw;
        let dy = -cleanPitch; // Yukarı kaldırma = Fare Yukarı

        if (this.invertX) dx = -dx;
        if (this.invertY) dy = -dy;

        // Yumuşak İvmelenme Eğrisi (Power Curve)
        let multiplier = this.speed * 14.0;
        if (speed > 4.0) {
            multiplier *= Math.min(2.5, Math.pow(speed / 4.0, 0.4));
        }

        let finalDx = dx * multiplier * dt * 60.0;
        let finalDy = dy * multiplier * dt * 60.0;

        // Ani anomalik sıçramaları (Glitch filter) engelle
        if (Math.abs(finalDx) > 80) finalDx = Math.sign(finalDx) * 80;
        if (Math.abs(finalDy) > 80) finalDy = Math.sign(finalDy) * 80;

        this.packetCount++;

        if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
            window.app.send({
                type: 'move',
                dx: finalDx,
                dy: finalDy,
                t: Date.now()
            });
        }

        const hudMotion = document.getElementById('gyro-motion-text');
        if (hudMotion) {
            hudMotion.textContent = `Haraket: dX=${finalDx.toFixed(1)}px | dY=${finalDy.toFixed(1)}px | Paket: ${this.packetCount}`;
        }
    }

    setActive(isActive) {
        this.active = isActive;
        this.lastTimestamp = null;
        this.isClutchEngaged = false;
        if (isActive) {
            this.recalibrateBias();
        }
    }
}

window.airMouse = new GyroscopeAirMouse();
