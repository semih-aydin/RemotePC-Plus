package com.semih.remotepcplus

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.os.Bundle
import android.text.InputType
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity(), RemoteClient.Listener {

    private lateinit var prefs: Prefs
    private lateinit var haptics: HapticsHelper
    private lateinit var client: RemoteClient

    private val uiScope = CoroutineScope(Dispatchers.Main + Job())

    private lateinit var statusDot: View
    private lateinit var tvPcName: TextView
    private lateinit var tvPing: TextView
    private lateinit var monitorBar: LinearLayout
    private lateinit var monitorChipsContainer: LinearLayout

    private lateinit var tabTouchpad: Button
    private lateinit var tabMedia: Button
    private lateinit var viewTouchpad: View
    private lateinit var viewMedia: View

    private lateinit var touchpadView: TouchpadView
    private lateinit var scrollStrip: View
    private lateinit var btnLeftClick: Button
    private lateinit var btnDragLock: Button
    private lateinit var btnRightClick: Button

    private lateinit var tvActiveWindow: TextView

    private var monitors: List<MonitorInfo> = emptyList()
    private var currentMonitorId: Int = 1
    private var isDragLocked = false
    private var isMediaMode = false
    private var autoRediscoverRunning = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_main)

        prefs = Prefs(this)
        haptics = HapticsHelper(this, prefs)
        client = RemoteClient(this)

        bindViews()
        setupTopBar()
        setupTabs()
        setupTouchpad()
        setupBottomButtons()
        setupMediaAndPresentation()

        if (prefs.hasSavedPc()) {
            connectToSavedPc()
        } else {
            showConnectDialog(autoScan = true)
        }
    }

    override fun onPause() {
        super.onPause()
        touchpadView.forceReleaseDrag()
        if (isDragLocked) {
            isDragLocked = false
            client.sendClick("left", "up")
            updateDragLockUi()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        client.disconnect()
    }

    private fun bindViews() {
        statusDot = findViewById(R.id.statusDot)
        tvPcName = findViewById(R.id.tvPcName)
        tvPing = findViewById(R.id.tvPing)
        monitorBar = findViewById(R.id.monitorBar)
        monitorChipsContainer = findViewById(R.id.monitorChipsContainer)

        tabTouchpad = findViewById(R.id.tabTouchpad)
        tabMedia = findViewById(R.id.tabMedia)
        viewTouchpad = findViewById(R.id.viewTouchpad)
        viewMedia = findViewById(R.id.viewMedia)

        touchpadView = findViewById(R.id.touchpadView)
        scrollStrip = findViewById(R.id.scrollStrip)
        btnLeftClick = findViewById(R.id.btnLeftClick)
        btnDragLock = findViewById(R.id.btnDragLock)
        btnRightClick = findViewById(R.id.btnRightClick)

        tvActiveWindow = findViewById(R.id.tvActiveWindow)
    }

    private fun setupTopBar() {
        findViewById<View>(R.id.pcStatusPill).setOnClickListener {
            haptics.click()
            showConnectDialog(autoScan = true)
        }
        findViewById<View>(R.id.btnKeyboard).setOnClickListener {
            haptics.click()
            showKeyboardDialog()
        }
        findViewById<View>(R.id.btnSettings).setOnClickListener {
            haptics.click()
            showSettingsDialog()
        }
    }

    private fun setupTabs() {
        tabTouchpad.setOnClickListener {
            switchMode(media = false)
        }
        tabMedia.setOnClickListener {
            switchMode(media = true)
        }
        switchMode(media = false)
    }

    private fun switchMode(media: Boolean) {
        isMediaMode = media
        haptics.click()
        viewTouchpad.visibility = if (media) View.GONE else View.VISIBLE
        viewMedia.visibility = if (media) View.VISIBLE else View.GONE

        tabTouchpad.setBackgroundResource(if (!media) R.drawable.bg_tab_active else R.drawable.bg_tab_idle)
        tabMedia.setBackgroundResource(if (media) R.drawable.bg_tab_active else R.drawable.bg_tab_idle)
        tabTouchpad.setTextColor(if (!media) 0xFFFFFFFF.toInt() else 0xFF94A3B8.toInt())
        tabMedia.setTextColor(if (media) 0xFFFFFFFF.toInt() else 0xFF94A3B8.toInt())
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupTouchpad() {
        applyTouchpadPrefs()

        touchpadView.callback = object : TouchpadView.Callback {
            override fun onMove(dx: Float, dy: Float) {
                client.sendMove(dx, dy)
            }

            override fun onClick(button: String, state: String) {
                client.sendClick(button, state)
                when (button) {
                    "right" -> haptics.rightClick()
                    "middle" -> haptics.middleClick()
                    else -> haptics.click()
                }
            }

            override fun onScroll(dy: Float, dx: Float) {
                client.sendScroll(dy, dx)
            }

            override fun onZoom(delta: Int) {
                client.sendZoom(delta)
            }

            override fun onMonitorSwipe(direction: String) {
                jumpMonitorRelative(direction)
            }

            override fun onDragStateChanged(isDragging: Boolean) {
                if (isDragging) haptics.click()
            }
        }

        // Dedicated right-edge vertical scroll strip
        var lastStripY = 0f
        val density = resources.displayMetrics.density
        scrollStrip.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    lastStripY = event.y
                    true
                }

                MotionEvent.ACTION_MOVE -> {
                    val dyDp = (lastStripY - event.y) / density
                    lastStripY = event.y
                    if (kotlin.math.abs(dyDp) > 0.2f) {
                        client.sendScroll(dyDp * 0.55f, 0f)
                    }
                    true
                }

                else -> true
            }
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupBottomButtons() {
        btnLeftClick.setOnTouchListener { v, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    v.isPressed = true
                    client.sendClick("left", "down")
                    haptics.click()
                    true
                }

                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    v.isPressed = false
                    client.sendClick("left", "up")
                    true
                }

                else -> false
            }
        }

        btnRightClick.setOnClickListener {
            client.sendClick("right", "click")
            haptics.rightClick()
        }

        btnDragLock.setOnClickListener {
            isDragLocked = !isDragLocked
            if (isDragLocked) {
                client.sendClick("left", "down")
                haptics.rightClick()
            } else {
                client.sendClick("left", "up")
                haptics.click()
            }
            updateDragLockUi()
        }
    }

    private fun updateDragLockUi() {
        btnDragLock.setBackgroundResource(
            if (isDragLocked) R.drawable.bg_btn_accent else R.drawable.bg_btn_dark
        )
        btnDragLock.text = if (isDragLocked) "Sürükle: AÇIK" else "Sürükle"
    }

    private fun setupMediaAndPresentation() {
        // Media buttons
        findViewById<View>(R.id.btnMediaPrev).setOnClickListener {
            client.sendMedia("prev"); haptics.click()
        }
        findViewById<View>(R.id.btnMediaPlayPause).setOnClickListener {
            client.sendMedia("play_pause"); haptics.click()
        }
        findViewById<View>(R.id.btnMediaNext).setOnClickListener {
            client.sendMedia("next"); haptics.click()
        }
        findViewById<View>(R.id.btnVolDown).setOnClickListener {
            client.sendMedia("vol_down"); haptics.click()
        }
        findViewById<View>(R.id.btnVolMute).setOnClickListener {
            client.sendMedia("mute"); haptics.click()
        }
        findViewById<View>(R.id.btnVolUp).setOnClickListener {
            client.sendMedia("vol_up"); haptics.click()
        }

        // Presentation buttons
        findViewById<View>(R.id.btnPresPrev).setOnClickListener {
            client.sendPresentation("prev"); haptics.click()
        }
        findViewById<View>(R.id.btnPresNext).setOnClickListener {
            client.sendPresentation("next"); haptics.click()
        }
        findViewById<View>(R.id.btnPresStart).setOnClickListener {
            client.sendPresentation("start"); haptics.click()
        }
        findViewById<View>(R.id.btnPresStop).setOnClickListener {
            client.sendPresentation("stop"); haptics.click()
        }
        findViewById<View>(R.id.btnPresBlack).setOnClickListener {
            client.sendPresentation("blank_black"); haptics.click()
        }

        // Quick shortcuts
        findViewById<View>(R.id.btnMacroCopy).setOnClickListener {
            client.sendMacro(listOf("ctrl", "c")); haptics.click()
        }
        findViewById<View>(R.id.btnMacroPaste).setOnClickListener {
            client.sendMacro(listOf("ctrl", "v")); haptics.click()
        }
        findViewById<View>(R.id.btnMacroUndo).setOnClickListener {
            client.sendMacro(listOf("ctrl", "z")); haptics.click()
        }
        findViewById<View>(R.id.btnMacroDesktop).setOnClickListener {
            client.sendMacro(listOf("win", "d")); haptics.click()
        }
        findViewById<View>(R.id.btnMacroTaskView).setOnClickListener {
            client.sendMacro(listOf("win", "tab")); haptics.click()
        }
        findViewById<View>(R.id.btnMacroClose).setOnClickListener {
            client.sendMacro(listOf("alt", "f4")); haptics.click()
        }
    }

    private fun applyTouchpadPrefs() {
        touchpadView.sensitivity = prefs.sensitivity
        touchpadView.naturalScroll = prefs.naturalScroll
        touchpadView.doubleTapDragEnabled = prefs.doubleTapDrag
    }

    private fun connectToSavedPc() {
        val label = prefs.pcName.ifBlank { prefs.host }
        tvPcName.text = label
        client.connect(prefs.host, prefs.port)
    }

    private fun jumpMonitorRelative(direction: String) {
        if (monitors.size <= 1) return
        var idx = monitors.indexOfFirst { it.id == currentMonitorId }
        if (idx == -1) idx = 0
        idx = if (direction == "next") {
            (idx + 1) % monitors.size
        } else {
            (idx - 1 + monitors.size) % monitors.size
        }
        val target = monitors[idx]
        currentMonitorId = target.id
        client.sendMonitorJump(target.id)
        haptics.monitorJump()
        renderMonitorChips()
    }

    private fun renderMonitorChips() {
        monitorChipsContainer.removeAllViews()
        if (monitors.size <= 1) {
            monitorBar.visibility = View.GONE
            return
        }
        monitorBar.visibility = View.VISIBLE
        val density = resources.displayMetrics.density
        for (m in monitors) {
            val btn = Button(this).apply {
                text = "${m.name} (${m.width}x${m.height})"
                textSize = 11f
                isAllCaps = false
                setPadding((10 * density).toInt(), (4 * density).toInt(), (10 * density).toInt(), (4 * density).toInt())
                minHeight = 0
                minimumHeight = (30 * density).toInt()
                setBackgroundResource(
                    if (m.id == currentMonitorId) R.drawable.bg_tab_active else R.drawable.bg_btn_dark
                )
                setTextColor(if (m.id == currentMonitorId) 0xFFFFFFFF.toInt() else 0xFFCBD5E1.toInt())
                setOnClickListener {
                    currentMonitorId = m.id
                    client.sendMonitorJump(m.id)
                    haptics.monitorJump()
                    renderMonitorChips()
                }
            }
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                marginEnd = (6 * density).toInt()
            }
            monitorChipsContainer.addView(btn, lp)
        }
    }

    // === Hardware Volume Keys ===
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (client.state == ConnectionState.CONNECTED) {
            if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                if (isMediaMode) client.sendPresentation("next") else client.sendMedia("vol_up")
                haptics.click()
                return true
            }
            if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                if (isMediaMode) client.sendPresentation("prev") else client.sendMedia("vol_down")
                haptics.click()
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    // === RemoteClient.Listener ===
    override fun onStateChanged(state: ConnectionState) {
        when (state) {
            ConnectionState.CONNECTED -> {
                statusDot.setBackgroundResource(R.drawable.dot_green)
                tvPcName.text = prefs.pcName.ifBlank { prefs.host }
            }

            ConnectionState.CONNECTING -> {
                statusDot.setBackgroundResource(R.drawable.dot_yellow)
                tvPing.text = "..."
                tvPing.setTextColor(0xFFFBBF24.toInt())
            }

            ConnectionState.DISCONNECTED -> {
                statusDot.setBackgroundResource(R.drawable.dot_red)
                tvPing.text = "Bağlı değil"
                tvPing.setTextColor(0xFFEF4444.toInt())
            }
        }
    }

    override fun onMonitorsUpdated(monitors: List<MonitorInfo>) {
        this.monitors = monitors
        renderMonitorChips()
    }

    override fun onActiveMonitorChanged(monitorId: Int, boundaryHit: Boolean) {
        if (boundaryHit) haptics.boundaryHit()
        if (monitorId != currentMonitorId) {
            currentMonitorId = monitorId
            renderMonitorChips()
        }
    }

    override fun onContextUpdated(context: String, processName: String, windowTitle: String) {
        val label = when {
            windowTitle.isNotBlank() && processName.isNotBlank() ->
                "${processName.uppercase()}: $windowTitle"
            processName.isNotBlank() -> processName.uppercase()
            else -> "Masaüstü"
        }
        tvActiveWindow.text = label
    }

    override fun onPingUpdated(rttMs: Long) {
        tvPing.text = "${rttMs}ms"
        tvPing.setTextColor(
            when {
                rttMs < 25 -> 0xFF10B981.toInt()
                rttMs < 70 -> 0xFFFBBF24.toInt()
                else -> 0xFFEF4444.toInt()
            }
        )
    }

    override fun onAuthRequired() {
        val savedPin = prefs.pin
        if (savedPin.isNotBlank()) {
            client.sendAuth(savedPin)
        } else {
            showPinDialog(null)
        }
    }

    override fun onAuthResult(success: Boolean, error: String?) {
        if (success) {
            Toast.makeText(this, "PIN doğrulandı", Toast.LENGTH_SHORT).show()
        } else {
            prefs.pin = ""
            showPinDialog(error ?: "Hatalı PIN!")
        }
    }

    override fun onAutoRediscoverSuggested() {
        if (autoRediscoverRunning) return
        autoRediscoverRunning = true
        uiScope.launch {
            val found = DiscoveryManager.discoverPcs(this@MainActivity, timeoutMs = 2000)
            autoRediscoverRunning = false
            if (found.isNotEmpty() && client.state != ConnectionState.CONNECTED) {
                val match = found.firstOrNull {
                    prefs.pcName.isNotBlank() && it.name.equals(prefs.pcName, ignoreCase = true)
                } ?: found.first()
                if (match.ip != prefs.host || match.httpPort != prefs.port) {
                    prefs.savePc(match.name, match.ip, match.httpPort)
                    Toast.makeText(
                        this@MainActivity,
                        "PC yeni IP'de bulundu: ${match.ip}",
                        Toast.LENGTH_SHORT
                    ).show()
                    connectToSavedPc()
                }
            }
        }
    }

    // === Dialogs ===
    private fun showConnectDialog(autoScan: Boolean) {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_connect, null)
        val tvScanStatus = dialogView.findViewById<TextView>(R.id.tvScanStatus)
        val discoveredList = dialogView.findViewById<LinearLayout>(R.id.discoveredList)
        val btnRescan = dialogView.findViewById<Button>(R.id.btnRescan)
        val etIp = dialogView.findViewById<EditText>(R.id.etManualIp)
        val etPort = dialogView.findViewById<EditText>(R.id.etManualPort)
        val btnConnectManual = dialogView.findViewById<Button>(R.id.btnConnectManual)

        etIp.setText(prefs.host)
        etPort.setText(prefs.port.toString())

        val dialog = AlertDialog.Builder(this, R.style.Theme_RemotePCPlus_Dialog)
            .setView(dialogView)
            .create()

        fun runScan() {
            tvScanStatus.text = "Ağdaki bilgisayarlar taranıyor..."
            discoveredList.removeAllViews()
            btnRescan.isEnabled = false
            uiScope.launch {
                val pcs = DiscoveryManager.discoverPcs(this@MainActivity)
                btnRescan.isEnabled = true
                if (pcs.isEmpty()) {
                    tvScanStatus.text =
                        "Otomatik PC bulunamadı. PC'de RemotePC+ açık mı? (Aşağıdan IP ile bağlanabilirsin)"
                } else {
                    tvScanStatus.text = "${pcs.size} bilgisayar bulundu — bağlanmak için dokun:"
                    val density = resources.displayMetrics.density
                    for (pc in pcs) {
                        val itemBtn = Button(this@MainActivity).apply {
                            text = "${pc.name}  (${pc.ip}:${pc.httpPort})"
                            isAllCaps = false
                            setBackgroundResource(R.drawable.bg_btn_accent)
                            setTextColor(0xFFFFFFFF.toInt())
                            setOnClickListener {
                                prefs.savePc(pc.name, pc.ip, pc.httpPort)
                                connectToSavedPc()
                                dialog.dismiss()
                            }
                        }
                        val lp = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        ).apply { bottomMargin = (8 * density).toInt() }
                        discoveredList.addView(itemBtn, lp)
                    }
                }
            }
        }

        btnRescan.setOnClickListener { runScan() }
        btnConnectManual.setOnClickListener {
            val ip = etIp.text.toString().trim()
            val port = etPort.text.toString().trim().toIntOrNull() ?: 5000
            if (ip.isBlank()) {
                etIp.error = "IP adresi girin"
                return@setOnClickListener
            }
            prefs.savePc(ip, ip, port)
            connectToSavedPc()
            dialog.dismiss()
        }

        dialog.show()
        if (autoScan) runScan()
    }

    private fun showKeyboardDialog() {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_keyboard, null)
        val etText = dialogView.findViewById<EditText>(R.id.etKeyboardInput)
        val btnSend = dialogView.findViewById<Button>(R.id.btnKbSend)
        val btnEnter = dialogView.findViewById<Button>(R.id.btnKbEnter)
        val btnBackspace = dialogView.findViewById<Button>(R.id.btnKbBackspace)

        fun sendCurrentText() {
            val text = etText.text.toString()
            if (text.isNotEmpty()) {
                client.sendType(text)
                etText.setText("")
                haptics.click()
            }
        }

        btnSend.setOnClickListener { sendCurrentText() }
        btnEnter.setOnClickListener {
            sendCurrentText()
            client.sendKey("enter")
            haptics.click()
        }
        btnBackspace.setOnClickListener {
            client.sendKey("backspace")
            haptics.click()
        }
        etText.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEND || actionId == EditorInfo.IME_ACTION_DONE) {
                sendCurrentText()
                true
            } else false
        }

        AlertDialog.Builder(this, R.style.Theme_RemotePCPlus_Dialog)
            .setView(dialogView)
            .setNegativeButton("Kapat", null)
            .show()
    }

    private fun showSettingsDialog() {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_settings, null)
        val tvSens = dialogView.findViewById<TextView>(R.id.tvSensValue)
        val seekSens = dialogView.findViewById<SeekBar>(R.id.seekSens)
        val chkNatural = dialogView.findViewById<CheckBox>(R.id.chkNaturalScroll)
        val chkDrag = dialogView.findViewById<CheckBox>(R.id.chkDoubleTapDrag)
        val chkHaptics = dialogView.findViewById<CheckBox>(R.id.chkHaptics)

        val progressInit = ((prefs.sensitivity - 0.6f) / 0.1f).toInt().coerceIn(0, 34)
        seekSens.max = 34
        seekSens.progress = progressInit
        tvSens.text = String.format("%.1fx", prefs.sensitivity)

        seekSens.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar?, p: Int, fromUser: Boolean) {
                val valFloat = 0.6f + p * 0.1f
                tvSens.text = String.format("%.1fx", valFloat)
                prefs.sensitivity = valFloat
                applyTouchpadPrefs()
            }

            override fun onStartTrackingTouch(sb: SeekBar?) {}
            override fun onStopTrackingTouch(sb: SeekBar?) {}
        })

        chkNatural.isChecked = prefs.naturalScroll
        chkNatural.setOnCheckedChangeListener { _, checked ->
            prefs.naturalScroll = checked
            applyTouchpadPrefs()
        }

        chkDrag.isChecked = prefs.doubleTapDrag
        chkDrag.setOnCheckedChangeListener { _, checked ->
            prefs.doubleTapDrag = checked
            applyTouchpadPrefs()
        }

        chkHaptics.isChecked = prefs.hapticsEnabled
        chkHaptics.setOnCheckedChangeListener { _, checked ->
            prefs.hapticsEnabled = checked
        }

        AlertDialog.Builder(this, R.style.Theme_RemotePCPlus_Dialog)
            .setView(dialogView)
            .setPositiveButton("Tamam", null)
            .show()
    }

    private fun showPinDialog(errorMessage: String?) {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
            hint = "4 haneli PIN"
            setTextColor(0xFFFFFFFF.toInt())
            setHintTextColor(0xFF64748B.toInt())
            setPadding(40, 30, 40, 30)
        }

        AlertDialog.Builder(this, R.style.Theme_RemotePCPlus_Dialog)
            .setTitle("PIN Doğrulaması")
            .setMessage(errorMessage ?: "Bilgisayara bağlanmak için PIN kodunu girin:")
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Doğrula") { _, _ ->
                val pin = input.text.toString().trim()
                if (pin.isNotEmpty()) {
                    prefs.pin = pin
                    client.sendAuth(pin)
                }
            }
            .setNegativeButton("İptal", null)
            .show()
    }
}
