// Universal Wireless Control Hub - Saf Euler Diferansiyel Motoru (Pure Euler Differential)
//
// Neden bu yaklaşım:
//   - rotationRate: Android/Chrome'da birim belirsiz, çoğu cihazda kırık
//   - deviceorientation alpha: Manyetometre kullanır, PC monitörleri bozuyor (log'da -170//-8 sıçraması)
//   - deviceorientation beta+gamma: Saf ivmeölçer+jiroskop füzyonu, HER cihazda stabil
//
// Çözüm: beta ve gamma'nın önceki frame'e göre FARKINI (delta) al.
//         Böylece mutlak yön gürültüsü değil, GEÇİCİ HAREKET miktarı ölçülür.
//         Sonucu Low-Pass Filtre + Deadband ile temizle.

class AirMouse {
    constructor() {
        this.active = false;
        this.clutchEngaged = false;

        // Ayarlar
        this.speed = 2.8;
        this.deadband = 0.08;          // Hareketsiz eşik (derece) - çok düşük tutulmalı
        this.lpfAlpha = 0.38;          // Low-Pass Filtre katsayısı (0=çok yavaş, 1=ham)
        this.maxDeltaPerFrame = 12.0;  // Tek frame'de maksimum geçerli açı değişimi (derece) - glitch kapısı

        this.invertX = false;
        this.invertY = false;

        // LPF State
        this.filteredDx = 0;
        this.filteredDy = 0;

        // Önceki frame açıları
        this.prevBeta = null;
        this.prevGamma = null;
        this.lastEventTime = 0;

        this.packetCount = 0;
        this.sampleCount = 0;

        this.loadSettings();
        this.initUi();
        this.bindSensor();
    }

    // -------------------- UI --------------------

    initUi() {
        const slider = document.getElementById('gyro-sens-slider');
        const valEl = document.getElementById('gyro-sens-val');
        const invY = document.getElementById('chk-invert-y');
        const invX = document.getElementById('chk-invert-x');
        const clutchChk = document.getElementById('chk-clutch-mode');
        const touchZone = document.getElementById('airmouse-touch-surface');
        const calibBtn = document.getElementById('btn-calibrate-bias');

        if (slider) {
            slider.value = this.speed;
            slider.addEventListener('input', (e) => {
                this.speed = parseFloat(e.target.value);
                if (valEl) valEl.textContent = `${this.speed.toFixed(1)}x`;
                this.saveSettings();
            });
        }

        if (invY) {
            invY.checked = this.invertY;
            invY.addEventListener('change', (e) => { this.invertY = e.target.checked; this.saveSettings(); });
        }
        if (invX) {
            invX.checked = this.invertX;
            invX.addEventListener('change', (e) => { this.invertX = e.target.checked; this.saveSettings(); });
        }

        // Clutch mod toggle
        let useClutch = true;
        if (clutchChk) {
            clutchChk.checked = useClutch;
            clutchChk.addEventListener('change', (e) => { useClutch = e.target.checked; });
        }

        // Debriyaj yüzey dokunuşu
        if (touchZone) {
            touchZone.addEventListener('touchstart', () => {
                this.clutchEngaged = true;
                this.prevBeta = null;
                this.prevGamma = null;
                this.filteredDx = 0;
                this.filteredDy = 0;
                touchZone.style.borderColor = '#2563eb';
                const s = document.getElementById('gyro-state-text');
                if (s) { s.textContent = 'Durum: AKTİF'; s.style.color = '#10b981'; }
                window.haptics.click();
            }, { passive: true });

            const release = () => {
                this.clutchEngaged = false;
                this.prevBeta = null;
                this.prevGamma = null;
                touchZone.style.borderColor = '#333';
                const s = document.getElementById('gyro-state-text');
                if (s) { s.textContent = 'Durum: KİLİTLİ'; s.style.color = '#888'; }
            };
            touchZone.addEventListener('touchend', release, { passive: true });
            touchZone.addEventListener('touchcancel', release, { passive: true });
        }

        if (calibBtn) {
            calibBtn.addEventListener('click', () => {
                this.prevBeta = null;
                this.prevGamma = null;
                this.filteredDx = 0;
                this.filteredDy = 0;
                window.haptics.click();
                const s = document.getElementById('gyro-state-text');
                if (s) { s.textContent = 'Durum: Referans Sıfırlandı'; s.style.color = '#fbbf24'; }
            });
        }
    }

    // -------------------- Sensör --------------------

    bindSensor() {
        // HTTPS'te iOS izin gerektirir
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            const btn = document.getElementById('btn-calibrate-bias');
            if (btn) {
                const origClick = btn.onclick;
                btn.addEventListener('click', async () => {
                    try {
                        await DeviceOrientationEvent.requestPermission();
                    } catch (e) {}
                });
            }
        }

        window.addEventListener('deviceorientation', (e) => this.onOrientation(e), true);
    }

    // -------------------- Ana Hesaplama --------------------

    onOrientation(e) {
        if (!this.active) return;
        if (!this.clutchEngaged) return;

        const now = performance.now();
        const beta = e.beta;
        const gamma = e.gamma;

        if (beta === null || gamma === null) return;

        this.sampleCount++;

        // İlk frame: sadece referans kaydet
        if (this.prevBeta === null) {
            this.prevBeta = beta;
            this.prevGamma = gamma;
            this.lastEventTime = now;
            return;
        }

        // Ham delta hesapla
        let dBeta  = beta  - this.prevBeta;
        let dGamma = gamma - this.prevGamma;

        this.prevBeta  = beta;
        this.prevGamma = gamma;
        this.lastEventTime = now;

        // Glitch Kapısı: Tek frame'de bu kadar açı değişemez (gyro sıçraması / gimbal wrap)
        if (Math.abs(dBeta)  > this.maxDeltaPerFrame) dBeta  = 0;
        if (Math.abs(dGamma) > this.maxDeltaPerFrame) dGamma = 0;

        // Gamma: Yatay hareket (sağa eğ = pozitif)
        // Beta:  Dikey hareket (öne eğ = pozitif)
        // Windows Y ekseni: Aşağı = pozitif, dolayısıyla beta'yı direkt kullan
        let rawDx =  dGamma;
        let rawDy =  dBeta;

        if (this.invertX) rawDx = -rawDx;
        if (this.invertY) rawDy = -rawDy;

        // Deadband (hareketsizlik kapısı)
        if (Math.abs(rawDx) < this.deadband) rawDx = 0;
        if (Math.abs(rawDy) < this.deadband) rawDy = 0;

        if (rawDx === 0 && rawDy === 0) {
            // Hareketsizken filtre sönümlenmesi
            this.filteredDx *= 0.60;
            this.filteredDy *= 0.60;
            if (Math.abs(this.filteredDx) < 0.1) this.filteredDx = 0;
            if (Math.abs(this.filteredDy) < 0.1) this.filteredDy = 0;
            return;
        }

        // Low-Pass Filtre (titremeyi yumuşatır)
        this.filteredDx = this.lpfAlpha * rawDx + (1 - this.lpfAlpha) * this.filteredDx;
        this.filteredDy = this.lpfAlpha * rawDy + (1 - this.lpfAlpha) * this.filteredDy;

        // İvmelenme eğrisi
        const speed = Math.hypot(this.filteredDx, this.filteredDy);
        let multiplier = this.speed * 38.0;
        if (speed > 1.5) {
            multiplier *= Math.min(2.2, 1.0 + (speed - 1.5) * 0.3);
        }

        const finalDx = this.filteredDx * multiplier;
        const finalDy = this.filteredDy * multiplier;

        this.packetCount++;

        if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
            window.app.send({
                type: 'move',
                dx: finalDx,
                dy: finalDy,
                t: Date.now()
            });
        }

        // HUD güncelle
        const motionEl = document.getElementById('gyro-motion-text');
        if (motionEl) {
            motionEl.textContent = `dX=${finalDx.toFixed(0)}px dY=${finalDy.toFixed(0)}px | Paket:${this.packetCount} | β=${beta.toFixed(1)}° γ=${gamma.toFixed(1)}°`;
        }
    }

    // -------------------- Yardımcı --------------------

    saveSettings() {
        try {
            localStorage.setItem('am_speed', this.speed);
            localStorage.setItem('am_inv_x', this.invertX);
            localStorage.setItem('am_inv_y', this.invertY);
        } catch (e) {}
    }

    loadSettings() {
        try {
            const s = localStorage.getItem('am_speed');
            const ix = localStorage.getItem('am_inv_x');
            const iy = localStorage.getItem('am_inv_y');
            if (s) this.speed = parseFloat(s);
            if (ix) this.invertX = ix === 'true';
            if (iy) this.invertY = iy === 'true';
        } catch (e) {}
    }

    setActive(isActive) {
        this.active = isActive;
        this.clutchEngaged = false;
        this.prevBeta = null;
        this.prevGamma = null;
        this.filteredDx = 0;
        this.filteredDy = 0;
    }
}

window.airMouse = new AirMouse();
