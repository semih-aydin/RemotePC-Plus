const EventEmitter = require('events');
const fs = require('fs');
const win32 = require('./win32_api');

class AppDetector extends EventEmitter {
    constructor() {
        super();
        this.currentContext = 'desktop';
        this.currentProcess = '';
        this.currentTitle = '';
        this.checkInterval = null;
        this.rules = {};
        this.loadRules();
    }

    // Ayarlardan kurallari cek
    loadRules() {
        try {
            const data = fs.readFileSync('./settings.json', 'utf8');
            const parsed = JSON.parse(data);
            this.rules = parsed.appContextRules || {};
        } catch (e) {
            console.log('App kurallari okunamadi, default kullanalim');
            this.rules = {
                'spotify': 'media',
                'vlc': 'media',
                'wmplayer': 'media',
                'powerpnt': 'presentation',
                'chrome': 'browser',
                'msedge': 'browser',
                'firefox': 'browser',
                'code': 'code'
            };
        }
    }

    // Arka planda aktif pencereyi dinlemeye basla
    start(intervalMs = 800) {
        if (this.checkInterval) clearInterval(this.checkInterval);

        this.checkInterval = setInterval(() => {
            this.checkActiveApp();
        }, intervalMs);

        console.log('[AppDetector] Aktif pencere takipcisi baslatildi.');
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    // Aktif pencereyi analiz et
    checkActiveApp() {
        try {
            const info = win32.getActiveWindowInfo();
            const proc = (info.processName || '').toLowerCase();
            const title = (info.title || '').toLowerCase();

            let detectedContext = 'desktop';

            // Once process adina gore bakalim
            for (const [key, ctx] of Object.entries(this.rules)) {
                if (proc.includes(key.toLowerCase())) {
                    detectedContext = ctx;
                    break;
                }
            }

            // Eger bulunamadiysa pencere basligina bakalim (orn: YouTube, Spotify Web, PDF Sunum)
            if (detectedContext === 'desktop') {
                if (title.includes('youtube') || title.includes('spotify') || title.includes('soundcloud') || title.includes('vlc media player')) {
                    detectedContext = 'media';
                } else if (title.includes('powerpoint') || title.includes('slides') || title.includes('sunum') || title.includes('presentation')) {
                    detectedContext = 'presentation';
                } else if (title.includes('google chrome') || title.includes('edge') || title.includes('mozilla firefox')) {
                    detectedContext = 'browser';
                } else if (title.includes('visual studio code') || title.includes('.js') || title.includes('.cpp') || title.includes('.py')) {
                    detectedContext = 'code';
                }
            }

            // Durum degistiyse haber verelim
            if (detectedContext !== this.currentContext || proc !== this.currentProcess || title !== this.currentTitle) {
                this.currentContext = detectedContext;
                this.currentProcess = proc;
                this.currentTitle = info.title;

                const ts = new Date().toISOString().replace('T', ' ').substring(0, 23);
                console.log(`[${ts}] [INFO ] [APP_DETECTOR] Context shifted -> proc="${proc}" title="${info.title.substring(0, 40)}" context=[${detectedContext.toUpperCase()}]`);

                this.emit('contextChange', {
                    context: this.currentContext,
                    processName: this.currentProcess,
                    windowTitle: this.currentTitle
                });
            }
        } catch (e) {
            // Sessizce devam et
        }
    }

    // Su anki aktif duruma direkt erisim
    getState() {
        return {
            context: this.currentContext,
            processName: this.currentProcess,
            windowTitle: this.currentTitle
        };
    }
}

module.exports = new AppDetector();
