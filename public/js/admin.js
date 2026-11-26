// Masaustu Yonetim Paneli (Desktop Admin Control Center)
// Monitor yerlesimi gorsellestirici, QR Kod, canli ping takibi ve kural duzenleyici

class AdminDashboard {
    constructor() {
        this.info = null;
        this.selectedMonId = 1;
        this.canvas = document.getElementById('monitor-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        this.init();
    }

    async init() {
        this.initThemeToggle();
        await this.loadInfo();
        this.loadSelectedMonitorProfile();
        await this.loadQrCode();
        this.initEvents();
        this.initTestCanvas();

        // Her 2 saniyede bir durumu guncelle
        setInterval(() => this.loadInfo(), 2000);
    }

    initThemeToggle() {
        const btn = document.getElementById('admin-theme-toggle');
        const apply = (theme) => {
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                if (btn) btn.innerHTML = '<i class="fas fa-sun"></i>';
            } else {
                document.documentElement.removeAttribute('data-theme');
                if (btn) btn.innerHTML = '<i class="fas fa-moon"></i>';
            }
            try { localStorage.setItem('rpc_theme', theme); } catch (e) {}
            this.drawMonitorCanvas();
        };
        apply(localStorage.getItem('rpc_theme') || 'light');
        if (btn) {
            btn.addEventListener('click', () => {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                apply(isDark ? 'light' : 'dark');
            });
        }
    }

    async loadInfo() {
        try {
            const res = await fetch('/api/info');
            const data = await res.json();
            this.info = data;
            this.updateUi();
        } catch (e) {
            console.log('Bilgiler alinamadi:', e);
        }
    }

    async loadQrCode() {
        const qrImg = document.getElementById('qr-image');
        const httpsLink = document.getElementById('https-link');
        const httpLink = document.getElementById('http-link');

        try {
            const resHttps = await fetch('/api/qr?https=true');
            const dataHttps = await resHttps.json();
            if (qrImg) qrImg.src = dataHttps.qr;
            if (httpsLink) {
                httpsLink.href = dataHttps.url;
                httpsLink.textContent = dataHttps.url;
            }

            const resHttp = await fetch('/api/qr?https=false');
            const dataHttp = await resHttp.json();
            if (httpLink) {
                httpLink.href = dataHttp.url;
                httpLink.textContent = dataHttp.url;
            }
        } catch (e) {
            console.log('QR kod alinamadi:', e);
        }
    }

    initEvents() {
        // Ayarlari kaydet butonu
        const saveBtn = document.getElementById('save-settings-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        // Miknatis / Kenar direnci anahtari
        const magToggle = document.getElementById('magnetism-enabled');
        if (magToggle) {
            magToggle.addEventListener('change', (e) => {
                const resGroup = document.getElementById('magnetism-options');
                if (resGroup) resGroup.style.display = e.target.checked ? 'block' : 'none';
            });
        }

        // Guvenlik PIN anahtari
        const pinToggle = document.getElementById('security-pin-enabled');
        if (pinToggle) {
            pinToggle.addEventListener('change', (e) => {
                const pinGroup = document.getElementById('security-pin-options');
                if (pinGroup) pinGroup.style.display = e.target.checked ? 'block' : 'none';
            });
        }

        // Monitor secimi degistiginde
        const monSelect = document.getElementById('monitor-select');
        if (monSelect) {
            monSelect.addEventListener('change', (e) => {
                this.selectedMonId = parseInt(e.target.value);
                this.loadSelectedMonitorProfile();
            });
        }
    }

    updateUi() {
        if (!this.info) return;

        // Bagli istemci sayisi
        const clientCountEl = document.getElementById('connected-clients-count');
        if (clientCountEl) clientCountEl.textContent = this.info.clientsCount;

        // Aktif uygulama ve context
        const activeAppEl = document.getElementById('active-app-name');
        const activeContextEl = document.getElementById('active-context-badge');
        if (activeAppEl) activeAppEl.textContent = this.info.context.processName ? `${this.info.context.processName} (${this.info.context.windowTitle})` : 'Masaustu';
        if (activeContextEl) {
            activeContextEl.textContent = this.info.context.context.toUpperCase();
            activeContextEl.className = `badge badge-${this.info.context.context}`;
        }

        // Monitor seciciyi doldur
        const monSelect = document.getElementById('monitor-select');
        if (monSelect && this.info.monitors) {
            const curVal = monSelect.value;
            monSelect.innerHTML = '';
            this.info.monitors.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = `${m.name} [${m.width}x${m.height}] ${m.isPrimary ? '(Ana Ekran)' : ''}`;
                monSelect.appendChild(opt);
            });
            if (curVal) monSelect.value = curVal;
        }

        // Monitor Tuvalini Ciz (Spatial Visualizer)
        this.drawMonitorCanvas();
    }

    // Monitor yerlesim haritasini ciz
    drawMonitorCanvas() {
        if (!this.ctx || !this.canvas || !this.info || !this.info.monitors) return;

        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        // Bounding box hesapla
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.info.monitors.forEach(m => {
            if (m.x < minX) minX = m.x;
            if (m.y < minY) minY = m.y;
            if (m.x + m.width > maxX) maxX = m.x + m.width;
            if (m.y + m.height > maxY) maxY = m.y + m.height;
        });

        const totalW = maxX - minX || 1920;
        const totalH = maxY - minY || 1080;

        const padding = 30;
        const scale = Math.min((w - padding * 2) / totalW, (h - padding * 2) / totalH);

        const offsetX = (w - totalW * scale) / 2;
        const offsetY = (h - totalH * scale) / 2;

        // Ekranlari ciz
        this.info.monitors.forEach(m => {
            const drawX = offsetX + (m.x - minX) * scale;
            const drawY = offsetY + (m.y - minY) * scale;
            const drawW = m.width * scale;
            const drawH = m.height * scale;

            // Ekran kutusu (Apple Light & Dark uyumlu)
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            this.ctx.fillStyle = m.isPrimary
                ? (isDark ? 'rgba(10, 132, 255, 0.18)' : 'rgba(0, 113, 227, 0.10)')
                : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)');
            this.ctx.strokeStyle = m.isPrimary
                ? (isDark ? '#0A84FF' : '#0071E3')
                : (isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.15)');
            this.ctx.lineWidth = 1.5;

            this.ctx.beginPath();
            this.ctx.roundRect(drawX, drawY, drawW, drawH, 10);
            this.ctx.fill();
            this.ctx.stroke();

            // Ekran etiketi
            this.ctx.fillStyle = isDark ? '#F5F5F7' : '#1D1D1F';
            this.ctx.font = '600 12px "Plus Jakarta Sans", -apple-system, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${m.name}`, drawX + drawW / 2, drawY + drawH / 2 - 7);
            this.ctx.fillStyle = isDark ? '#98989D' : '#6E6E73';
            this.ctx.font = '500 10px "JetBrains Mono", monospace';
            this.ctx.fillText(`${m.width}x${m.height} (${m.dpi || 1.5}x DPI)`, drawX + drawW / 2, drawY + drawH / 2 + 10);
        });
    }

    loadSelectedMonitorProfile() {
        if (!this.info || !this.info.settings) return;
        const profiles = this.info.settings.perMonitorProfiles || {};
        const prof = profiles[this.selectedMonId] || { dpi: 1.5, acceleration: 1.2 };

        const dpiInput = document.getElementById('monitor-dpi-input');
        const accelInput = document.getElementById('monitor-accel-input');

        if (dpiInput) dpiInput.value = prof.dpi || 1.5;
        if (accelInput) accelInput.value = prof.acceleration || 1.2;

        // Kenar Direnci (Boundary Magnetism) Durumu
        const mag = this.info.settings.boundaryMagnetism || { enabled: true, resistance: 15 };
        const magChk = document.getElementById('magnetism-enabled');
        const magRes = document.getElementById('magnetism-resistance');
        const magOpt = document.getElementById('magnetism-options');
        if (magChk) magChk.checked = mag.enabled !== false;
        if (magRes) magRes.value = mag.resistance || 15;
        if (magOpt) magOpt.style.display = (mag.enabled !== false) ? 'block' : 'none';

        // Guvenlik PIN Durumu
        const pinEnabled = !!(this.info.settings.security && this.info.settings.security.pinAuthEnabled);
        const pinVal = (this.info.settings.security && this.info.settings.security.pin) ? this.info.settings.security.pin : '1234';
        const pinChk = document.getElementById('security-pin-enabled');
        const pinInp = document.getElementById('security-pin-input');
        const pinGrp = document.getElementById('security-pin-options');
        if (pinChk) pinChk.checked = pinEnabled;
        if (pinInp) pinInp.value = pinVal;
        if (pinGrp) pinGrp.style.display = pinEnabled ? 'block' : 'none';
    }

    async saveSettings() {
        const monDpi = parseFloat(document.getElementById('monitor-dpi-input').value) || 1.5;
        const monAccel = parseFloat(document.getElementById('monitor-accel-input').value) || 1.2;
        const magEnabled = document.getElementById('magnetism-enabled').checked;
        const magResistance = parseInt(document.getElementById('magnetism-resistance').value) || 15;

        const pinEnabled = document.getElementById('security-pin-enabled').checked;
        const pinVal = (document.getElementById('security-pin-input').value || '1234').trim();

        const newSettings = {
            ...this.info.settings,
            boundaryMagnetism: {
                enabled: magEnabled,
                resistance: magResistance,
                breakthroughVelocity: 25
            },
            security: {
                pinAuthEnabled: pinEnabled,
                pin: pinVal
            },
            perMonitorProfiles: {
                ...this.info.settings.perMonitorProfiles,
                [this.selectedMonId]: {
                    ...(this.info.settings.perMonitorProfiles && this.info.settings.perMonitorProfiles[this.selectedMonId]),
                    dpi: monDpi,
                    acceleration: monAccel
                }
            }
        };

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings)
            });
            const data = await res.json();
            if (data.success) {
                alert('Ayarlar basariyla kaydedildi!');
                this.loadInfo();
            }
        } catch (e) {
            alert('Ayarlar kaydedilirken hata olustu.');
        }
    }

    // Canli Test Alani
    initTestCanvas() {
        const testArea = document.getElementById('live-test-area');
        const testCursor = document.getElementById('live-test-cursor');
        if (!testArea || !testCursor) return;

        let mouseX = 150, mouseY = 100;
        testArea.addEventListener('mousemove', (e) => {
            const rect = testArea.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
            testCursor.style.left = `${mouseX}px`;
            testCursor.style.top = `${mouseY}px`;
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.admin = new AdminDashboard();
});
