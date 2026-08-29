// Multi-Monitor Yonetimi (Istemci Tarafi)
// Bagli ekranlar arasi gecis, ekran secimi ve kenar direnci gorsel geri bildirimi

class MultiMonitorClient {
    constructor() {
        this.monitors = [];
        this.currentMonitorId = 1;
        this.initEvents();
    }

    initEvents() {
        // Ekran degistirme butonlari
        document.querySelectorAll('.screen-switch-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const monId = parseInt(btn.getAttribute('data-screen-id'));
                this.jumpTo(monId);
            });
        });
    }

    // Sunucudan gelen monitor listesini yukle
    setMonitors(monList) {
        this.monitors = monList || [];
        this.renderMonitorSelector();
    }

    // Monitor secim butonlarini arayuze bas
    renderMonitorSelector() {
        const container = document.getElementById('monitor-chips-container');
        if (!container) return;

        container.innerHTML = '';
        this.monitors.forEach(mon => {
            const chip = document.createElement('button');
            chip.className = `mon-chip-btn ${mon.id === this.currentMonitorId ? 'active' : ''}`;
            chip.setAttribute('data-mon-id', mon.id);
            chip.innerHTML = `<i class="fas fa-desktop"></i> ${mon.name} <span class="mon-res">${mon.width}x${mon.height}</span>`;

            chip.addEventListener('click', () => {
                this.jumpTo(mon.id);
            });

            container.appendChild(chip);
        });
    }

    // Istenen ekrana isinlan
    jumpTo(monitorId) {
        this.currentMonitorId = monitorId;
        window.app.send({
            type: 'monitor_jump',
            monitorId: monitorId
        });
        window.haptics.monitorJump();
        this.updateActiveBadge();
    }

    // Bir sonraki veya onceki ekrana isinlan (3 Parmak Hareketi Icin)
    jumpRelative(direction = 'next') {
        if (!this.monitors || this.monitors.length <= 1) return;

        let curIdx = this.monitors.findIndex(m => m.id === this.currentMonitorId);
        if (curIdx === -1) curIdx = 0;

        if (direction === 'next') {
            curIdx = (curIdx + 1) % this.monitors.length;
        } else {
            curIdx = (curIdx - 1 + this.monitors.length) % this.monitors.length;
        }

        const targetMon = this.monitors[curIdx];
        if (targetMon) {
            this.jumpTo(targetMon.id);
        }
    }

    updateActiveBadge() {
        document.querySelectorAll('.mon-chip-btn').forEach(btn => {
            const id = parseInt(btn.getAttribute('data-mon-id'));
            if (id === this.currentMonitorId) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        const activeMonLabel = document.getElementById('active-mon-label');
        const mon = this.monitors.find(m => m.id === this.currentMonitorId);
        if (activeMonLabel && mon) {
            activeMonLabel.textContent = `${mon.name} (${mon.width}x${mon.height})`;
        }
    }

    // Monitor kenar direncine takildiginda ekranda neon parlama goster
    showBoundaryFeedback() {
        const glow = document.getElementById('screen-edge-glow');
        if (glow) {
            glow.classList.add('active');
            setTimeout(() => glow.classList.remove('active'), 200);
        }
    }
}

window.multiMonitor = new MultiMonitorClient();
