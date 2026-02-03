const express = require('express')
const chokidar = require('chokidar')
const { WebSocketServer } = require('ws')
const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')
const { promisify } = require('util')
const os = require('os')

const execFileAsync = promisify(execFile)

const app = express()
const PORT = process.env.PORT || 3456
const WS_PORT = process.env.WS_PORT || 3457

// Get markdown file path from CLI args
const markdownFile = process.argv[2]

// Path to mmdc binary
const MMDC_PATH = path.join(__dirname, '..', 'node_modules', '.bin', 'mmdc')

// Serve built frontend
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))

app.use(express.json())

// --- Mermaid Rendering ---

let renderCounter = 0

async function render(mermaidText) {
  const id = renderCounter++
  const tmpDir = os.tmpdir()
  const inputFile = path.join(tmpDir, `mermaid-input-${id}.mmd`)
  const outputFile = path.join(tmpDir, `mermaid-output-${id}.svg`)

  try {
    // Write mermaid to temp file
    fs.writeFileSync(inputFile, mermaidText)

    // Run mmdc
    await execFileAsync(MMDC_PATH, [
      '-i', inputFile,
      '-o', outputFile,
      '-b', 'transparent'
    ])

    // Read SVG output
    const svg = fs.readFileSync(outputFile, 'utf-8')
    const base64 = Buffer.from(svg).toString('base64')
    const dataUrl = `data:image/svg+xml;base64,${base64}`

    return { base64, dataUrl, svg }
  } finally {
    // Cleanup temp files
    try { fs.unlinkSync(inputFile) } catch {}
    try { fs.unlinkSync(outputFile) } catch {}
  }
}

// --- Markdown Parsing ---

function extractMermaidBlocks(markdown) {
  const blocks = []
  // Match optional heading before mermaid block
  // Looks for: ## A: Label or ## CURRENT: Label or just ## Label
  const regex = /(?:^|\n)(#{1,3}\s+([^\n]+))?\n*```mermaid\n([\s\S]*?)```/g
  let match

  while ((match = regex.exec(markdown)) !== null) {
    const heading = match[2] ? match[2].trim() : null
    const mermaid = match[3].trim()

    // Extract label from heading (e.g., "A: Shape Name" -> "A")
    let label = null
    if (heading) {
      const labelMatch = heading.match(/^([A-Z]+|\d+|CURRENT)(?::|$)/)
      label = labelMatch ? labelMatch[1] : heading
    }

    blocks.push({
      label: label || `Diagram ${blocks.length + 1}`,
      mermaid
    })
  }

  return blocks
}

// --- HTTP Endpoints ---

app.get('/render', async (req, res) => {
  const mermaidText = req.query.mermaid

  if (!mermaidText) {
    return res.status(400).json({ error: 'Missing mermaid query parameter' })
  }

  try {
    const result = await render(mermaidText)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/render', async (req, res) => {
  const mermaidText = req.body.mermaid

  if (!mermaidText) {
    return res.status(400).json({ error: 'Missing mermaid in request body' })
  }

  try {
    const result = await render(mermaidText)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- WebSocket Server ---

const wss = new WebSocketServer({ port: WS_PORT })
const clients = new Set()

wss.on('connection', (ws) => {
  console.log('Client connected')
  clients.add(ws)

  ws.on('close', () => {
    console.log('Client disconnected')
    clients.delete(ws)
  })

  // Send current state on connect if we have a file
  if (markdownFile) {
    processFile().then(diagrams => {
      if (diagrams) {
        ws.send(JSON.stringify({ type: 'update', diagrams }))
      }
    })
  }
})

function broadcast(message) {
  const data = JSON.stringify(message)
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(data)
    }
  }
}

// --- File Processing ---

async function processFile() {
  if (!markdownFile) return null

  try {
    const content = fs.readFileSync(markdownFile, 'utf-8')
    const mermaidBlocks = extractMermaidBlocks(content)

    console.log(`Found ${mermaidBlocks.length} Mermaid block(s)`)

    const diagrams = []
    for (let i = 0; i < mermaidBlocks.length; i++) {
      const block = mermaidBlocks[i]
      try {
        const result = await render(block.mermaid)
        diagrams.push({
          index: i,
          label: block.label,
          dataUrl: result.dataUrl
        })
        console.log(`  [${i}] ${block.label}`)
      } catch (err) {
        console.error(`Error rendering block ${i} (${block.label}):`, err.message)
      }
    }

    return diagrams
  } catch (err) {
    console.error('Error reading file:', err.message)
    return null
  }
}

// --- File Watching ---

if (markdownFile) {
  const absolutePath = path.resolve(markdownFile)
  console.log(`Watching: ${absolutePath}`)

  const watcher = chokidar.watch(absolutePath, {
    persistent: true,
    ignoreInitial: false
  })

  watcher.on('change', async () => {
    console.log('File changed, re-rendering...')
    const diagrams = await processFile()
    if (diagrams) {
      broadcast({ type: 'update', diagrams })
    }
  })

  watcher.on('add', async () => {
    console.log('File detected, rendering...')
    const diagrams = await processFile()
    if (diagrams) {
      broadcast({ type: 'update', diagrams })
    }
  })
}

// --- SPA fallback ---

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

// --- Start Server ---

app.listen(PORT, () => {
  console.log(`HTTP server: http://localhost:${PORT}`)
  console.log(`WebSocket server: ws://localhost:${WS_PORT}`)
  if (markdownFile) {
    console.log(`Watching: ${markdownFile}`)
  } else {
    console.log('No file specified. Usage: node src/server.js <markdown-file>')
  }
})
