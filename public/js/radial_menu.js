// 8-Way Radial Macro Menu (8 Yonlu Dairesel Hizli Makro Tekerlegi)
// Uzun basma (long-press) veya buton ile acilan, parmak yonune gore aninda makro tetikleyen tekerlek

class RadialMenuController {
    constructor() {
        this.container = document.getElementById('radial-menu-overlay');
        this.wheel = document.getElementById('radial-menu-wheel');
        this.selectedLabel = document.getElementById('radial-selected-label');

        this.isOpen = false;
        this.centerX = 0;
        this.centerY = 0;
        this.selectedSector = -1;

        // 8 Yonlu Makrolar (Kuzeyden baslayarak saat yonunde)
        this.sectors = [
            { id: 0, name: 'Gorev Gorunumu', icon: 'fa-th-large', keys: ['win', 'tab'], angle: 270 }, // Kuzey (Top)
            { id: 1, name: 'Pencereyi Kapat', icon: 'fa-times', keys: ['ctrl', 'w'], angle: 315 },     // Kuzey-Dogu
            { id: 2, name: 'Yinele (Redo)', icon: 'fa-redo', keys: ['ctrl', 'y'], angle: 0 },          // Dogu (Right)
            { id: 3, name: 'PC Kilitle', icon: 'fa-lock', keys: ['win', 'l'], angle: 45 },             // Guney-Dogu
            { id: 4, name: 'Masaustu', icon: 'fa-desktop', keys: ['win', 'd'], angle: 90 },            // Guney (Bottom)
            { id: 5, name: 'Ekran Alintisi', icon: 'fa-camera', keys: ['win', 'shift', 's'], angle: 135 }, // Guney-Bati
            { id: 6, name: 'Geri Al (Undo)', icon: 'fa-undo', keys: ['ctrl', 'z'], angle: 180 },       // Bati (Left)
            { id: 7, name: 'Yapistir', icon: 'fa-paste', keys: ['ctrl', 'v'], angle: 225 }             // Kuzey-Bati
        ];

        this.initEvents();
    }

    initEvents() {
        // Ekrandaki ozel Radial Menu acma butonu
        const triggerBtn = document.getElementById('radial-trigger-btn');
        if (triggerBtn) {
            triggerBtn.addEventListener('click', () => {
                const w = window.innerWidth;
                const h = window.innerHeight;
                this.open(w / 2, h / 2);
            });
        }
    }

    open(x, y) {
        if (!this.container || !this.wheel) return;

        this.isOpen = true;
        this.centerX = x;
        this.centerY = y;
        this.selectedSector = -1;

        // Tekerlegi dokunulan noktaya konumlandir
        this.wheel.style.left = `${x}px`;
        this.wheel.style.top = `${y}px`;

        this.container.classList.add('active');
        if (this.selectedLabel) this.selectedLabel.textContent = 'Bir yon secin...';

        window.haptics.modeSwitch();
    }

    handleTouchMove(touchX, touchY) {
        if (!this.isOpen) return;

        const dx = touchX - this.centerX;
        const dy = touchY - this.centerY;
        const dist = Math.hypot(dx, dy);

        // Merkezdeki olu bolge (< 35px)
        if (dist < 35) {
            if (this.selectedSector !== -1) {
                this.clearSelection();
                this.selectedSector = -1;
            }
            if (this.selectedLabel) this.selectedLabel.textContent = 'Bir yon secin...';
            return;
        }

        // Acıyı hesapla (0..360 derece)
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle < 0) angle += 360;

        // 8 dilimden hangisi (her dilim 45 derece)
        // 0: [337.5 - 22.5] -> Dogu
        // 1: [22.5 - 67.5]  -> Guney-Dogu
        // 2: [67.5 - 112.5] -> Guney
        // 3: [112.5 - 157.5]-> Guney-Bati
        // 4: [157.5 - 202.5]-> Bati
        // 5: [202.5 - 247.5]-> Kuzey-Bati
        // 6: [247.5 - 292.5]-> Kuzey
        // 7: [292.5 - 337.5]-> Kuzey-Dogu

        let sectorIdx = -1;
        if (angle >= 337.5 || angle < 22.5) sectorIdx = 2; // Dogu (Redo)
        else if (angle >= 22.5 && angle < 67.5) sectorIdx = 3; // Guney-Dogu (Lock)
        else if (angle >= 67.5 && angle < 112.5) sectorIdx = 4; // Guney (Desktop)
        else if (angle >= 112.5 && angle < 157.5) sectorIdx = 5; // Guney-Bati (Snip)
        else if (angle >= 157.5 && angle < 202.5) sectorIdx = 6; // Bati (Undo)
        else if (angle >= 202.5 && angle < 247.5) sectorIdx = 7; // Kuzey-Bati (Paste)
        else if (angle >= 247.5 && angle < 292.5) sectorIdx = 0; // Kuzey (Taskview)
        else if (angle >= 292.5 && angle < 337.5) sectorIdx = 1; // Kuzey-Dogu (Close)

        if (sectorIdx !== this.selectedSector) {
            this.selectedSector = sectorIdx;
            this.highlightSector(sectorIdx);
            window.haptics.radialSelect();

            const sec = this.sectors[sectorIdx];
            if (this.selectedLabel && sec) {
                this.selectedLabel.textContent = sec.name;
            }
        }
    }

    highlightSector(idx) {
        document.querySelectorAll('.radial-sector-item').forEach(item => {
            const secId = parseInt(item.getAttribute('data-sector-id'));
            if (secId === idx) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    clearSelection() {
        document.querySelectorAll('.radial-sector-item').forEach(item => item.classList.remove('active'));
    }

    closeAndExecute() {
        if (!this.isOpen) return;

        if (this.selectedSector >= 0 && this.selectedSector < this.sectors.length) {
            const sec = this.sectors[this.selectedSector];
            if (sec && sec.keys) {
                console.log(`[RadialMenu] Makro calistiriliyor: ${sec.name}`);
                window.app.send({ type: 'macro', keys: sec.keys });
                window.haptics.success();
            }
        }

        this.isOpen = false;
        if (this.container) this.container.classList.remove('active');
        this.clearSelection();
    }
}

window.radialMenu = new RadialMenuController();
