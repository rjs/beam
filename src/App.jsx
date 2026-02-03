import { useEffect, useRef } from 'react'
import { Tldraw, createShapeId, AssetRecordType } from 'tldraw'
import 'tldraw/tldraw.css'

const WS_URL = 'ws://localhost:3457'
const FRAME_PADDING = 20
const FRAME_GAP = 40

function getDiagramIds(index) {
  return {
    assetId: AssetRecordType.createId(`diagram-asset-${index}`),
    shapeId: createShapeId(`diagram-shape-${index}`),
    frameId: createShapeId(`diagram-frame-${index}`)
  }
}

async function getImageDimensions(dataUrl) {
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = dataUrl
  })
  return { width: img.width, height: img.height }
}

async function updateDiagrams(editor, diagrams) {
  // Track which IDs we're using this update
  const activeFrameIds = new Set()
  const activeShapeIds = new Set()
  const activeAssetIds = new Set()

  let yOffset = 100

  for (const diagram of diagrams) {
    const { assetId, shapeId, frameId } = getDiagramIds(diagram.index)
    activeFrameIds.add(frameId)
    activeShapeIds.add(shapeId)
    activeAssetIds.add(assetId)

    const { width, height } = await getImageDimensions(diagram.dataUrl)
    const frameWidth = width + FRAME_PADDING * 2
    const frameHeight = height + FRAME_PADDING * 2

    const existingFrame = editor.getShape(frameId)

    if (existingFrame) {
      // Update existing
      editor.updateAssets([{
        id: assetId,
        type: 'image',
        typeName: 'asset',
        props: {
          name: `diagram-${diagram.index}`,
          src: diagram.dataUrl,
          w: width,
          h: height,
          mimeType: 'image/svg+xml',
          isAnimated: false
        },
        meta: {}
      }])

      editor.updateShapes([
        {
          id: frameId,
          type: 'frame',
          y: yOffset,
          props: {
            w: frameWidth,
            h: frameHeight,
            name: diagram.label
          }
        },
        {
          id: shapeId,
          type: 'image',
          props: {
            w: width,
            h: height
          }
        }
      ])
    } else {
      // Create new frame
      editor.createShape({
        id: frameId,
        type: 'frame',
        x: 100,
        y: yOffset,
        props: {
          w: frameWidth,
          h: frameHeight,
          name: diagram.label
        }
      })

      // Create new asset
      editor.createAssets([{
        id: assetId,
        type: 'image',
        typeName: 'asset',
        props: {
          name: `diagram-${diagram.index}`,
          src: diagram.dataUrl,
          w: width,
          h: height,
          mimeType: 'image/svg+xml',
          isAnimated: false
        },
        meta: {}
      }])

      // Create image inside frame
      editor.createShape({
        id: shapeId,
        type: 'image',
        x: FRAME_PADDING,
        y: FRAME_PADDING,
        parentId: frameId,
        props: {
          assetId,
          w: width,
          h: height
        }
      })
    }

    yOffset += frameHeight + FRAME_GAP
  }

  // Remove old frames/shapes that are no longer in the diagrams
  const allShapes = editor.getCurrentPageShapes()
  const shapesToDelete = []

  for (const shape of allShapes) {
    if (shape.type === 'frame' && shape.id.startsWith('shape:diagram-frame-')) {
      if (!activeFrameIds.has(shape.id)) {
        shapesToDelete.push(shape.id)
      }
    }
    if (shape.type === 'image' && shape.id.startsWith('shape:diagram-shape-')) {
      if (!activeShapeIds.has(shape.id)) {
        shapesToDelete.push(shape.id)
      }
    }
  }

  if (shapesToDelete.length > 0) {
    editor.deleteShapes(shapesToDelete)
  }

  // Zoom to fit on first load
  if (diagrams.length > 0 && !editor.getShape(getDiagramIds(0).frameId)) {
    editor.zoomToFit()
  }
}

export default function App() {
  const editorRef = useRef(null)
  const initialLoadRef = useRef(true)

  const handleMount = (editor) => {
    editorRef.current = editor
  }

  useEffect(() => {
    let ws = null
    let reconnectTimeout = null

    function connect() {
      ws = new WebSocket(WS_URL)

      ws.onopen = () => {
        console.log('WebSocket connected')
      }

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data)

        if (message.type === 'update' && message.diagrams && editorRef.current) {
          console.log(`Received ${message.diagrams.length} diagram(s)`)

          await updateDiagrams(editorRef.current, message.diagrams)

          // Zoom to fit on initial load
          if (initialLoadRef.current && message.diagrams.length > 0) {
            editorRef.current.zoomToFit()
            initialLoadRef.current = false
          }
        }
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...')
        reconnectTimeout = setTimeout(connect, 2000)
      }

      ws.onerror = (err) => {
        console.error('WebSocket error:', err)
        ws.close()
      }
    }

    connect()

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (ws) ws.close()
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw onMount={handleMount} />
    </div>
  )
}
