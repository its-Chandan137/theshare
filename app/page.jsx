'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import {
  SendHorizontal,
  Download,
  QrCode,
  Link,
  CheckCircle2,
  XCircle,
  Loader2,
  Phone,
  File,
  Smartphone,
  Laptop,
  Zap,
  Edit,
  Clock,
  ArrowLeft,
  Wifi,
  Shield,
  Trash2,
  AlertCircle,
  Check,
  Upload,
  Eye,
  EyeOff,
} from 'lucide-react'
import QRCode from 'qrcode'
import { cn } from './lib/utils'

export default function Home() {
  const [socket, setSocket] = useState(null)
  const socketRef = useRef(null)
  const [deviceId, setDeviceId] = useState('')
  const [deviceName, setDeviceName] = useState('My Device')
  const [connectedDevices, setConnectedDevices] = useState([])
  const [files, setFiles] = useState([])
  const [activeView, setActiveView] = useState('pair')
  const [dragging, setDragging] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [mounted, setMounted] = useState(false)
  const [showPairing, setShowPairing] = useState(false)
  const [pairingCode, setPairingCode] = useState('')
  const [qrData, setQrData] = useState('')
  const [qrImage, setQrImage] = useState('')
  const [notifications, setNotifications] = useState([])
  const [widgetOpen, setWidgetOpen] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const fileInputRef = useRef(null)
  const notifyTimerRef = useRef(null)

  const serverUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const clientHostname = typeof window !== 'undefined' ? window.location.hostname : ''

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const savedDeviceName = localStorage.getItem('theshare_device_name') || 'My Device'
    const savedId = localStorage.getItem('theshare_device_id')
    setDeviceName(savedDeviceName)
    setNameInput(savedDeviceName)
    setDeviceId(savedId || '')

    if (socketRef.current) return

    const newSocket = io(serverUrl, {
      transports: ['polling', 'websocket'],
      path: '/socket.io/',
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      forceNew: false,
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    newSocket.on('connect', () => {
      setIsConnected(true)
      setDeviceId(newSocket.id)
      localStorage.setItem('theshare_device_id', newSocket.id)
      newSocket.emit('register', { name: deviceName, id: newSocket.id })
    })

    newSocket.on('disconnect', () => {
      setIsConnected(false)
    })

    newSocket.on('paired', (data) => {
      setPairingCode(data.code)
      setResolvedIp(data.ip || window.location.hostname)
      const qrPayload = `http://${data.ip || window.location.hostname}:3000?pair=${data.code}`
      setQrData(qrPayload)
      setShowPairing(true)
      setActiveView('pair')
    })

    newSocket.on('device-connected', (device) => {
      if (device.id === newSocket.id) return
      setConnectedDevices((prev) => {
        if (prev.find((d) => d.id === device.id)) return prev
        return [...prev, device]
      })
      addNotification('device-connected', device)
      setWidgetOpen(true)
    })

    newSocket.on('device-disconnected', (id) => {
      const device = connectedDevices.find((d) => d.id === id)
      setConnectedDevices((prev) => prev.filter((d) => d.id !== id))
      addNotification('device-disconnected', device || { id, name: 'Unknown', type: 'device' })
      setWidgetOpen(true)
    })

    newSocket.on('file-ready', (file) => {
      const item = {
        id: file.fileId,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        direction: 'received',
        status: 'completed',
        progress: 100,
        url: file.url,
        createdAt: new Date(),
        senderId: file.senderId,
      }
      setFiles((prev) => [item, ...prev])
      addNotification('file-received', { ...file, name: file.name })
    })

    return () => {
      if (newSocket) {
        newSocket.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  // QR code generation
  useEffect(() => {
    if (!qrData) return
    QRCode.toDataURL(qrData, {
      width: 420,
      margin: 2,
      color: { dark: '#0284c7', light: '#ffffff' },
    })
      .then((dataUrl) => setQrImage(dataUrl))
      .catch((err) => {
        console.error('QR generation failed:', err)
        setQrImage('')
      })
  }, [qrData])

  const addNotification = useCallback((type, data) => {
    const id = Date.now()
    const notif = { id, type, data, timestamp: new Date() }
    setNotifications((prev) => [notif, ...prev])
    if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current)
    notifyTimerRef.current = setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, 5000)
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const handlePair = useCallback(() => {
    if (!socketRef.current) return
    socketRef.current.emit('pair-request')
    setShowPairing(true)
    setActiveView('pair')
  }, [])

  const handleDisconnectDevice = useCallback((id) => {
    if (!socketRef.current) return
    socketRef.current.disconnect()
    setConnectedDevices((prev) => prev.filter((d) => d.id !== id))
    setWidgetOpen(false)
  }, [])

  const handleFiles = useCallback(async (fileList) => {
    if (!fileList || !socketRef.current) return
    for (const file of Array.from(fileList)) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const item = {
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        direction: 'sent',
        status: 'uploading',
        progress: 0,
        createdAt: new Date(),
      }
      setFiles((prev) => [item, ...prev])

      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileId', id)
      formData.append('senderId', socketRef.current.id)

      try {
        const res = await fetch(`${serverUrl}/api/upload`, {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (data.success) {
          setFiles((prev) =>
            prev.map((f) => (f.id === id ? { ...f, status: 'completed', progress: 100, url: data.url } : f))
          )
        } else {
          setFiles((prev) =>
            prev.map((f) => (f.id === id ? { ...f, status: 'error' } : f))
          )
        }
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: 'error' } : f))
        )
      }
    }
  }, [serverUrl])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleDownload = useCallback((url) => {
    const a = document.createElement('a')
    a.href = url
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])

  const handleRemoveFile = useCallback((id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleSaveName = () => {
    if (nameInput.trim()) {
      localStorage.setItem('theshare_device_name', nameInput.trim())
      setDeviceName(nameInput.trim())
      setEditingName(false)
      if (socketRef.current) socketRef.current.emit('register', { name: nameInput.trim(), id: deviceId })
    }
  }

  const deviceTypeIcon = (type) => {
    if (type === 'phone') return <Smartphone className="w-4 h-4" />
    if (type === 'laptop') return <Laptop className="w-4 h-4" />
    return <Smartphone className="w-4 h-4" />
  }

  const deviceTypeColor = (type) => {
    if (type === 'phone') return 'text-brand-400 bg-brand-500/10 border-brand-500/20'
    if (type === 'laptop') return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
    return 'text-slate-400 bg-slate-500/10 border-slate-500/20'
  }

  const [resolvedIp, setResolvedIp] = useState('')

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-x-hidden selection:bg-brand-500 selection:text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-brand-600/20 rounded-full blur-[128px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] bg-indigo-600/20 rounded-full blur-[128px] mix-blend-screen" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom_right,#0ea5e908,#0f172a)] opacity-30 pointer-events-none" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-brand-500/30">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-xl tracking-tight text-white">TheShare</h1>
                <p className="text-xs text-slate-400 font-medium">Instant file transfer</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:block px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Connected
              </span>
              <button
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors backdrop-blur"
              >
                <Shield className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Connection Widget */}
      <div className="fixed bottom-6 right-6 z-50 w-full sm:w-[420px] max-w-[calc(100vw-3rem)] transform transition-all duration-300">
        <div
          className={cn(
            'absolute bottom-0 right-0 w-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-300',
            widgetOpen ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
          )}
        >
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-brand-400" />
              Connections
            </h3>
            <button
              onClick={() => setWidgetOpen(!widgetOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              {widgetOpen ? <XCircle className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </button>
          </div>
          <div className="p-5 max-h-[320px] overflow-y-auto">
            {connectedDevices.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-slate-500 mb-4">
                  <Smartphone className="w-7 h-7" />
                </div>
                <p className="text-sm text-slate-400">No devices connected</p>
                <button
                  onClick={handlePair}
                  className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium shadow-lg shadow-brand-500/25 transition-colors"
                >
                  <QrCode className="w-4 h-4" /> Pair Device
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {connectedDevices.map((d) => {
                  const typeColor = deviceTypeColor(d.type)
                  const Icon = deviceTypeIcon(d.type)
                  return (
                    <div key={d.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center">
                          <div className={typeColor}>{Icon}</div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{d.name}</p>
                          <p className="text-xs text-slate-400 capitalize">{d.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDisconnectDevice(d.id)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setWidgetOpen(false)}
                          className="p-1.5 rounded-lg text-brand-400 hover:bg-brand-500/10 hover:text-brand-300 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-24 px-4 sm:px-6 lg:px-8 pb-32 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="lg:flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center gap-1 px-2 py-1 rounded bg-brand-500/10 text-brand-400 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Local network
                </span>
                <span className="px-2 py-1 rounded bg-white/5 text-slate-400 text-xs font-medium">
                  No apps • No sign up
                </span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4">
                Transfer files<span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-500"> instantly</span>
              </h2>
              <p className="text-slate-200 text-lg mb-8 max-w-md leading-relaxed">
                Transfer files between laptop and phone over your local network. 
                End-to-end encrypted. No accounts. No cloud. Zero friction.
              </p>
              <p className="text-slate-400 text-sm mb-8 max-w-md">
                TheShare creates a direct peer-to-peer tunnel. Your data never leaves your network, 
                never touches a server, and is protected with AES-256 encryption.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-5 h-5 rounded bg-brand-500/20 flex items-center justify-center text-brand-400">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                  </div>
                  <span className="text-sm text-slate-200 font-medium">Fast</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-5 h-5 rounded bg-brand-500/20 flex items-center justify-center text-brand-400">
                    <Shield className="w-2.5 h-2.5" />
                  </div>
                  <span className="text-sm text-slate-200 font-medium">Secure</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-5 h-5 rounded bg-brand-500/20 flex items-center justify-center text-brand-400">
                    <Smartphone className="w-2.5 h-2.5" />
                  </div>
                  <span className="text-sm text-slate-200 font-medium">No app needed</span>
                </div>
              </div>
            </div>
            <div className="lg:flex-1 flex justify-center">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-indigo-600/20 rounded-3xl blur-3xl" />
                <div
                  className={cn(
                    'relative bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl p-8 shadow-2xl transition-all duration-500',
                    showPairing
                      ? 'filter-none backdrop-blur-xl opacity-100'
                      : 'blur-md backdrop-blur-sm opacity-80'
                  )}
                >
                  {/* Privacy Toggle - Hide/Show QR */}
                  <button
                    onClick={() => setShowPairing(!showPairing)}
                    className="absolute top-3 right-3 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    title={showPairing ? 'Hide QR (Privacy)' : 'Show QR'}
                  >
                    {showPairing ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>

                  <h3 className="text-sm font-semibold text-white mb-4">Pair your device</h3>
                  <p className="text-xs text-slate-400 mb-6">
                    Scan the QR code with your phone camera to open TheShare instantly.
                  </p>
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      {showPairing && qrImage ? (
                        <img
                          src={qrImage}
                          alt="QR Code"
                          className="w-48 h-48 rounded-2xl border border-white/20 shadow-xl bg-white/5 p-2 backdrop-blur"
                        />
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/5 backdrop-blur">
                          {showPairing ? (
                            <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
                          ) : (
                            <QrCode className="w-24 h-24 text-slate-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-6 flex flex-col items-center gap-2">
                    {mounted && (
                      <span className="text-xs font-mono text-brand-400 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                        {resolvedIp || clientHostname}
                      </span>
                    )}
                    <p className="text-[10px] text-slate-500">Your laptop's local IP</p>
                    <button
                      onClick={() => navigator.clipboard.writeText(`http://${resolvedIp || window.location.hostname}:3000?pair=${pairingCode}`)}
                      className="text-[10px] text-brand-400 hover:text-brand-300 transition-colors underline decoration-brand-500/30 decoration-underline"
                    >
                      Copy link
                    </button>
                  </div>
                </div>
                {/* Pair Device Overlay Button */}
                {!showPairing && (
                  <button
                    onClick={handlePair}
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white shadow-lg shadow-white/10 mb-2">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <span className="text-white font-semibold text-sm">Pair Device</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section — 2 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Unified File Activity — Grouped by Device */}
          <div className="lg:col-span-3 bg-white/5 rounded-3xl shadow-xl border border-white/10 backdrop-blur-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-500/20 to-indigo-500/20 flex items-center justify-center text-brand-400 shadow-lg shadow-brand-500/10">
                <File className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">File Activity</h3>
                <p className="text-[10px] text-slate-500">Grouped by source device</p>
              </div>
              <span className="ml-auto text-[10px] text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">{files.length} total</span>
            </div>

            {/* This device uploads */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-[0.05em]">This device — uploads</h4>
              </div>
              <div className="space-y-2">
                {files.filter((f) => f.direction === 'sent').map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/10 transition-all group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400 flex-shrink-0 shadow-inner shadow-brand-500/5">
                        <File className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate max-w-[140px] sm:max-w-[200px]">{f.name}</p>
                        <p className="text-[10px] text-slate-500">{formatSize(f.size)} {f.createdAt ? `• ${new Date(f.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : ''}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(f.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-500/15 to-rose-600/15 hover:from-rose-500/25 hover:to-rose-600/25 text-rose-300 text-[11px] font-bold transition-all border border-rose-500/20 hover:border-rose-400/40 shadow-sm hover:shadow-md hover:shadow-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                ))}
                {files.filter((f) => f.direction === 'sent').length === 0 && (
                  <p className="text-[11px] text-slate-600 py-2 pl-1">No uploads yet</p>
                )}
              </div>
            </div>

            {/* Received files grouped */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.6)]" />
                <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-[0.05em]">From connected devices</h4>
              </div>
              <div className="space-y-2">
                {files.filter((f) => f.direction === 'received').map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/10 transition-all group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 flex-shrink-0 shadow-inner shadow-indigo-500/5">
                        <Download className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate max-w-[140px] sm:max-w-[200px]">{f.name}</p>
                        <p className="text-[10px] text-slate-500">{formatSize(f.size)} {f.createdAt ? `• ${new Date(f.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : ''}</p>
                      </div>
                    </div>
                    {f.status === 'completed' && f.url ? (
                      <button
                        onClick={() => handleDownload(f.url)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-xs text-white font-bold transition-all shadow-lg shadow-brand-600/20 hover:shadow-brand-500/40 hover:-translate-y-[1px]"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">Ready</span>
                    )}
                  </div>
                ))}
                {files.filter((f) => f.direction === 'received').length === 0 && (
                  <p className="text-[11px] text-slate-600 py-2 pl-1">No files received yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Drop Zone Card */}
          <div className="lg:col-span-2 bg-white/5 rounded-3xl shadow-xl border border-white/10 backdrop-blur-xl p-6 flex flex-col items-center justify-center h-full min-h-[320px]">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-slate-400 mb-4">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Drop files here</h3>
            <p className="text-[11px] text-slate-300 mb-6">Drop any file or click to browse. Instant peer-to-peer delivery.</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
              onDrop={handleDrop}
              className={cn(
                'relative border-2 rounded-2xl p-6 text-center transition-all duration-300',
                dragging
                  ? 'border-brand-500 bg-brand-500/10'
                  : 'border-dashed border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <label className="cursor-pointer w-full h-full">
                {dragging ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400">
                      <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
                    </div>
                    <p className="text-xs font-medium text-brand-400">Receiving files&hellip;</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-xs font-medium text-white">Send to your paired device</p>
                  </div>
                )}
              </label>
            </div>
          </div>

        </div>
      </main>

      {/* Notifications */}
      <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 pointer-events-none w-full sm:w-auto max-w-[calc(100vw-2rem)]">
        {notifications.map((n) => {
          const typeColor = n.type === 'device-connected' ? 'text-brand-400 bg-brand-500/10 border-brand-500/20' : n.type === 'device-disconnected' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : n.type === 'device-limit' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
          const Icon = n.type === 'device-connected' ? CheckCircle2 : n.type === 'device-disconnected' ? AlertCircle : n.type === 'device-limit' ? Shield : Check
          return (
            <div
              key={n.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3 rounded-[1rem] border backdrop-blur-xl shadow-2xl animate-in slide-in-from-right-2 duration-300 w-full sm:max-w-xs',
                typeColor
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">
                  {n.type === 'device-connected' ? `${n.data.name} connected` : n.type === 'device-disconnected' ? `${n.data.name} disconnected` : n.type === 'device-limit' ? `Max devices reached` : `File received: ${n.data.name}`}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {n.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                onClick={() => dismissNotification(n.id)}
                className="ml-2 p-1 rounded text-slate-500 hover:text-white transition-colors"
              >
                <XCircle className="w-3 h-3" />
              </button>
            </div>
          )
        })}
      </div>

      <footer className="border-t border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <p className="text-xs sm:text-[10px] text-slate-400 text-center">
            TheShare &bull; Files transfer directly between devices on your local network
          </p>
        </div>
      </footer>
    </div>
  )
}
