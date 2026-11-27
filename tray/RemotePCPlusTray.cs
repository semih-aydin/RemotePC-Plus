using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace RemotePCPlusTray
{
    internal static class Program
    {
        private const string MutexName = "Global\\RemotePCPlusTray_SingleInstance_v1";

        [STAThread]
        private static void Main()
        {
            bool createdNew;
            using (var mutex = new Mutex(true, MutexName, out createdNew))
            {
                if (!createdNew)
                {
                    // Zaten calisiyorsa dogrudan Kontrol Merkezini ac
                    TrayApplicationContext.OpenControlCenter(5000);
                    return;
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new TrayApplicationContext());
            }
        }
    }

    internal sealed class TrayApplicationContext : ApplicationContext
    {
        private const string StartupRegKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string StartupAppName = "RemotePCPlus";

        private readonly NotifyIcon _trayIcon;
        private readonly ToolStripMenuItem _statusItem;
        private readonly ToolStripMenuItem _startupItem;
        private readonly string _projectDir;
        private readonly int _httpPort;
        private Process _nodeProcess;
        private Icon _generatedIcon;

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern bool DestroyIcon(IntPtr handle);

        private static readonly bool IsTurkish =
            CultureInfo.CurrentUICulture.TwoLetterISOLanguageName.Equals("tr", StringComparison.OrdinalIgnoreCase);

        private static string T(string en, string tr) { return IsTurkish ? tr : en; }

        public TrayApplicationContext()
        {
            _projectDir = ResolveProjectDir();
            _httpPort = ReadHttpPort(_projectDir);
            _generatedIcon = LoadAppIcon();

            _statusItem = new ToolStripMenuItem(T("RemotePC+ • Starting...", "RemotePC+ • Başlatılıyor..."))
            {
                Enabled = false
            };

            var openItem = new ToolStripMenuItem(T("Open Control Center", "Kontrol Merkezini Aç"), null, (s, e) => OpenControlCenter(_httpPort));
            openItem.Font = new Font(openItem.Font, FontStyle.Bold);

            var restartItem = new ToolStripMenuItem(T("Restart Server", "Sunucuyu Yeniden Başlat"), null, (s, e) => RestartServer());
            var firewallItem = new ToolStripMenuItem(T("Configure Firewall", "Güvenlik Duvarını Ayarla"), null, (s, e) => RunFirewallSetup());

            _startupItem = new ToolStripMenuItem(T("Start with Windows", "Windows ile Başlat"), null, (s, e) => ToggleStartup())
            {
                Checked = IsStartupEnabled()
            };

            var exitItem = new ToolStripMenuItem(T("Quit", "Çıkış"), null, (s, e) => ExitApp());

            var menu = new ContextMenuStrip();
            menu.Items.Add(_statusItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(openItem);
            menu.Items.Add(restartItem);
            menu.Items.Add(firewallItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(_startupItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(exitItem);

            _trayIcon = new NotifyIcon
            {
                Icon = _generatedIcon,
                Text = T("RemotePC+ • Wireless Control Hub", "RemotePC+ • Kablosuz Kontrol Merkezi"),
                ContextMenuStrip = menu,
                Visible = true
            };
            _trayIcon.DoubleClick += (s, e) => OpenControlCenter(_httpPort);

            Application.ApplicationExit += (s, e) => StopServer();

            StartServer();
        }

        private string ResolveProjectDir()
        {
            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            if (File.Exists(Path.Combine(exeDir, "server.js")))
                return exeDir;

            var parent = Directory.GetParent(exeDir.TrimEnd('\\'));
            if (parent != null && File.Exists(Path.Combine(parent.FullName, "server.js")))
                return parent.FullName;

            return exeDir;
        }

        private int ReadHttpPort(string dir)
        {
            try
            {
                string settingsPath = Path.Combine(dir, "settings.json");
                if (File.Exists(settingsPath))
                {
                    string json = File.ReadAllText(settingsPath);
                    var match = Regex.Match(json, "\"httpPort\"\\s*:\\s*(\\d+)");
                    if (match.Success)
                        return int.Parse(match.Groups[1].Value);
                }
            }
            catch { }
            return 5000;
        }

        private string GetLocalIp()
        {
            try
            {
                using (var socket = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, 0))
                {
                    socket.Connect("8.8.8.8", 65530);
                    var endPoint = socket.LocalEndPoint as IPEndPoint;
                    if (endPoint != null) return endPoint.Address.ToString();
                }
            }
            catch { }
            return "127.0.0.1";
        }

        private string ResolveNodeExecutable()
        {
            // Once tasinabilir (portable) runtime\node.exe var mi kontrol et
            string bundled = Path.Combine(_projectDir, "runtime", "node.exe");
            if (File.Exists(bundled))
                return bundled;

            return "node";
        }

        private void RunFirewallSetup()
        {
            string scriptPath = Path.Combine(_projectDir, "scripts", "firewall_setup.bat");
            if (!File.Exists(scriptPath))
            {
                MessageBox.Show("scripts\\firewall_setup.bat bulunamadı.", "RemotePC+", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = scriptPath,
                    Verb = "runas",
                    UseShellExecute = true
                });
            }
            catch { }
        }

        private void StartServer()
        {
            StopServer();
            string serverJs = Path.Combine(_projectDir, "server.js");
            if (!File.Exists(serverJs))
            {
                _statusItem.Text = "RemotePC+ • server.js bulunamadı";
                _trayIcon.ShowBalloonTip(3000, "RemotePC+", "server.js bulunamadı!", ToolTipIcon.Error);
                return;
            }

            try
            {
                string nodeExe = ResolveNodeExecutable();
                var psi = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = "server.js",
                    WorkingDirectory = _projectDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };

                _nodeProcess = Process.Start(psi);
                string ip = GetLocalIp();
                _statusItem.Text = string.Format(T("RemotePC+ • Running ({0}:{1})", "RemotePC+ • Aktif ({0}:{1})"), ip, _httpPort);
                _trayIcon.Text = string.Format("RemotePC+ ({0}:{1})", ip, _httpPort);
                _trayIcon.ShowBalloonTip(
                    2500,
                    T("RemotePC+ is Ready", "RemotePC+ Aktif"),
                    string.Format(
                        T("Ready for mobile connection ({0}:{1}). Double-click for Control Center.",
                          "Telefonunuzla bağlanabilirsiniz ({0}:{1}). Kontrol Merkezi için çift tıklayın."),
                        ip, _httpPort
                    ),
                    ToolTipIcon.None
                );
            }
            catch (Exception ex)
            {
                _statusItem.Text = T("RemotePC+ • Node.js not found", "RemotePC+ • Node.js bulunamadı");
                var res = MessageBox.Show(
                    T("Node.js was not found. Use the portable Windows ZIP from GitHub Releases or install Node.js.\n\nOpen nodejs.org?\n\nDetails: ",
                      "Node.js bulunamadı. GitHub Releases'teki taşınabilir Windows ZIP paketini kullanabilir veya Node.js kurabilirsiniz.\n\nnodejs.org açılsın mı?\n\nDetay: ") + ex.Message,
                    "RemotePC+",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning
                );
                if (res == DialogResult.Yes)
                {
                    try { Process.Start(new ProcessStartInfo { FileName = "https://nodejs.org", UseShellExecute = true }); } catch { }
                }
            }
        }

        private void StopServer()
        {
            try
            {
                if (_nodeProcess != null && !_nodeProcess.HasExited)
                {
                    _nodeProcess.Kill();
                    _nodeProcess.WaitForExit(1500);
                }
            }
            catch { }
            finally
            {
                if (_nodeProcess != null)
                {
                    _nodeProcess.Dispose();
                    _nodeProcess = null;
                }
            }
        }

        private void RestartServer()
        {
            _statusItem.Text = "RemotePC+ • Yeniden başlatılıyor...";
            StartServer();
        }

        public static void OpenControlCenter(int port)
        {
            string url = string.Format("http://localhost:{0}/admin", port);

            // Edge veya Chrome --app modu ile adres cubuksuz, sekmesiz temiz masaustu penceresi ac
            string[] candidates =
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe")
            };

            foreach (string browser in candidates)
            {
                if (File.Exists(browser))
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = browser,
                            Arguments = string.Format("--app={0} --window-size=1180,760", url),
                            UseShellExecute = false
                        });
                        return;
                    }
                    catch { }
                }
            }

            // Fallback: varsayilan tarayici
            try
            {
                Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
            }
            catch { }
        }

        private bool IsStartupEnabled()
        {
            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(StartupRegKey, false))
                {
                    return key != null && key.GetValue(StartupAppName) != null;
                }
            }
            catch { return false; }
        }

        private void ToggleStartup()
        {
            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(StartupRegKey, true))
                {
                    if (key == null) return;
                    if (IsStartupEnabled())
                    {
                        key.DeleteValue(StartupAppName, false);
                        _startupItem.Checked = false;
                    }
                    else
                    {
                        string exePath = Application.ExecutablePath;
                        key.SetValue(StartupAppName, "\"" + exePath + "\"");
                        _startupItem.Checked = true;
                    }
                }
            }
            catch { }
        }

        private void ExitApp()
        {
            StopServer();
            _trayIcon.Visible = false;
            _trayIcon.Dispose();
            if (_generatedIcon != null)
            {
                DestroyIcon(_generatedIcon.Handle);
                _generatedIcon.Dispose();
                _generatedIcon = null;
            }
            Application.Exit();
        }

        private Icon LoadAppIcon()
        {
            try
            {
                var assoc = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                if (assoc != null) return assoc;
            }
            catch { }
            return CreateAppleStyleTrayIcon();
        }

        // Fallback Apple-style minimalist tray icon (#1C1C1E + #0A84FF + white cursor)
        private Icon CreateAppleStyleTrayIcon()
        {
            using (var bmp = new Bitmap(32, 32))
            using (var g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.Clear(Color.Transparent);

                using (var bgBrush = new SolidBrush(Color.FromArgb(255, 28, 28, 30)))
                using (var accentBrush = new SolidBrush(Color.FromArgb(255, 10, 132, 255)))
                using (var cursorBrush = new SolidBrush(Color.White))
                {
                    g.FillEllipse(bgBrush, 1, 1, 30, 30);
                    g.FillEllipse(accentBrush, 4, 4, 24, 24);

                    PointF[] arrow =
                    {
                        new PointF(12f, 9f),
                        new PointF(22f, 17f),
                        new PointF(17.2f, 17.8f),
                        new PointF(19.2f, 22.8f),
                        new PointF(16.8f, 23.8f),
                        new PointF(14.8f, 18.8f),
                        new PointF(12f, 21.2f)
                    };
                    g.FillPolygon(cursorBrush, arrow);
                }

                IntPtr hIcon = bmp.GetHicon();
                return Icon.FromHandle(hIcon);
            }
        }
    }
}
