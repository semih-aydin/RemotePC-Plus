package com.semih.remotepcplus

import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class MonitorInfo(
    val id: Int,
    val name: String,
    val width: Int,
    val height: Int,
    val isPrimary: Boolean
)

enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED
}

class RemoteClient(private val listener: Listener) {

    interface Listener {
        fun onStateChanged(state: ConnectionState)
        fun onMonitorsUpdated(monitors: List<MonitorInfo>)
        fun onActiveMonitorChanged(monitorId: Int, boundaryHit: Boolean)
        fun onContextUpdated(context: String, processName: String, windowTitle: String)
        fun onPingUpdated(rttMs: Long)
        fun onAuthRequired()
        fun onAuthResult(success: Boolean, error: String?)
        fun onAutoRediscoverSuggested()
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private val mainHandler = Handler(Looper.getMainLooper())
    private var webSocket: WebSocket? = null
    private var targetHost: String = ""
    private var targetPort: Int = 5000
    private var shouldReconnect = false
    private var failedAttempts = 0

    var state: ConnectionState = ConnectionState.DISCONNECTED
        private set

    private val pingRunnable = object : Runnable {
        override fun run() {
            if (state == ConnectionState.CONNECTED) {
                sendJson(JSONObject().put("type", "ping").put("t", System.currentTimeMillis()))
                mainHandler.postDelayed(this, 2000)
            }
        }
    }

    private val reconnectRunnable = Runnable {
        if (shouldReconnect && targetHost.isNotBlank()) {
            openSocket()
        }
    }

    fun connect(host: String, port: Int) {
        targetHost = host.trim()
        targetPort = port
        shouldReconnect = true
        failedAttempts = 0
        mainHandler.removeCallbacks(reconnectRunnable)
        openSocket()
    }

    fun disconnect() {
        shouldReconnect = false
        mainHandler.removeCallbacks(reconnectRunnable)
        mainHandler.removeCallbacks(pingRunnable)
        try {
            webSocket?.close(1000, "Client closed")
        } catch (_: Exception) {
        }
        webSocket = null
        updateState(ConnectionState.DISCONNECTED)
    }

    private fun openSocket() {
        try {
            webSocket?.cancel()
        } catch (_: Exception) {
        }
        updateState(ConnectionState.CONNECTING)

        val url = "ws://$targetHost:$targetPort"
        val request = Request.Builder().url(url).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                failedAttempts = 0
                updateState(ConnectionState.CONNECTED)
                mainHandler.removeCallbacks(pingRunnable)
                mainHandler.post(pingRunnable)
            }

            override fun onMessage(ws: WebSocket, text: String) {
                handleIncoming(text)
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                handleDisconnect()
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                handleDisconnect()
            }
        })
    }

    private fun handleDisconnect() {
        mainHandler.removeCallbacks(pingRunnable)
        updateState(ConnectionState.DISCONNECTED)
        if (!shouldReconnect) return

        failedAttempts++
        if (failedAttempts == 2) {
            mainHandler.post { listener.onAutoRediscoverSuggested() }
        }
        mainHandler.removeCallbacks(reconnectRunnable)
        mainHandler.postDelayed(reconnectRunnable, 2000)
    }

    private fun updateState(newState: ConnectionState) {
        state = newState
        mainHandler.post { listener.onStateChanged(newState) }
    }

    private fun handleIncoming(text: String) {
        try {
            val json = JSONObject(text)
            when (json.optString("type")) {
                "init" -> {
                    val monitors = parseMonitors(json.optJSONArray("monitors"))
                    val ctx = json.optString("context", "desktop")
                    val proc = json.optString("processName", "")
                    val title = json.optString("windowTitle", "")
                    val requiresAuth = json.optBoolean("requiresAuth", false)
                    mainHandler.post {
                        listener.onMonitorsUpdated(monitors)
                        listener.onContextUpdated(ctx, proc, title)
                        if (requiresAuth) listener.onAuthRequired()
                    }
                }

                "settings_updated" -> {
                    val monitors = parseMonitors(json.optJSONArray("monitors"))
                    mainHandler.post { listener.onMonitorsUpdated(monitors) }
                }

                "auth_required" -> {
                    mainHandler.post { listener.onAuthRequired() }
                }

                "auth_result" -> {
                    val ok = json.optBoolean("success", false)
                    val err = json.optString("error", "")
                    mainHandler.post { listener.onAuthResult(ok, err.ifBlank { null }) }
                }

                "move_ack" -> {
                    val boundary = json.optBoolean("boundaryHit", false)
                    val monId = json.optInt("monId", 1)
                    mainHandler.post { listener.onActiveMonitorChanged(monId, boundary) }
                }

                "context_update" -> {
                    val ctx = json.optString("context", "desktop")
                    val proc = json.optString("processName", "")
                    val title = json.optString("windowTitle", "")
                    mainHandler.post { listener.onContextUpdated(ctx, proc, title) }
                }

                "pong" -> {
                    val sentAt = json.optLong("t", 0L)
                    if (sentAt > 0L) {
                        val rtt = (System.currentTimeMillis() - sentAt).coerceAtLeast(0L)
                        mainHandler.post { listener.onPingUpdated(rtt) }
                    }
                }
            }
        } catch (_: Exception) {
        }
    }

    private fun parseMonitors(arr: JSONArray?): List<MonitorInfo> {
        if (arr == null) return emptyList()
        val list = mutableListOf<MonitorInfo>()
        for (i in 0 until arr.length()) {
            val m = arr.optJSONObject(i) ?: continue
            list.add(
                MonitorInfo(
                    id = m.optInt("id", i + 1),
                    name = m.optString("name", "Ekran ${i + 1}"),
                    width = m.optInt("width", 1920),
                    height = m.optInt("height", 1080),
                    isPrimary = m.optBoolean("isPrimary", i == 0)
                )
            )
        }
        return list
    }

    private fun sendJson(obj: JSONObject) {
        try {
            webSocket?.send(obj.toString())
        } catch (_: Exception) {
        }
    }

    fun sendAuth(pin: String) =
        sendJson(JSONObject().put("type", "auth").put("pin", pin))

    fun sendMove(dx: Float, dy: Float) =
        sendJson(
            JSONObject()
                .put("type", "move")
                .put("dx", dx.toDouble())
                .put("dy", dy.toDouble())
                .put("t", System.currentTimeMillis())
        )

    fun sendClick(button: String = "left", state: String = "click") =
        sendJson(JSONObject().put("type", "click").put("button", button).put("state", state))

    fun sendScroll(dy: Float, dx: Float = 0f) =
        sendJson(
            JSONObject()
                .put("type", "scroll")
                .put("dy", dy.toDouble())
                .put("dx", dx.toDouble())
        )

    fun sendZoom(delta: Int) =
        sendJson(JSONObject().put("type", "zoom").put("delta", delta))

    fun sendKey(key: String, state: String = "press") =
        sendJson(JSONObject().put("type", "key").put("key", key).put("state", state))

    fun sendType(text: String) =
        sendJson(JSONObject().put("type", "type").put("text", text))

    fun sendMacro(keys: List<String>) =
        sendJson(JSONObject().put("type", "macro").put("keys", JSONArray(keys)))

    fun sendMedia(action: String) =
        sendJson(JSONObject().put("type", "media").put("action", action))

    fun sendPresentation(action: String) =
        sendJson(JSONObject().put("type", "presentation").put("action", action))

    fun sendMonitorJump(monitorId: Int) =
        sendJson(JSONObject().put("type", "monitor_jump").put("monitorId", monitorId))
}
