#!/usr/bin/env node

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

// Get markdown file from CLI args
const markdownFile = process.argv[2]

if (!markdownFile) {
  console.log('Usage: beam <markdown-file>')
  console.log('')
  console.log('Example:')
  console.log('  beam ./shaping-doc.md')
  console.log('  npx beam ./breadboard.md')
  process.exit(1)
}

// Resolve to absolute path
const absolutePath = path.resolve(markdownFile)

if (!fs.existsSync(absolutePath)) {
  console.error(`Error: File not found: ${absolutePath}`)
  process.exit(1)
}

// Path to server.js relative to this bin script
const serverPath = path.join(__dirname, '..', 'src', 'server.js')

// Start the server
const server = spawn('node', [serverPath, absolutePath], {
  stdio: 'inherit',
  env: { ...process.env }
})

// Open browser after a short delay
setTimeout(() => {
  const url = 'http://localhost:3456'
  const { platform } = process

  let cmd
  if (platform === 'darwin') {
    cmd = 'open'
  } else if (platform === 'win32') {
    cmd = 'start'
  } else {
    cmd = 'xdg-open'
  }

  spawn(cmd, [url], { stdio: 'ignore', detached: true }).unref()
  console.log(`\nOpened browser: ${url}`)
}, 1500)

// Handle exit
process.on('SIGINT', () => {
  server.kill('SIGINT')
  process.exit()
})

process.on('SIGTERM', () => {
  server.kill('SIGTERM')
  process.exit()
})
