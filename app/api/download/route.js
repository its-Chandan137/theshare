const fs = require('fs/promises')
const path = require('path')
const os = require('os')

const UPLOAD_DIR = path.join(os.tmpdir(), 'theshare-uploads')

export async function GET(req) {
  try {
    const url = new URL(req.url)
    const fileId = url.searchParams.get('fileId')
    const name = url.searchParams.get('name')

    if (!fileId) {
      return Response.json({ error: 'Missing fileId' }, { status: 400 })
    }

    const files = await fs.readdir(UPLOAD_DIR)
    const file = files.find((f) => f.startsWith(`${fileId}-`))

    if (!file) {
      return Response.json({ error: 'File not found' }, { status: 404 })
    }

    const filePath = path.join(UPLOAD_DIR, file)
    const buffer = await fs.readFile(filePath)

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${name || file}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Download failed' }, { status: 500 })
  }
}
