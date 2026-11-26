const koffi = require('koffi');
const fs = require('fs');

// Win32 kutuphanelerini yukleyelim
const user32 = koffi.load('user32.dll');
const gdi32 = koffi.load('gdi32.dll');
const kernel32 = koffi.load('kernel32.dll');

// Struct tanimlari (Koffi'de global kaydedildigi icin tek yerde tanimlayalim)
const POINT = koffi.struct('POINT', { x: 'long', y: 'long' });
const RECT = koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' });

const MONITORINFOEXW = koffi.struct('MONITORINFOEXW', {
    cbSize: 'uint32',
    rcMonitor: RECT,
    rcWork: RECT,
    dwFlags: 'uint32',
    szDevice: koffi.array('uint16', 32)
});

const BITMAPINFOHEADER = koffi.struct('BITMAPINFOHEADER', {
    biSize: 'uint32',
    biWidth: 'long',
    biHeight: 'long',
    biPlanes: 'uint16',
    biBitCount: 'uint16',
    biCompression: 'uint32',
    biSizeImage: 'uint32',
    biXPelsPerMeter: 'long',
    biYPelsPerMeter: 'long',
    biClrUsed: 'uint32',
    biClrImportant: 'uint32'
});

const BITMAPINFO = koffi.struct('BITMAPINFO', {
    bmiHeader: BITMAPINFOHEADER,
    bmiColors: koffi.array('uint32', 1)
});

// SendInput icin 64-bit uyumlu KEYBDINPUT & INPUT struct (Unicode karakter yazimi icin)
const KEYBDINPUT = koffi.struct('KEYBDINPUT', {
    wVk: 'uint16',
    wScan: 'uint16',
    dwFlags: 'uint32',
    time: 'uint32',
    dwExtraInfo: 'uintptr_t'
});

const MOUSEINPUT_PAD = koffi.struct('MOUSEINPUT_PAD', {
    dx: 'long',
    dy: 'long',
    mouseData: 'uint32',
    dwFlags: 'uint32',
    time: 'uint32',
    dwExtraInfo: 'uintptr_t'
});

const INPUT_UNION = koffi.union('INPUT_UNION', {
    mi: MOUSEINPUT_PAD,
    ki: KEYBDINPUT
});

const INPUT = koffi.struct('INPUT', {
    type: 'uint32',
    u: INPUT_UNION
});

const SYSTEM_POWER_STATUS = koffi.struct('SYSTEM_POWER_STATUS', {
    ACLineStatus: 'uint8',
    BatteryFlag: 'uint8',
    BatteryLifePercent: 'uint8',
    SystemStatusFlag: 'uint8',
    BatteryLifeTime: 'uint32',
    BatteryFullLifeTime: 'uint32'
});

// User32 fonksiyonlari
const GetCursorPos = user32.func('bool GetCursorPos(_Out_ POINT* lpPoint)');
const SetCursorPos = user32.func('bool SetCursorPos(int X, int Y)');
const mouse_event = user32.func('void mouse_event(uint32 dwFlags, uint32 dx, uint32 dy, uint32 dwData, uintptr_t dwExtraInfo)');
const keybd_event = user32.func('void keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr_t dwExtraInfo)');
const SendInput = user32.func('uint32 SendInput(uint32 cInputs, INPUT* pInputs, int cbSize)');
const GetSystemMetrics = user32.func('int GetSystemMetrics(int nIndex)');
const GetForegroundWindow = user32.func('intptr_t GetForegroundWindow()');
const GetWindowTextW = user32.func('int GetWindowTextW(intptr_t hWnd, _Out_ uint16* lpString, int nMaxCount)');
const GetWindowThreadProcessId = user32.func('uint32 GetWindowThreadProcessId(intptr_t hWnd, _Out_ uint32* lpdwProcessId)');

// Monitor fonksiyonlari
const GetMonitorInfoW = user32.func('bool GetMonitorInfoW(intptr_t hMonitor, _Inout_ MONITORINFOEXW* lpmi)');
const MonitorEnumProc = koffi.proto('bool MonitorEnumProc(intptr_t hMonitor, intptr_t hdcMonitor, void* lprcMonitor, intptr_t dwData)');
const EnumDisplayMonitors = user32.func('bool EnumDisplayMonitors(intptr_t hdc, void* lprcClip, MonitorEnumProc* lpfnEnum, intptr_t dwData)');

// GDI32 fonksiyonlari (ekran yakalama icin)
const GetDC = user32.func('intptr_t GetDC(intptr_t hWnd)');
const ReleaseDC = user32.func('int ReleaseDC(intptr_t hWnd, intptr_t hDC)');
const CreateCompatibleDC = gdi32.func('intptr_t CreateCompatibleDC(intptr_t hdc)');
const CreateCompatibleBitmap = gdi32.func('intptr_t CreateCompatibleBitmap(intptr_t hdc, int cx, int cy)');
const SelectObject = gdi32.func('intptr_t SelectObject(intptr_t hdc, intptr_t h)');
const BitBlt = gdi32.func('bool BitBlt(intptr_t hdc, int x, int y, int cx, int cy, intptr_t hdcSrc, int x1, int y1, uint32 rop)');
const DeleteDC = gdi32.func('bool DeleteDC(intptr_t hdc)');
const DeleteObject = gdi32.func('bool DeleteObject(intptr_t ho)');
const GetDIBits = gdi32.func('int GetDIBits(intptr_t hdc, intptr_t hbm, uint32 start, uint32 cLines, _Out_ uint8* lpvBits, _Inout_ BITMAPINFO* lpbmi, uint32 usage)');

// Kernel32 fonksiyonlari
const OpenProcess = kernel32.func('intptr_t OpenProcess(uint32 dwDesiredAccess, bool bInheritHandle, uint32 dwProcessId)');
const QueryFullProcessImageNameW = kernel32.func('bool QueryFullProcessImageNameW(intptr_t hProcess, uint32 dwFlags, _Out_ uint16* lpExeName, _Inout_ uint32* lpdwSize)');
const CloseHandle = kernel32.func('bool CloseHandle(intptr_t hObject)');
const GetSystemPowerStatus = kernel32.func('bool GetSystemPowerStatus(_Out_ SYSTEM_POWER_STATUS* lpSystemPowerStatus)');

// Mouse bayraklari (Windows API constants)
const MOUSEEVENTF_MOVE = 0x0001;
const MOUSEEVENTF_LEFTDOWN = 0x0002;
const MOUSEEVENTF_LEFTUP = 0x0004;
const MOUSEEVENTF_RIGHTDOWN = 0x0008;
const MOUSEEVENTF_RIGHTUP = 0x0010;
const MOUSEEVENTF_MIDDLEDOWN = 0x0020;
const MOUSEEVENTF_MIDDLEUP = 0x0040;
const MOUSEEVENTF_WHEEL = 0x0800;
const MOUSEEVENTF_HWHEEL = 0x1000;
const MOUSEEVENTF_ABSOLUTE = 0x8000;

// Klavye bayraklari
const KEYEVENTF_EXTENDEDKEY = 0x0001;
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_UNICODE = 0x0004;
const INPUT_KEYBOARD = 1;
const SIZEOF_INPUT = koffi.sizeof(INPUT);

// Sik kullanilan Tus Kodlari (Virtual Key Codes)
const VK_MAP = {
    'backspace': 0x08, 'tab': 0x09, 'enter': 0x0D, 'return': 0x0D, 'shift': 0x10, 'ctrl': 0x11, 'alt': 0x12,
    'pause': 0x13, 'capslock': 0x14, 'esc': 0x1B, 'space': 0x20, 'pageup': 0x21, 'pagedown': 0x22,
    'end': 0x23, 'home': 0x24, 'left': 0x25, 'up': 0x26, 'right': 0x27, 'down': 0x28,
    'insert': 0x2D, 'delete': 0x2E, 'win': 0x5B, 'win_r': 0x5C,
    'f1': 0x70, 'f2': 0x71, 'f3': 0x72, 'f4': 0x73, 'f5': 0x74, 'f6': 0x75,
    'f7': 0x76, 'f8': 0x77, 'f9': 0x78, 'f10': 0x79, 'f11': 0x7A, 'f12': 0x7B,
    // Medya tuslari
    'vol_mute': 0xAD, 'vol_down': 0xAE, 'vol_up': 0xAF,
    'media_next': 0xB0, 'media_prev': 0xB1, 'media_stop': 0xB2, 'media_play_pause': 0xB3
};

// Harfler ve sayilari ekleyelim
for (let i = 0; i <= 9; i++) {
    VK_MAP[i.toString()] = 0x30 + i;
    VK_MAP['num' + i] = 0x60 + i; // Numpad
}
for (let c = 65; c <= 90; c++) {
    const char = String.fromCharCode(c).toLowerCase();
    VK_MAP[char] = c;
}

// Noktalama ve ozel tuslar
VK_MAP['plus'] = 0xBB;
VK_MAP['comma'] = 0xBC;
VK_MAP['minus'] = 0xBD;
VK_MAP['dot'] = 0xBE;
VK_MAP['/'] = 0xBF;
VK_MAP['slash'] = 0xBF;
VK_MAP['`'] = 0xC0;
VK_MAP['backtick'] = 0xC0;

class Win32Api {
    // Pil ve sarj durumunu 0ms maliyetle Win32'den oku
    getBatteryStatus() {
        try {
            const st = {};
            if (GetSystemPowerStatus(st)) {
                const hasBattery = (st.BatteryFlag & 128) === 0 && st.BatteryLifePercent <= 100;
                return {
                    hasBattery,
                    percent: hasBattery ? st.BatteryLifePercent : null,
                    charging: st.ACLineStatus === 1
                };
            }
        } catch (_) {}
        return { hasBattery: false, percent: null, charging: true };
    }

    // Farenin anlik ekran koordinatini alir
    getCursorPos() {
        const pt = {};
        GetCursorPos(pt);
        return { x: pt.x, y: pt.y };
    }

    // Fareyi direkt koordinata isinlar (teleport / jump)
    setCursorPos(x, y) {
        SetCursorPos(Math.round(x), Math.round(y));
    }

    // Bagil fare hareketi (relative move - delta x, delta y)
    moveMouseRelative(dx, dy) {
        const current = this.getCursorPos();
        SetCursorPos(current.x + Math.round(dx), current.y + Math.round(dy));
    }

    // Fare tiklama islemleri
    mouseClick(button = 'left', state = 'click') {
        let downFlag = 0;
        let upFlag = 0;

        if (button === 'left') {
            downFlag = MOUSEEVENTF_LEFTDOWN;
            upFlag = MOUSEEVENTF_LEFTUP;
        } else if (button === 'right') {
            downFlag = MOUSEEVENTF_RIGHTDOWN;
            upFlag = MOUSEEVENTF_RIGHTUP;
        } else if (button === 'middle') {
            downFlag = MOUSEEVENTF_MIDDLEDOWN;
            upFlag = MOUSEEVENTF_MIDDLEUP;
        }

        if (state === 'down') {
            mouse_event(downFlag, 0, 0, 0, 0);
        } else if (state === 'up') {
            mouse_event(upFlag, 0, 0, 0, 0);
        } else if (state === 'click') {
            mouse_event(downFlag, 0, 0, 0, 0);
            mouse_event(upFlag, 0, 0, 0, 0);
        } else if (state === 'double') {
            mouse_event(downFlag, 0, 0, 0, 0);
            mouse_event(upFlag, 0, 0, 0, 0);
            mouse_event(downFlag, 0, 0, 0, 0);
            mouse_event(upFlag, 0, 0, 0, 0);
        }
    }

    // Fare tekerlegi kaydirma (scroll)
    scrollWheel(deltaY, deltaX = 0) {
        if (deltaY !== 0) {
            const scrollAmount = Math.round(deltaY * 120);
            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, scrollAmount, 0);
        }
        if (deltaX !== 0) {
            const hScrollAmount = Math.round(deltaX * 120);
            mouse_event(MOUSEEVENTF_HWHEEL, 0, 0, hScrollAmount, 0);
        }
    }

    // Pinch-to-zoom: Ctrl tusuna basip fare tekeri dondurme
    zoom(delta) {
        keybd_event(VK_MAP['ctrl'], 0, 0, 0);
        const scrollAmount = delta > 0 ? 120 : -120;
        mouse_event(MOUSEEVENTF_WHEEL, 0, 0, scrollAmount, 0);
        keybd_event(VK_MAP['ctrl'], 0, KEYEVENTF_KEYUP, 0);
    }

    // Klavye tusu basma/birakma
    keyPress(keyName, state = 'press') {
        const lowerKey = keyName.toLowerCase();
        const vk = VK_MAP[lowerKey] || 0;
        if (!vk) {
            if (keyName.length === 1) {
                this.typeChar(keyName);
            }
            return;
        }

        if (state === 'down') {
            keybd_event(vk, 0, 0, 0);
        } else if (state === 'up') {
            keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
        } else if (state === 'press') {
            keybd_event(vk, 0, 0, 0);
            keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
        }
    }

    // Kombinasyon / Makro calistirma (orn: ['ctrl', 'c'])
    runCombo(keys = []) {
        const vkList = [];
        for (const k of keys) {
            const vk = VK_MAP[k.toLowerCase()];
            if (vk) {
                vkList.push(vk);
                keybd_event(vk, 0, 0, 0);
            }
        }
        for (let i = vkList.length - 1; i >= 0; i--) {
            keybd_event(vkList[i], 0, KEYEVENTF_KEYUP, 0);
        }
    }

    // Tek karakter yazma (Turkce ve tum Unicode karakterler dahil)
    typeChar(char) {
        if (char === '\n') {
            this.keyPress('enter');
            return;
        }
        if (char === '\t') {
            this.keyPress('tab');
            return;
        }
        const code = char.charCodeAt(0);
        const inputs = [
            {
                type: INPUT_KEYBOARD,
                u: {
                    ki: {
                        wVk: 0,
                        wScan: code,
                        dwFlags: KEYEVENTF_UNICODE,
                        time: 0,
                        dwExtraInfo: 0
                    }
                }
            },
            {
                type: INPUT_KEYBOARD,
                u: {
                    ki: {
                        wVk: 0,
                        wScan: code,
                        dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0
                    }
                }
            }
        ];
        SendInput(2, inputs, SIZEOF_INPUT);
    }

    // Metin yazma
    typeString(str) {
        for (let i = 0; i < str.length; i++) {
            this.typeChar(str[i]);
        }
    }

    // Medya kontrolleri
    mediaControl(action) {
        switch (action) {
            case 'play_pause':
            case 'play':
            case 'pause':
                this.keyPress('media_play_pause');
                break;
            case 'next':
                this.keyPress('media_next');
                break;
            case 'prev':
                this.keyPress('media_prev');
                break;
            case 'vol_up':
                this.keyPress('vol_up');
                break;
            case 'vol_down':
                this.keyPress('vol_down');
                break;
            case 'mute':
                this.keyPress('vol_mute');
                break;
        }
    }

    // Sunum kontrolleri
    presentationControl(action) {
        switch (action) {
            case 'next':
                this.keyPress('pagedown');
                break;
            case 'prev':
                this.keyPress('pageup');
                break;
            case 'start':
                this.keyPress('f5');
                break;
            case 'stop':
            case 'exit':
                this.keyPress('esc');
                break;
            case 'black':
            case 'blank_black':
                this.keyPress('b');
                break;
            case 'white':
            case 'blank_white':
                this.keyPress('w');
                break;
        }
    }

    // Aktif pencereyi ve calisan exe adini bul
    getActiveWindowInfo() {
        try {
            const hwnd = GetForegroundWindow();
            if (!hwnd) return { title: '', processName: 'unknown' };

            const titleBuf = new Uint16Array(256);
            const titleLen = GetWindowTextW(hwnd, titleBuf, 256);
            const title = String.fromCharCode(...titleBuf.slice(0, titleLen));

            const pidPtr = [0];
            GetWindowThreadProcessId(hwnd, pidPtr);
            const pid = pidPtr[0];

            let processName = 'unknown';
            if (pid) {
                const hProcess = OpenProcess(0x1000, false, pid);
                if (hProcess) {
                    const exeBuf = new Uint16Array(512);
                    const sizePtr = [512];
                    if (QueryFullProcessImageNameW(hProcess, 0, exeBuf, sizePtr)) {
                        const fullPath = String.fromCharCode(...exeBuf.slice(0, sizePtr[0]));
                        processName = fullPath.split('\\').pop().toLowerCase().replace('.exe', '');
                    }
                    CloseHandle(hProcess);
                }
            }

            return { title, processName };
        } catch (err) {
            console.log('Aktif pencere bilgisi alinirken hata:', err);
            return { title: '', processName: 'unknown' };
        }
    }

    // Monitorleri tara
    enumerateMonitors() {
        const found = [];
        try {
            const cb = koffi.register((hMonitor, hdc, lprc, data) => {
                const mi = {
                    cbSize: 40 + 64,
                    rcMonitor: {},
                    rcWork: {},
                    dwFlags: 0,
                    szDevice: new Array(32).fill(0)
                };
                GetMonitorInfoW(hMonitor, mi);

                let devName = '';
                for (let i = 0; i < mi.szDevice.length; i++) {
                    if (mi.szDevice[i] === 0) break;
                    devName += String.fromCharCode(mi.szDevice[i]);
                }

                found.push({
                    handle: hMonitor,
                    deviceName: devName,
                    x: mi.rcMonitor.left,
                    y: mi.rcMonitor.top,
                    width: mi.rcMonitor.right - mi.rcMonitor.left,
                    height: mi.rcMonitor.bottom - mi.rcMonitor.top,
                    isPrimary: (mi.dwFlags & 1) !== 0
                });
                return true;
            }, koffi.pointer(MonitorEnumProc));

            EnumDisplayMonitors(0, null, cb, 0);
            koffi.unregister(cb);
        } catch (err) {
            console.log('Monitor tarama hatasi:', err);
        }
        return found;
    }

    // Farenin etrafindan kucuk ekran goruntusu yakala (Magnifier Loupe icin)
    captureLoupeAroundCursor(width = 120, height = 120) {
        try {
            const pt = this.getCursorPos();
            const hdcScreen = GetDC(0);
            const hdcMem = CreateCompatibleDC(hdcScreen);
            const hBitmap = CreateCompatibleBitmap(hdcScreen, width, height);
            const hOld = SelectObject(hdcMem, hBitmap);

            const srcX = pt.x - Math.floor(width / 2);
            const srcY = pt.y - Math.floor(height / 2);

            BitBlt(hdcMem, 0, 0, width, height, hdcScreen, srcX, srcY, 0x00CC0020);

            const bmi = {
                bmiHeader: {
                    biSize: 40,
                    biWidth: width,
                    biHeight: -height,
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: 0,
                    biSizeImage: width * height * 4,
                    biXPelsPerMeter: 0,
                    biYPelsPerMeter: 0,
                    biClrUsed: 0,
                    biClrImportant: 0
                },
                bmiColors: [0]
            };

            const rawBuffer = new Uint8Array(width * height * 4);
            GetDIBits(hdcMem, hBitmap, 0, height, rawBuffer, bmi, 0);

            SelectObject(hdcMem, hOld);
            DeleteObject(hBitmap);
            DeleteDC(hdcMem);
            ReleaseDC(0, hdcScreen);

            // BGRA -> RGBA renk donusumu
            for (let i = 0; i < rawBuffer.length; i += 4) {
                const b = rawBuffer[i];
                const r = rawBuffer[i + 2];
                rawBuffer[i] = r;
                rawBuffer[i + 2] = b;
            }

            return {
                x: pt.x,
                y: pt.y,
                width,
                height,
                data: Buffer.from(rawBuffer).toString('base64')
            };
        } catch (err) {
            console.log('Loupe ekran yakalamada hata:', err);
            return null;
        }
    }
}

module.exports = new Win32Api();
