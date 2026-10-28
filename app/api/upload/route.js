const fs = require('fs/promises')
const path = require('path')
const os = require('os')

const UPLOAD_DIR = path.join(os.tmpdir(), 'theshare-uploads')

export async function POST(req) {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    const formData = await req.formData()
    const file = formData.get('file')
    const fileId = formData.get('fileId')

    if (!file || !fileId) {
      return new Response(JSON.stringify({ error: 'Missing file or fileId' }), { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const safeName = String(file.name).replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = path.join(UPLOAD_DIR, `${fileId}-${safeName}`)
    await fs.writeFile(filePath, buffer)

    const fileUrl = `/api/download?fileId=${encodeURIComponent(fileId)}&name=${encodeURIComponent(safeName)}`

    return Response.json({ success: true, fileId, fileUrl, size: buffer.length })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }
}
