package com.semih.remotepcplus

import android.content.Context
import android.net.wifi.WifiManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.InetAddress
import java.net.NetworkInterface
import java.net.SocketTimeoutException
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

data class DiscoveredPc(
    val name: String,
    val ip: String,
    val httpPort: Int
)

object DiscoveryManager {
    private const val DISCOVERY_PORT = 5055
    private const val DEFAULT_HTTP_PORT = 5000
    private const val DISCOVERY_MESSAGE = "DISCOVER_REMOTEPC"

    /**
     * Dual-Layer Ultra-Reliable LAN Discovery:
     * 1) UDP Broadcast (port 5055) — instant (<50ms) when router/firewall allows UDP
     * 2) Parallel Fast HTTP /api/ping Subnet Scan — finds PC in ~1.2s even if UDP is completely blocked
     */
    suspend fun discoverPcs(context: Context, port: Int = DEFAULT_HTTP_PORT): List<DiscoveredPc> =
        withContext(Dispatchers.IO) {
            val found = ConcurrentHashMap<String, DiscoveredPc>()

            coroutineScope {
                val udpJob = async { discoverViaUdp(context, found, timeoutMs = 1400) }
                val tcpJob = async { discoverViaHttpSubnetScan(found, port) }
                udpJob.await()
                tcpJob.await()
            }

            found.values.sortedBy { it.name.lowercase() }
        }

    private fun discoverViaUdp(
        context: Context,
        found: ConcurrentHashMap<String, DiscoveredPc>,
        timeoutMs: Int
    ) {
        val wifiManager =
            context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        val multicastLock = wifiManager?.createMulticastLock("RemotePcDiscovery")?.apply {
            setReferenceCounted(false)
            try {
                acquire()
            } catch (_: Exception) {
            }
        }

        var socket: DatagramSocket? = null
        try {
            socket = DatagramSocket().apply {
                broadcast = true
                soTimeout = 350
            }

            val payload = DISCOVERY_MESSAGE.toByteArray(Charsets.UTF_8)
            val targets = getBroadcastAddresses()

            fun sendProbe() {
                for (addr in targets) {
                    try {
                        socket.send(DatagramPacket(payload, payload.size, addr, DISCOVERY_PORT))
                    } catch (_: Exception) {
                    }
                }
            }

            val deadline = System.currentTimeMillis() + timeoutMs
            sendProbe()
            var secondSent = false
            val buf = ByteArray(1024)

            while (System.currentTimeMillis() < deadline) {
                if (!secondSent && (deadline - System.currentTimeMillis()) < timeoutMs / 2) {
                    sendProbe()
                    secondSent = true
                }
                try {
                    val response = DatagramPacket(buf, buf.size)
                    socket.receive(response)
                    val text = String(response.data, 0, response.length, Charsets.UTF_8).trim()
                    val json = JSONObject(text)
                    val ip = json.optString("ip", response.address.hostAddress ?: "")
                    val name = json.optString("name", "Windows PC")
                    val httpPort = json.optInt("httpPort", DEFAULT_HTTP_PORT)
                    if (ip.isNotBlank()) {
                        found[ip] = DiscoveredPc(name = name, ip = ip, httpPort = httpPort)
                    }
                } catch (_: SocketTimeoutException) {
                } catch (_: Exception) {
                }
            }
        } catch (_: Exception) {
        } finally {
            try {
                socket?.close()
            } catch (_: Exception) {
            }
            try {
                if (multicastLock?.isHeld == true) multicastLock.release()
            } catch (_: Exception) {
            }
        }
    }

    private suspend fun discoverViaHttpSubnetScan(
        found: ConcurrentHashMap<String, DiscoveredPc>,
        port: Int
    ) {
        val localIp = getDeviceLanIp() ?: return
        val parts = localIp.split(".")
        if (parts.size != 4) return
        val prefix = "${parts[0]}.${parts[1]}.${parts[2]}"
        val selfOctet = parts[3].toIntOrNull() ?: -1

        val semaphore = Semaphore(48)
        coroutineScope {
            (1..254).filter { it != selfOctet }.map { lastOctet ->
                async(Dispatchers.IO) {
                    semaphore.withPermit {
                        val candidateIp = "$prefix.$lastOctet"
                        if (found.containsKey(candidateIp)) return@withPermit
                        probeHttpPing(candidateIp, port)?.let { pc ->
                            found[pc.ip] = pc
                        }
                    }
                }
            }.awaitAll()
        }
    }

    private fun probeHttpPing(ip: String, port: Int): DiscoveredPc? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL("http://$ip:$port/api/ping").openConnection() as HttpURLConnection).apply {
                connectTimeout = 280
                readTimeout = 320
                requestMethod = "GET"
            }
            if (conn.responseCode == 200) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(body)
                if (json.optString("app") == "RemotePC+") {
                    DiscoveredPc(
                        name = json.optString("name", "Windows PC"),
                        ip = ip,
                        httpPort = json.optInt("httpPort", port)
                    )
                } else null
            } else null
        } catch (_: Exception) {
            null
        } finally {
            try {
                conn?.disconnect()
            } catch (_: Exception) {
            }
        }
    }

    private fun getDeviceLanIp(): String? {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces() ?: return null
            while (interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                if (iface.isLoopback || !iface.isUp) continue
                val addrs = iface.inetAddresses
                while (addrs.hasMoreElements()) {
                    val addr = addrs.nextElement()
                    if (addr is Inet4Address && !addr.isLoopbackAddress) {
                        val ip = addr.hostAddress ?: continue
                        if (ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
                            return ip
                        }
                    }
                }
            }
        } catch (_: Exception) {
        }
        return null
    }

    private fun getBroadcastAddresses(): List<InetAddress> {
        val list = linkedSetOf<InetAddress>()
        try {
            list.add(InetAddress.getByName("255.255.255.255"))
        } catch (_: Exception) {
        }
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces() ?: return list.toList()
            while (interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                if (iface.isLoopback || !iface.isUp) continue
                for (addr in iface.interfaceAddresses) {
                    addr.broadcast?.let { list.add(it) }
                }
            }
        } catch (_: Exception) {
        }
        return list.toList()
    }
}
