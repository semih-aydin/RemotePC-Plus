package com.semih.remotepcplus

import android.content.Context
import android.net.wifi.WifiManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.NetworkInterface
import java.net.SocketTimeoutException

data class DiscoveredPc(
    val name: String,
    val ip: String,
    val httpPort: Int
)

object DiscoveryManager {
    private const val DISCOVERY_PORT = 5055
    private const val DISCOVERY_MESSAGE = "DISCOVER_REMOTEPC"

    suspend fun discoverPcs(context: Context, timeoutMs: Int = 2200): List<DiscoveredPc> =
        withContext(Dispatchers.IO) {
            val found = linkedMapOf<String, DiscoveredPc>()
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
                    soTimeout = 450
                }

                val payload = DISCOVERY_MESSAGE.toByteArray(Charsets.UTF_8)
                val targets = getBroadcastAddresses()

                fun sendProbe() {
                    for (addr in targets) {
                        try {
                            val packet = DatagramPacket(payload, payload.size, addr, DISCOVERY_PORT)
                            socket.send(packet)
                        } catch (_: Exception) {
                        }
                    }
                }

                val deadline = System.currentTimeMillis() + timeoutMs
                sendProbe()
                var secondProbeSent = false

                val buf = ByteArray(1024)
                while (System.currentTimeMillis() < deadline) {
                    if (!secondProbeSent && (deadline - System.currentTimeMillis()) < timeoutMs / 2) {
                        sendProbe()
                        secondProbeSent = true
                    }

                    try {
                        val response = DatagramPacket(buf, buf.size)
                        socket.receive(response)
                        val text = String(response.data, 0, response.length, Charsets.UTF_8).trim()
                        val json = JSONObject(text)
                        val ip = json.optString("ip", response.address.hostAddress ?: "")
                        val name = json.optString("name", "Windows PC")
                        val port = json.optInt("httpPort", 5000)
                        if (ip.isNotBlank()) {
                            found[ip] = DiscoveredPc(name = name, ip = ip, httpPort = port)
                        }
                    } catch (_: SocketTimeoutException) {
                        // Continue waiting until deadline
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

            found.values.toList()
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
                    val broadcast = addr.broadcast ?: continue
                    list.add(broadcast)
                }
            }
        } catch (_: Exception) {
        }
        return list.toList()
    }
}
