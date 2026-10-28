const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const next = require('next')
const path = require('path')
const fs = require('fs/promises')
const os = require('os')
const multer = require('multer')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

const UPLOAD_DIR = path.join(os.tmpdir(), 'theshare-uploads')
const fileStore = new Map()

// Detect network IP upfront before server starts
let networkIp = 'localhost'
try {
  const ifaces = os.networkInterfaces()
  for (const iface of Object.values(ifaces)) {
    if (!iface) continue
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        networkIp = addr.address
        break
      }
    }
    if (networkIp !== 'localhost') break
  }
} catch (e) {
  console.error('IP detection failed:', e)
}

app.prepare().then(async () => {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })

  const server = express()
  const httpServer = http.createServer(server)

  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  })

  const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 2 * 1024 * 1024 * 1024 } })

  server.use(express.json())

  server.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
      const fileId = req.body.fileId
      const senderId = req.body.senderId
      if (!fileId || !req.file) {
        return res.status(400).json({ error: 'Missing fileId or file' })
      }

      const originalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')
      const finalPath = path.join(UPLOAD_DIR, `${fileId}-${originalName}`)
      await fs.rename(req.file.path, finalPath)

      const stat = await fs.stat(finalPath)
      fileStore.set(fileId, {
        path: finalPath,
        name: originalName,
        size: stat.size,
        senderId,
        status: 'completed',
        progress: 100,
      })

      const fileUrl = `/api/download?fileId=${encodeURIComponent(fileId)}&name=${encodeURIComponent(originalName)}`

      io.emit('file-ready', { fileId, name: originalName, size: stat.size, url: fileUrl, senderId })

      res.json({ success: true, fileId, url: fileUrl, size: stat.size })
    } catch (err) {
      console.error('Upload error:', err)
      res.status(500).json({ error: 'Upload failed' })
    }
  })

  server.get('/api/download', async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`)
      const fileId = url.searchParams.get('fileId')
      const name = url.searchParams.get('name')
      if (!fileId) return res.status(400).json({ error: 'Missing fileId' })

      const meta = fileStore.get(fileId)
      let filePath
      if (meta) {
        filePath = meta.path
      } else {
        const files = await fs.readdir(UPLOAD_DIR)
        const found = files.find((f) => f.startsWith(`${fileId}-`))
        if (!found) return res.status(404).json({ error: 'File not found' })
        filePath = path.join(UPLOAD_DIR, found)
      }

      const buffer = await fs.readFile(filePath)
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${name || path.basename(filePath)}"`)
      res.setHeader('Content-Length', String(buffer.length))
      res.send(buffer)
    } catch (err) {
      console.error('Download error:', err)
      res.status(500).json({ error: 'Download failed' })
    }
  })

  // Next.js handles all non-API routes
  server.use((req, res) => {
    return handle(req, res)
  })

  io.on('connection', (socket) => {
    console.log('Device connected:', socket.id)

    socket.emit('network-ip', { ip: networkIp })

    socket.on('register', (data) => {
      socket.data.name = data.name || 'Unknown Device'
      socket.data.deviceId = data.id || socket.id
      socket.data.type = data.type || 'device'
      socket.join(socket.id)
      io.emit('device-connected', {
        id: socket.id,
        name: socket.data.name,
        type: socket.data.type,
        connectedAt: new Date(),
      })
    })

    socket.on('pair-request', (data) => {
      const code = Math.random().toString(36).slice(2, 6).toUpperCase()
      socket.data.pairCode = code
      socket.emit('paired', { code, partnerId: socket.id, ip: networkIp })
      setTimeout(() => { delete socket.data.pairCode }, 600000)
    })

    socket.on('join-pair', (data) => {
      const code = data.code
      let partnerId = null
      io.sockets.sockets.forEach((s) => {
        if (s.data.pairCode === code) partnerId = s.id
      })
      if (!partnerId) {
        socket.emit('pair-error', { message: 'Invalid or expired code' })
        return
      }
      socket.join(partnerId)
      socket.to(partnerId).emit('device-connected', {
        id: socket.id,
        name: socket.data.name || 'Phone',
        type: 'phone',
        connectedAt: new Date(),
      })
      socket.emit('device-connected', {
        id: partnerId,
        name: 'Laptop',
        type: 'laptop',
        connectedAt: new Date(),
      })
    })

    socket.on('disconnect', () => {
      console.log('Device disconnected:', socket.id)
      io.emit('device-disconnected', socket.id)
    })
  })

  setInterval(async () => {
    try {
      const now = Date.now()
      const files = await fs.readdir(UPLOAD_DIR)
      for (const f of files) {
        const stat = await fs.stat(path.join(UPLOAD_DIR, f))
        if (now - stat.mtimeMs > 3600000) {
          await fs.unlink(path.join(UPLOAD_DIR, f))
        }
      }
    } catch (e) { console.error('Cleanup error:', e) }
  }, 3600000)

  const PORT = process.env.PORT || 3000
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`> Ready on http://localhost:${PORT}`)
    console.log(`> Network: http://${networkIp}:${PORT}`)
  })
})
