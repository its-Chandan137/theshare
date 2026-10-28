'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import {
  QrCode,
  Link,
  ArrowLeft,
  Phone,
  Loader2,
  Clock,
  CheckCircle2,
  Zap,
  Smartphone,
} from 'lucide-react'
import QRCode from 'qrcode'
import { cn } from '../lib/utils'

export default function PairPage() {
  const [socket, setSocket] = useState(null)
  const socketRef = useRef(null)
  const [pairingCode, setPairingCode] = useState('')
  const [qrData, setQrData] = useState('')
  const [connectedDevices, setConnectedDevices] = useState([])
  const [mounted, setMounted] = useState(false)
  const [pairFromUrl, setPairFromUrl] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  const serverUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const pair = params.get('pair')
      if (pair) {
        setPairFromUrl(pair)
      }
    }
  }, [])

  useEffect(() => {
    const savedId = localStorage.getItem('theshare_device_id')
    const savedName = localStorage.getItem('theshare_device_name') || 'My Device'

    if (socketRef.current) return

    const newSocket = io(serverUrl, {
      transports: ['polling', 'websocket'],
      path: '/socket.io/',
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    newSocket.on('connect', () => {
      newSocket.emit('register', { name: savedName, id: newSocket.id })
      newSocket.emit('pair-request')
    })

    newSocket.on('paired', (data) => {
      setPairingCode(data.code)
      const qrPayload = `http://${data.ip}:3000?pair=${data.code}`
      setQrData(qrPayload)
    })

    newSocket.on('device-connected', (device) => {
      if (device.id === newSocket.id) return
      setConnectedDevices((prev) => {
        if (prev.find((d) => d.id === device.id)) return prev
        return [...prev, device]
      })
      setShowSuccess(true)
    })

    newSocket.on('device-disconnected', (id) => {
      setConnectedDevices((prev) => prev.filter((d) => d.id !== id))
    })

    newSocket.on('disconnect', () => {
      setConnectedDevices([])
    })

    return () => {
      if (newSocket) {
        newSocket.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (pairFromUrl && socketRef.current) {
      socketRef.current.emit('join-pair', { code: pairFromUrl })
    }
  }, [pairFromUrl])

  const [qrImage, setQrImage] = useState('')

  useEffect(() => {
    if (qrData) {
      QRCode.toDataURL(qrData, {
        width: 420,
        margin: 2,
        color: { dark: '#0284c7', light: '#ffffff' },
      })
        .then((dataUrl) => setQrImage(dataUrl))
        .catch(() => setQrImage(''))
    }
  }, [qrData])

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(`http://${window.location.hostname}:3000?pair=${pairingCode}`)
  }, [pairingCode])

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-x-hidden selection:bg-brand-500 selection:text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-brand-600/20 rounded-full blur-[128px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] bg-indigo-600/20 rounded-full blur-[128px] mix-blend-screen" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom_right,#0ea5e908,#0f172a)] opacity-20 pointer-events-none" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-2xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => { window.location.href = '/' }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors backdrop-blur"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-brand-500/30">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight text-white">TheShare</h1>
                <p className="text-xs text-slate-400 font-medium">Pair a device</p>
              </div>
            </div>
            <span className="hidden sm:block px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Same network
            </span>
          </div>
        </div>
      </header>

      <main className="pt-24 px-4 sm:px-6 lg:px-8 pb-24 max-w-3xl mx-auto">
        {mounted && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="bg-white/5 rounded-3xl shadow-2xl border border-white/10 backdrop-blur-xl overflow-hidden p-8 md:p-12">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400">
                  <Phone className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-semibold text-white">Pair your phone</h2>
              </div>

              <p className="text-slate-400 mb-10 text-sm leading-relaxed max-w-md">
                Scan the QR code with your phone camera or open the link directly. No app installation needed.
              </p>

              <div className="flex flex-col items-center gap-8">
                <div className="relative group">
                  {qrImage ? (
                    <img src={qrImage} alt="QR Code" className="w-72 h-72 rounded-2xl border border-white/20 shadow-2xl bg-white/10 p-2 backdrop-blur" />
                  ) : (
                    <div className="w-72 h-72 flex items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/5 backdrop-blur">
                      <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="text-center w-full">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Pairing Code</p>
                  <div className="flex justify-center">
                    <span className="font-mono text-2xl font-bold text-brand-400 bg-white/10 px-4 py-2 rounded-xl border border-white/10">
                      {pairingCode}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm text-brand-400 hover:text-brand-300 transition-colors"
                >
                  <Link className="w-4 h-4" /> Copy Link
                </button>

                <div className="w-full">
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" /> Connected Devices
                  </h3>
                  {connectedDevices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-6">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 mb-3">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <p className="text-sm text-slate-400">Waiting for a device to pair...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {connectedDevices.map((d) => (
                        <div key={d.id} className="flex items-center justify-between p-4 rounded-2xl bg-brand-500/10 border border-brand-500/20">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400">
                              <Smartphone className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{d.name}</p>
                              <p className="text-xs text-slate-400 capitalize">{d.type}</p>
                            </div>
                          </div>
                          <span className="text-xs text-slate-500">
                            {d.connectedAt ? new Date(d.connectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {showSuccess && (
              <div className="mt-6 flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <p className="text-sm text-emerald-300">Device connected successfully! You can now share files.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-xs text-slate-500 text-center">
            TheShare &bull; Files transfer directly between devices on your local network
          </p>
        </div>
      </footer>
    </div>
  )
}
