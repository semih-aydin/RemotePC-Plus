const fs = require('fs');
const win32 = require('./win32_api');

class MonitorManager {
    constructor() {
        this.monitors = [];
        this.settings = null;
        this.fracX = 0;
        this.fracY = 0;
        this.loadSettings();
        this.refreshMonitors();
    }

    // Ayarlari settings.json dosyasindan oku
    loadSettings() {
        try {
            const data = fs.readFileSync('./settings.json', 'utf8');
            this.settings = JSON.parse(data);
        } catch (e) {
            console.log('settings.json okunamadi, default ayarlari kullanalim');
            this.settings = {
                defaultDpi: 1.5,
                velocityCurve: 1.8,
                boundaryMagnetism: { enabled: true, resistance: 15, breakthroughVelocity: 25 },
                perMonitorProfiles: {}
            };
        }
    }

    // Bagli tum monitorleri tara ve listele
    refreshMonitors() {
        const rawMonitors = win32.enumerateMonitors();
        const found = [];

        rawMonitors.forEach((m, idx) => {
            const monId = idx + 1;
            const profile = (this.settings.perMonitorProfiles && this.settings.perMonitorProfiles[monId]) || {};

            found.push({
                id: monId,
                handle: m.handle,
                name: profile.name || m.deviceName || `Monitor ${monId}`,
                deviceName: m.deviceName,
                x: m.x,
                y: m.y,
                width: m.width,
                height: m.height,
                isPrimary: m.isPrimary,
                dpi: profile.dpi || this.settings.defaultDpi || 1.5,
                acceleration: profile.acceleration || 1.2
            });
        });

        if (found.length > 0) {
            this.monitors = found;
        } else {
            // Fallback tek monitor
            this.monitors = [{
                id: 1,
                name: 'Varsayilan Ekran',
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
                isPrimary: true,
                dpi: 1.5,
                acceleration: 1.2
            }];
        }

        const ts = new Date().toISOString().replace('T', ' ').substring(0, 23);
        console.log(`[${ts}] [INFO ] [MONITOR     ] Enumerated ${this.monitors.length} active displays:`);
        this.monitors.forEach(m => {
            console.log(`[${ts}] [INFO ] [MONITOR     ]   -> [Display ${m.id}] ${m.name} | ${m.width}x${m.height} @ (${m.x}, ${m.y}) | Primary=${m.isPrimary} | DPI=${m.dpi}x`);
        });
        return this.monitors;
    }

    // Su an farenin hangi monitorde oldugunu bul
    getCurrentMonitor(cursorX, cursorY) {
        if (!this.monitors || this.monitors.length === 0) return null;
        for (const mon of this.monitors) {
            if (cursorX >= mon.x && cursorX < (mon.x + mon.width) &&
                cursorY >= mon.y && cursorY < (mon.y + mon.height)) {
                return mon;
            }
        }
        return this.monitors[0];
    }

    // Fare hareketini per-monitor DPI ve kenar miknatisi (boundary magnetism) kurallarina gore filtrele
    processMovement(rawDx, rawDy) {
        const curPos = win32.getCursorPos();
        const curMon = this.getCurrentMonitor(curPos.x, curPos.y);

        const dpi = (curMon && curMon.dpi) ? curMon.dpi : this.settings.defaultDpi;
        const accel = (curMon && curMon.acceleration) ? curMon.acceleration : 1.2;

        // Hiz temelli ivme (velocity curve)
        const speed = Math.hypot(rawDx, rawDy);
        let multiplier = dpi;
        if (speed > 5) {
            multiplier *= Math.pow(speed / 5, accel - 1.0);
        }

        let finalDx = rawDx * multiplier;
        let finalDy = rawDy * multiplier;

        // Monitor Kenar Direnci (Boundary Magnetism) Kontrolu
        let boundaryHit = false;
        if (this.settings.boundaryMagnetism && this.settings.boundaryMagnetism.enabled && curMon) {
            const mag = this.settings.boundaryMagnetism;
            const nextX = curPos.x + finalDx;
            const nextY = curPos.y + finalDy;

            const atLeftEdge = (curPos.x <= curMon.x + mag.resistance) && finalDx < 0;
            const atRightEdge = (curPos.x >= (curMon.x + curMon.width - mag.resistance)) && finalDx > 0;
            const atTopEdge = (curPos.y <= curMon.y + mag.resistance) && finalDy < 0;
            const atBottomEdge = (curPos.y >= (curMon.y + curMon.height - mag.resistance)) && finalDy > 0;

            const targetMon = this.getCurrentMonitor(nextX, nextY);
            if (targetMon && targetMon.id !== curMon.id) {
                if (speed < mag.breakthroughVelocity) {
                    if (atLeftEdge || atRightEdge) finalDx *= 0.15;
                    if (atTopEdge || atBottomEdge) finalDy *= 0.15;
                    boundaryHit = true;
                }
            }
        }

        // Alt-piksel kesirli biriktirici (Sub-pixel residual accumulator — yavas hareketlerde 1px hassasiyet)
        const totalDx = finalDx + this.fracX;
        const totalDy = finalDy + this.fracY;
        const moveX = Math.trunc(totalDx);
        const moveY = Math.trunc(totalDy);
        this.fracX = totalDx - moveX;
        this.fracY = totalDy - moveY;

        if (moveX !== 0 || moveY !== 0) {
            win32.moveMouseRelative(moveX, moveY);
        }

        return {
            dx: finalDx,
            dy: finalDy,
            currentMonitorId: curMon ? curMon.id : 1,
            boundaryHit: boundaryHit
        };
    }

    // Istenen monitorun merkezine direkt isinlan (Screen Jump / Teleport)
    jumpToMonitor(targetId) {
        const mon = this.monitors.find(m => m.id === parseInt(targetId));
        if (!mon) {
            console.log(`Monitor ${targetId} bulunamadi!`);
            return false;
        }

        const centerX = Math.round(mon.x + mon.width / 2);
        const centerY = Math.round(mon.y + mon.height / 2);

        win32.setCursorPos(centerX, centerY);
        const ts = new Date().toISOString().replace('T', ' ').substring(0, 23);
        console.log(`[${ts}] [INFO ] [MONITOR     ] Screen jump executed: Display ${mon.id} -> center=(${centerX}, ${centerY})`);
        return { success: true, monitorId: mon.id, x: centerX, y: centerY };
    }

    // Monitor profil ayarlarini guncelle
    updateMonitorProfile(monId, data) {
        if (!this.settings.perMonitorProfiles) this.settings.perMonitorProfiles = {};
        this.settings.perMonitorProfiles[monId] = Object.assign(this.settings.perMonitorProfiles[monId] || {}, data);
        try {
            fs.writeFileSync('./settings.json', JSON.stringify(this.settings, null, 2), 'utf8');
        } catch (e) {
            console.log('Ayarlar kaydedilirken hata:', e);
        }
        this.refreshMonitors();
    }
}

module.exports = new MonitorManager();
