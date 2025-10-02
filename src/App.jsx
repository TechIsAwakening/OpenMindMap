import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const LEVEL_SPACING = 220
const MIN_NODE_WIDTH = 120
const MIN_NODE_HEIGHT = 40
const MAX_NODE_WIDTH = 420
const PLACEHOLDER_LABEL = 'Nommez cette idée'
const DEFAULT_NODE_COLOR = '#ffffff'
const COLOR_PRESETS = Object.freeze([
  '#ffffff',
  '#fee2e2',
  '#ffedd5',
  '#fef3c7',
  '#dcfce7',
  '#ccfbf1',
  '#e0f2fe',
  '#ede9fe',
])
const DEFAULT_NODE_SIZE = Object.freeze({ width: MIN_NODE_WIDTH, height: MIN_NODE_HEIGHT })

function normalizeNodeColor(color) {
  if (typeof color !== 'string') {
    return DEFAULT_NODE_COLOR
  }
  const trimmed = color.trim().toLowerCase()
  const shortHexMatch = trimmed.match(/^#([0-9a-f]{3})$/i)
  if (shortHexMatch) {
    const [r, g, b] = shortHexMatch[1]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  if (/^#([0-9a-f]{6})$/i.test(trimmed)) {
    return trimmed
  }
  return DEFAULT_NODE_COLOR
}

function hexToRgb(color) {
  const normalized = normalizeNodeColor(color)
  const hex = normalized.slice(1)
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  return { r, g, b }
}

const INITIAL_NODES = [
  { id: 'root', label: 'Open Mind Map', parentId: null, externalLink: '', color: DEFAULT_NODE_COLOR },
  { id: 'node-1', label: 'Idée clé #1', parentId: 'root', externalLink: '', color: DEFAULT_NODE_COLOR },
  { id: 'node-2', label: 'Idée clé #2', parentId: 'root', externalLink: '', color: DEFAULT_NODE_COLOR },
]

const nextIdFromInitial =
  INITIAL_NODES.reduce((acc, node) => {
    const match = node.id.match(/node-(\d+)/)
    if (!match) return acc
    return Math.max(acc, Number.parseInt(match[1], 10))
  }, 0) + 1

function getNextIdFromNodes(nodes) {
  return (
    nodes.reduce((acc, node) => {
      if (typeof node.id !== 'string') return acc
      const match = node.id.match(/node-(\d+)/)
      if (!match) return acc
      return Math.max(acc, Number.parseInt(match[1], 10))
    }, 0) + 1
  )
}

function getDefaultFilename(label, extension = 'json') {
  const fallback = 'mindmap'
  if (!label || typeof label !== 'string') {
    return `${fallback}.${extension}`
  }
  const trimmed = label.trim()
  if (trimmed.length === 0) {
    return `${fallback}.${extension}`
  }
  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  const safeName = normalized.length > 0 ? normalized : fallback
  return `${safeName}.${extension}`
}

function computeLayout(nodes) {
  const rootNode = nodes.find((node) => node.parentId === null)
  if (!rootNode) return {}

  const childrenMap = new Map()
  nodes.forEach((node) => {
    if (node.parentId === null) return
    if (!childrenMap.has(node.parentId)) {
      childrenMap.set(node.parentId, [])
    }
    childrenMap.get(node.parentId)?.push(node)
  })

  const positions = {
    [rootNode.id]: {
      x: 0,
      y: 0,
      depth: 0,
      angleStart: 0,
      angleEnd: Math.PI * 2,
    },
  }

  const traverse = (nodeId, startAngle, endAngle, depth) => {
    const children = childrenMap.get(nodeId) ?? []
    const total = children.length
    if (total === 0) return

    children.forEach((child, index) => {
      const childStart = startAngle + ((endAngle - startAngle) * index) / total
      const childEnd = startAngle + ((endAngle - startAngle) * (index + 1)) / total
      const angle = (childStart + childEnd) / 2
      const radius = depth * LEVEL_SPACING

      positions[child.id] = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        depth,
        angleStart: childStart,
        angleEnd: childEnd,
      }

      traverse(child.id, childStart, childEnd, depth + 1)
    })
  }

  traverse(rootNode.id, 0, Math.PI * 2, 1)
  return positions
}

function getBranchToDelete(nodes, selectedId) {
  const toDelete = new Set([selectedId])
  const stack = [selectedId]

  while (stack.length > 0) {
    const current = stack.pop()
    nodes
      .filter((node) => node.parentId === current)
      .forEach((child) => {
        if (!toDelete.has(child.id)) {
          toDelete.add(child.id)
          stack.push(child.id)
        }
      })
  }

  return toDelete
}

function IconPlus() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4.5 6.5h11M8.5 3.5h3m-4 3v9m5-9v9m-8 0h11a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4 13.5 5.5 16l2.5-.5L15 8.5 12.5 6 4 13.5zm9.5-9 2.5 2.5m-7.32 7.57h7.82"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function App() {
  const [nodes, setNodes] = useState(INITIAL_NODES)
  const [selectedId, setSelectedId] = useState('root')
  const [draftLabel, setDraftLabel] = useState(INITIAL_NODES[0].label)
  const [customPositions, setCustomPositions] = useState({})
  const [draggingNodeId, setDraggingNodeId] = useState(null)
  const [nodeSizes, setNodeSizes] = useState({})
  const idCounter = useRef(nextIdFromInitial)
  const svgRef = useRef(null)
  const panStateRef = useRef({
    isPanning: false,
    pointerId: null,
    last: { x: 0, y: 0 },
    moved: false,
  })

  const [viewTransform, setViewTransform] = useState({
    x: 0,
    y: 0,
    scale: 1,
  })

  const [isPanning, setIsPanning] = useState(false)

  const dragStateRef = useRef(null)
  const measurementRef = useRef(null)
  const fileInputRef = useRef(null)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const configIframeRef = useRef(null)

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return

    if (!measurementRef.current) {
      const container = document.createElement('div')
      container.style.position = 'absolute'
      container.style.visibility = 'hidden'
      container.style.pointerEvents = 'none'
      container.style.top = '-9999px'
      container.style.left = '-9999px'
      container.style.padding = '18px 20px'
      container.style.border = '3px solid transparent'
      container.style.borderRadius = '24px'
      container.style.fontWeight = '600'
      container.style.fontSize = '1.05rem'
      container.style.lineHeight = '1.3'
      container.style.fontFamily = "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      container.style.display = 'flex'
      container.style.alignItems = 'center'
      container.style.justifyContent = 'center'
      container.style.boxSizing = 'border-box'
      container.style.whiteSpace = 'pre-wrap'
      container.style.wordBreak = 'break-word'
      container.style.textAlign = 'center'
      container.style.maxWidth = `${MAX_NODE_WIDTH}px`

      const labelEl = document.createElement('span')
      labelEl.style.display = 'inline-block'
      labelEl.style.padding = '0 4px'
      labelEl.style.whiteSpace = 'pre-wrap'
      labelEl.style.wordBreak = 'break-word'
      container.appendChild(labelEl)

      document.body.appendChild(container)
      measurementRef.current = { container, labelEl }
    }

    const { container, labelEl } = measurementRef.current
    const nextSizes = {}

    nodes.forEach((node) => {
      const trimmed = node.label.trim()
      const text = trimmed.length > 0 ? node.label : ''
      labelEl.textContent = text.length > 0 ? text : '\u00a0'
      container.style.width = 'auto'
      const measuredWidth = container.offsetWidth
      const clampedWidth = Math.min(Math.max(measuredWidth, MIN_NODE_WIDTH), MAX_NODE_WIDTH)
      container.style.width = `${clampedWidth}px`
      const measuredHeight = container.offsetHeight
      const clampedHeight = Math.max(measuredHeight, MIN_NODE_HEIGHT)
      nextSizes[node.id] = { width: clampedWidth, height: clampedHeight }
    })

    setNodeSizes((prev) => {
      const prevKeys = Object.keys(prev)
      const nextKeys = Object.keys(nextSizes)
      if (prevKeys.length !== nextKeys.length) {
        return nextSizes
      }
      for (const key of nextKeys) {
        const prevSize = prev[key]
        const nextSize = nextSizes[key]
        if (!prevSize || prevSize.width !== nextSize.width || prevSize.height !== nextSize.height) {
          return nextSizes
        }
      }
      return prev
    })
  }, [nodes])

  useEffect(() => {
    return () => {
      if (measurementRef.current) {
        measurementRef.current.container.remove()
        measurementRef.current = null
      }
    }
  }, [])


  const rootNode = useMemo(
    () => nodes.find((node) => node.parentId === null) ?? null,
    [nodes],
  )

  useEffect(() => {
    if (!rootNode) return
    if (!nodes.some((node) => node.id === selectedId)) {
      setSelectedId(rootNode.id)
    }
  }, [nodes, rootNode, selectedId])

  const layoutPositions = useMemo(() => computeLayout(nodes), [nodes])
  const positions = useMemo(() => {
    const merged = {}
    nodes.forEach((node) => {
      const layout = layoutPositions[node.id]
      const custom = customPositions[node.id]
      if (layout && custom) {
        merged[node.id] = { ...layout, ...custom }
      } else if (layout) {
        merged[node.id] = layout
      } else if (custom) {
        merged[node.id] = custom
      }
    })
    return merged
  }, [customPositions, layoutPositions, nodes])
  const selectedNode = useMemo(() => {
    const node = nodes.find((item) => item.id === selectedId)
    return node ?? rootNode
  }, [nodes, selectedId, rootNode])

  const [draftExternalLink, setDraftExternalLink] = useState('')
  const [draftColor, setDraftColor] = useState(DEFAULT_NODE_COLOR)
  const [configInitialColor, setConfigInitialColor] = useState(DEFAULT_NODE_COLOR)

  useEffect(() => {
    if (selectedNode) {
      setDraftLabel(selectedNode.label ?? '')
      setDraftExternalLink(selectedNode.externalLink ?? '')
      const normalizedColor = normalizeNodeColor(selectedNode.color ?? DEFAULT_NODE_COLOR)
      setDraftColor(normalizedColor)
      setConfigInitialColor(normalizedColor)
    } else {
      setDraftLabel('')
      setDraftExternalLink('')
      setDraftColor(DEFAULT_NODE_COLOR)
      setConfigInitialColor(DEFAULT_NODE_COLOR)
    }
  }, [selectedNode])

  const applyNodeConfig = useCallback(
    ({ label, externalLink, color }) => {
      if (!selectedNode) return
      setNodes((prev) =>
        prev.map((node) => {
          if (node.id !== selectedNode.id) {
            return node
          }
          const nextLabel = typeof label === 'string' ? label : node.label
          const nextLink = typeof externalLink === 'string' ? externalLink.trim() : node.externalLink ?? ''
          const nextColor = normalizeNodeColor(color ?? node.color ?? DEFAULT_NODE_COLOR)
          return {
            ...node,
            label: nextLabel,
            externalLink: nextLink,
            color: nextColor,
          }
        }),
      )
    },
    [selectedNode],
  )

  const addChild = useCallback(() => {
    if (!selectedNode) return

    const newNode = {
      id: `node-${idCounter.current}`,
      label: '',
      parentId: selectedNode.id,
      externalLink: '',
      color: DEFAULT_NODE_COLOR,
    }

    idCounter.current += 1
    setNodes((prev) => [...prev, newNode])
    setSelectedId(newNode.id)
    setDraftLabel('')
  }, [selectedNode])

  const removeSelectedBranch = useCallback(() => {
    if (!selectedNode || selectedNode.id === rootNode?.id) return

    const toDelete = getBranchToDelete(nodes, selectedNode.id)
    setNodes((prev) => prev.filter((node) => !toDelete.has(node.id)))
    setCustomPositions((prev) => {
      const next = { ...prev }
      let changed = false
      toDelete.forEach((id) => {
        if (id in next) {
          delete next[id]
          changed = true
        }
      })
      return changed ? next : prev
    })
    if (rootNode) {
      setSelectedId(rootNode.id)
    }
  }, [nodes, rootNode, selectedNode])

  const openConfigPanel = useCallback(() => {
    if (!selectedNode) return
    const normalizedColor = normalizeNodeColor(selectedNode.color ?? DEFAULT_NODE_COLOR)
    setDraftLabel(selectedNode.label)
    setDraftExternalLink(selectedNode.externalLink ?? '')
    setDraftColor(normalizedColor)
    setConfigInitialColor(normalizedColor)
    setIsConfigOpen(true)
  }, [selectedNode])

  const closeConfigPanel = useCallback(() => {
    setIsConfigOpen(false)
  }, [])

  useEffect(() => {
    if (!isConfigOpen) return

    const handleMessage = (event) => {
      const iframeWindow = configIframeRef.current?.contentWindow
      if (!iframeWindow || event.source !== iframeWindow) return

      const data = event.data
      if (!data || data.source !== 'openmindmap-config') return

      if (data.type === 'config-save') {
        const label = typeof data.payload?.label === 'string' ? data.payload.label : ''
        const externalLink = typeof data.payload?.externalLink === 'string' ? data.payload.externalLink : ''
        const color = typeof data.payload?.color === 'string' ? data.payload.color : DEFAULT_NODE_COLOR
        const normalizedColor = normalizeNodeColor(color)
        setDraftLabel(label)
        setDraftExternalLink(externalLink)
        setDraftColor(normalizedColor)
        setConfigInitialColor(normalizedColor)
        applyNodeConfig({ label, externalLink, color: normalizedColor })
        closeConfigPanel()
      }

      if (data.type === 'config-color-change') {
        const color = typeof data.payload?.color === 'string' ? data.payload.color : DEFAULT_NODE_COLOR
        const normalizedColor = normalizeNodeColor(color)
        setDraftColor(normalizedColor)
      }

      if (data.type === 'config-cancel') {
        if (selectedNode) {
          const normalizedColor = normalizeNodeColor(selectedNode.color ?? DEFAULT_NODE_COLOR)
          setDraftColor(normalizedColor)
          setConfigInitialColor(normalizedColor)
        }
        closeConfigPanel()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [applyNodeConfig, closeConfigPanel, isConfigOpen, selectedNode])

  const configIframeContent = useMemo(() => {
    const initialData = {
      label: draftLabel ?? '',
      externalLink: draftExternalLink ?? '',
      color: configInitialColor,
    }

    const colorOptionsMarkup = COLOR_PRESETS.map(
      (color) =>
        `<button type="button" class="color-swatch" data-color-value="${color}" style="--swatch-color: ${color}" aria-label="Choisir la couleur ${color}" aria-pressed="false"></button>`,
    ).join('')

    return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Configuration du nœud</title>
    <style>
      :root {
        color-scheme: light;
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 0;
        background: transparent;
        color: #0f172a;
      }
      .config-root {
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 26px 28px;
        min-height: 100%;
        background: #ffffff;
        border-radius: 28px;
        box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18);
      }
      .config-header h1 {
        font-size: 1.2rem;
        margin: 0 0 4px 0;
      }
      .config-header p {
        margin: 0;
        color: rgba(15, 23, 42, 0.6);
        font-size: 0.9rem;
      }
      .field-group {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .field-group label,
      .field-label {
        font-weight: 600;
        font-size: 0.95rem;
        color: rgba(15, 23, 42, 0.85);
      }
      textarea,
      input[type='url'] {
        width: 100%;
        border-radius: 18px;
        border: 1px solid rgba(148, 163, 184, 0.4);
        padding: 14px 16px;
        font: inherit;
        color: inherit;
        background: rgba(241, 245, 249, 0.6);
        box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.08);
        transition: background 0.2s ease, border 0.2s ease;
      }
      textarea {
        min-height: 180px;
        resize: vertical;
      }
      textarea:focus,
      input[type='url']:focus {
        outline: 3px solid rgba(59, 130, 246, 0.35);
        background: #ffffff;
      }
      .config-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }
      button {
        border: none;
        border-radius: 999px;
        padding: 10px 20px;
        font-weight: 600;
        font-size: 0.95rem;
        cursor: pointer;
        color: #ffffff;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      #cancel {
        background: #ef4444;
        box-shadow: 0 12px 24px rgba(239, 68, 68, 0.25);
      }
      #cancel:hover {
        transform: translateY(-1px);
        box-shadow: 0 16px 30px rgba(239, 68, 68, 0.3);
      }
      #save {
        background: #22c55e;
        box-shadow: 0 12px 24px rgba(34, 197, 94, 0.25);
      }
      #save:hover {
        transform: translateY(-1px);
        box-shadow: 0 16px 30px rgba(34, 197, 94, 0.3);
      }
      .color-picker {
        position: relative;
        display: inline-flex;
        align-items: center;
      }
      .color-button {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.4);
        padding: 10px 16px;
        background: rgba(148, 163, 184, 0.15);
        color: rgba(15, 23, 42, 0.85);
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background 0.2s ease, border 0.2s ease, transform 0.15s ease;
      }
      .color-button:hover,
      .color-picker.is-open .color-button {
        background: rgba(148, 163, 184, 0.25);
        border-color: rgba(148, 163, 184, 0.55);
      }
      .color-preview {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid rgba(15, 23, 42, 0.15);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6);
      }
      .color-grid {
        position: absolute;
        top: calc(100% + 10px);
        left: 0;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        padding: 14px;
        border-radius: 18px;
        background: #ffffff;
        box-shadow: 0 18px 35px rgba(15, 23, 42, 0.18);
        border: 1px solid rgba(148, 163, 184, 0.2);
        opacity: 0;
        pointer-events: none;
        transform: translateY(6px);
        transition: opacity 0.15s ease, transform 0.15s ease;
        z-index: 10;
      }
      .color-picker.is-open .color-grid {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }
      .color-swatch {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 2px solid transparent;
        background: var(--swatch-color);
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease, border 0.15s ease;
      }
      .color-swatch:hover {
        transform: translateY(-1px) scale(1.05);
        box-shadow: 0 10px 18px rgba(15, 23, 42, 0.18);
      }
      .color-swatch.is-active {
        border-color: rgba(15, 23, 42, 0.65);
        box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.15);
      }
      .color-swatch:focus-visible {
        outline: 3px solid rgba(59, 130, 246, 0.35);
        outline-offset: 2px;
      }
    </style>
  </head>
  <body>
    <div class="config-root">
      <div class="config-header">
        <h1>Configuration du nœud</h1>
        <p>Modifiez le contenu du nœud et personnalisez-le visuellement.</p>
      </div>
      <div class="field-group">
        <label for="node-label">Contenu du nœud</label>
        <textarea id="node-label" placeholder="${PLACEHOLDER_LABEL}"></textarea>
      </div>
      <div class="field-group">
        <label for="node-link">Lien externe</label>
        <input type="url" id="node-link" placeholder="https://exemple.com" />
      </div>
      <div class="field-group">
        <span class="field-label">Couleur</span>
        <div class="color-picker" id="color-picker">
          <button type="button" class="color-button" id="color-button" aria-haspopup="true" aria-expanded="false" aria-controls="color-palette">
            <span class="color-preview" id="color-preview" aria-hidden="true"></span>
            <span>Couleur</span>
          </button>
          <div class="color-grid" id="color-palette" role="listbox">
            ${colorOptionsMarkup}
          </div>
        </div>
      </div>
      <div class="config-actions">
        <button type="button" id="cancel">Annuler</button>
        <button type="button" id="save">Sauvegarder</button>
      </div>
    </div>
    <script>
      ;(function () {
        const DEFAULT_COLOR = '${DEFAULT_NODE_COLOR}'
        const initialData = ${JSON.stringify(initialData)}
        const textarea = document.getElementById('node-label')
        const linkInput = document.getElementById('node-link')
        const colorPicker = document.getElementById('color-picker')
        const colorButton = document.getElementById('color-button')
        const colorPalette = document.getElementById('color-palette')
        const colorPreview = document.getElementById('color-preview')
        const colorOptions = Array.from(colorPalette.querySelectorAll('[data-color-value]'))
        const send = (type, payload) => {
          parent.postMessage({ source: 'openmindmap-config', type, payload }, '*')
        }

        const normalizeHex = (value) => {
          if (typeof value !== 'string') return DEFAULT_COLOR
          const trimmed = value.trim().toLowerCase()
          const shortMatch = trimmed.match(/^#([0-9a-f]{3})$/)
          if (shortMatch) {
            const [r, g, b] = shortMatch[1]
            return '#' + r + r + g + g + b + b
          }
          if (/^#[0-9a-f]{6}$/.test(trimmed)) {
            return trimmed
          }
          return DEFAULT_COLOR
        }

        const setActiveColor = (nextColor, notify = true) => {
          const normalized = normalizeHex(nextColor)
          currentColor = normalized
          colorPreview.style.background = normalized
          colorOptions.forEach((option) => {
            const optionColor = normalizeHex(option.getAttribute('data-color-value') || '')
            const isActive = optionColor === normalized
            option.classList.toggle('is-active', isActive)
            option.setAttribute('aria-pressed', isActive ? 'true' : 'false')
          })
          if (notify) {
            send('config-color-change', { color: normalized })
          }
        }

        const closePalette = () => {
          colorPicker.classList.remove('is-open')
          colorButton.setAttribute('aria-expanded', 'false')
        }

        textarea.value = initialData.label || ''
        if (linkInput) {
          linkInput.value = initialData.externalLink || ''
        }

        textarea.focus()
        textarea.setSelectionRange(textarea.value.length, textarea.value.length)

        let currentColor = normalizeHex(initialData.color || DEFAULT_COLOR)
        setActiveColor(currentColor, false)

        colorButton.addEventListener('click', (event) => {
          event.preventDefault()
          const isOpen = colorPicker.classList.toggle('is-open')
          colorButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
        })

        document.addEventListener('click', (event) => {
          if (!colorPicker.contains(event.target)) {
            closePalette()
          }
        })

        colorOptions.forEach((option) => {
          option.addEventListener('click', (event) => {
            event.preventDefault()
            const value = option.getAttribute('data-color-value')
            if (!value) return
            setActiveColor(value)
            closePalette()
          })
          option.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              option.click()
            }
          })
        })

        const handleSave = () =>
          send('config-save', {
            label: textarea.value,
            externalLink: linkInput ? linkInput.value : '',
            color: currentColor,
          })

        document.getElementById('cancel').addEventListener('click', () => {
          closePalette()
          send('config-cancel')
        })
        document.getElementById('save').addEventListener('click', handleSave)

        const handleKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            if (colorPicker.classList.contains('is-open')) {
              closePalette()
              return
            }
            send('config-cancel')
          }
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'enter') {
            event.preventDefault()
            handleSave()
          }
        }

        textarea.addEventListener('keydown', handleKeyDown)
        if (linkInput) {
          linkInput.addEventListener('keydown', handleKeyDown)
        }
      })()
    </script>
  </body>
</html>`
  }, [configInitialColor, draftExternalLink, draftLabel])

  const handleCanvasClick = useCallback(() => {
    if (panStateRef.current.moved) {
      panStateRef.current.moved = false
      return
    }
    if (rootNode) {
      setSelectedId(rootNode.id)
    }
  }, [rootNode])

  const getSvgPoint = useCallback((clientX, clientY) => {
    const svg = svgRef.current
    if (!svg) {
      return { x: clientX, y: clientY }
    }
    const rect = svg.getBoundingClientRect()
    const viewBox = svg.viewBox.baseVal
    const x = ((clientX - rect.left) / rect.width) * viewBox.width + viewBox.x
    const y = ((clientY - rect.top) / rect.height) * viewBox.height + viewBox.y
    return { x, y }
  }, [])

  const handlePointerDown = useCallback(
    (event) => {
      if (event.button !== 0) return

      const targetElement = event.target
      if (targetElement instanceof Element && targetElement.closest('[data-pan-stop="true"]')) {
        return
      }

      event.preventDefault()

      const svg = svgRef.current
      if (!svg) return

      panStateRef.current.isPanning = true
      panStateRef.current.pointerId = event.pointerId
      panStateRef.current.last = { x: event.clientX, y: event.clientY }
      panStateRef.current.moved = false
      setIsPanning(true)
      try {
        svg.setPointerCapture(event.pointerId)
      } catch {
        // ignore capture errors
      }
    },
    [],
  )

  const handlePointerMove = useCallback(
    (event) => {
      if (!panStateRef.current.isPanning) return

      const svg = svgRef.current
      if (!svg) return

      const dx = event.clientX - panStateRef.current.last.x
      const dy = event.clientY - panStateRef.current.last.y
      if (dx === 0 && dy === 0) return

      const rect = svg.getBoundingClientRect()
      const viewBox = svg.viewBox.baseVal
      const scaleX = viewBox.width / rect.width
      const scaleY = viewBox.height / rect.height

      setViewTransform((prev) => ({
        x: prev.x + dx * scaleX,
        y: prev.y + dy * scaleY,
        scale: prev.scale,
      }))

      panStateRef.current.last = { x: event.clientX, y: event.clientY }
      panStateRef.current.moved = true
    },
    [],
  )

  const endPan = useCallback(() => {
    const svg = svgRef.current
    if (svg && panStateRef.current.pointerId !== null) {
      try {
        svg.releasePointerCapture(panStateRef.current.pointerId)
      } catch {
        // ignore release errors
      }
    }
    panStateRef.current.isPanning = false
    panStateRef.current.pointerId = null
    panStateRef.current.last = { x: 0, y: 0 }
    setIsPanning(false)
  }, [])

  const handlePointerUp = useCallback(
    (event) => {
      if (!panStateRef.current.isPanning || event.pointerId !== panStateRef.current.pointerId) return
      endPan()
    },
    [endPan],
  )

  const handlePointerLeave = useCallback(() => {
    if (!panStateRef.current.isPanning) return
    endPan()
  }, [endPan])

  const handleWheel = useCallback(
    (event) => {
      const svg = svgRef.current
      if (!svg) return

      event.preventDefault()

      const point = getSvgPoint(event.clientX, event.clientY)

      setViewTransform((prev) => {
        const zoomIntensity = 0.0015
        const wheel = event.deltaY
        const scaleFactor = Math.exp(-wheel * zoomIntensity)
        const newScale = Math.min(Math.max(prev.scale * scaleFactor, 0.35), 3)

        const contentX = (point.x - prev.x) / prev.scale
        const contentY = (point.y - prev.y) / prev.scale

        return {
          scale: newScale,
          x: point.x - contentX * newScale,
          y: point.y - contentY * newScale,
        }
      })
    },
    [getSvgPoint],
  )

  const convertPointerToSvgPoint = useCallback((event) => {
    const svgElement = svgRef.current
    if (!svgElement) return null
    const point = svgElement.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const ctm = svgElement.getScreenCTM()
    if (!ctm) return null
    const transformed = point.matrixTransform(ctm.inverse())
    return { x: transformed.x, y: transformed.y }
  }, [])

  const handleNodePointerDown = useCallback(
    (event, node) => {
      event.stopPropagation()
      if (event.button !== 0) return
      setSelectedId(node.id)

      if (node.id === rootNode?.id) {
        return
      }

      if (event.target instanceof Element && event.target.closest('[data-no-drag="true"]')) {
        return
      }

      const nodePosition = positions[node.id]
      if (!nodePosition) return
      const svgPoint = convertPointerToSvgPoint(event)
      if (!svgPoint) return

      dragStateRef.current = {
        nodeId: node.id,
        pointerId: event.pointerId,
        startPointer: svgPoint,
        startPosition: { x: nodePosition.x, y: nodePosition.y },
      }

      setDraggingNodeId(node.id)
      event.currentTarget.setPointerCapture?.(event.pointerId)
      event.preventDefault()
    },
    [convertPointerToSvgPoint, positions, rootNode],
  )

  const handleNodePointerMove = useCallback(
    (event) => {
      const dragState = dragStateRef.current
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return
      }

      const svgPoint = convertPointerToSvgPoint(event)
      if (!svgPoint) return

      event.stopPropagation()
      event.preventDefault()

      const deltaX = svgPoint.x - dragState.startPointer.x
      const deltaY = svgPoint.y - dragState.startPointer.y
      const nextPosition = {
        x: dragState.startPosition.x + deltaX,
        y: dragState.startPosition.y + deltaY,
      }

      setCustomPositions((prev) => {
        const previous = prev[dragState.nodeId]
        if (previous && previous.x === nextPosition.x && previous.y === nextPosition.y) {
          return prev
        }
        return {
          ...prev,
          [dragState.nodeId]: nextPosition,
        }
      })
    },
    [convertPointerToSvgPoint],
  )

  const endDragging = useCallback(() => {
    dragStateRef.current = null
    setDraggingNodeId(null)
  }, [])

  const handleNodePointerUp = useCallback(
    (event) => {
      const dragState = dragStateRef.current
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return
      }

      event.stopPropagation()
      event.preventDefault()
      event.currentTarget.releasePointerCapture?.(event.pointerId)
      endDragging()
    },
    [endDragging],
  )

  const handleNodePointerCancel = useCallback(
    (event) => {
      const dragState = dragStateRef.current
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return
      }
      event.currentTarget.releasePointerCapture?.(event.pointerId)
      endDragging()
    },
    [endDragging],
  )

  useEffect(() => {
    setCustomPositions((prev) => {
      const validIds = new Set(nodes.map((node) => node.id))
      let changed = false
      const next = {}
      Object.entries(prev).forEach(([id, value]) => {
        if (validIds.has(id)) {
          next[id] = value
        } else {
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [nodes])

  const handleSave = useCallback(() => {
    const payload = {
      nodes,
      customPositions,
      viewTransform,
    }
    const json = JSON.stringify(payload, null, 2)
    const filename = getDefaultFilename(rootNode?.label)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [customPositions, nodes, rootNode?.label, viewTransform])

  const handleExportPdf = useCallback(async () => {
    if (typeof window === 'undefined') return
    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20

      if (typeof document !== 'undefined') {
        const backgroundCanvas = document.createElement('canvas')
        const referenceWidth = 2048
        backgroundCanvas.width = referenceWidth
        backgroundCanvas.height = Math.round(referenceWidth * (pageHeight / pageWidth))
        const ctx = backgroundCanvas.getContext('2d')

        if (ctx) {
          const { width, height } = backgroundCanvas

          ctx.fillStyle = '#f8fafc'
          ctx.fillRect(0, 0, width, height)

          const baseGradient = ctx.createRadialGradient(
            width / 2,
            height * 0.1,
            width * 0.1,
            width / 2,
            height / 2,
            Math.max(width, height),
          )
          baseGradient.addColorStop(0, '#f8fafc')
          baseGradient.addColorStop(1, '#e2e8f0')
          ctx.fillStyle = baseGradient
          ctx.fillRect(0, 0, width, height)

          const overlayGradient = ctx.createRadialGradient(
            width / 2,
            height / 2,
            width * 0.1,
            width / 2,
            height / 2,
            Math.max(width, height) * 0.75,
          )
          overlayGradient.addColorStop(0, 'rgba(148, 163, 184, 0.18)')
          overlayGradient.addColorStop(1, 'rgba(148, 163, 184, 0.05)')
          ctx.fillStyle = overlayGradient
          ctx.fillRect(0, 0, width, height)

          const backgroundDataUrl = backgroundCanvas.toDataURL('image/png')
          pdf.addImage(backgroundDataUrl, 'PNG', 0, 0, pageWidth, pageHeight)
        } else {
          pdf.setFillColor(248, 250, 252)
          pdf.rect(0, 0, pageWidth, pageHeight, 'F')
        }
      } else {
        pdf.setFillColor(248, 250, 252)
        pdf.rect(0, 0, pageWidth, pageHeight, 'F')
      }

      const nodesWithPosition = nodes
        .map((node) => {
          const position = positions[node.id]
          if (!position) return null
          const size = nodeSizes[node.id] ?? DEFAULT_NODE_SIZE
          return { node, position, size }
        })
        .filter(Boolean)

      if (nodesWithPosition.length === 0) {
        window.alert('Aucun contenu à exporter pour le PDF.')
        return
      }

      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity

      nodesWithPosition.forEach(({ position, size }) => {
        const halfWidth = size.width / 2
        const halfHeight = size.height / 2
        minX = Math.min(minX, position.x - halfWidth)
        maxX = Math.max(maxX, position.x + halfWidth)
        minY = Math.min(minY, position.y - halfHeight)
        maxY = Math.max(maxY, position.y + halfHeight)
      })

      nodes.forEach((node) => {
        if (node.parentId === null) return
        const parentPosition = positions[node.parentId]
        const nodePosition = positions[node.id]
        if (!parentPosition || !nodePosition) return
        minX = Math.min(minX, parentPosition.x, nodePosition.x)
        maxX = Math.max(maxX, parentPosition.x, nodePosition.x)
        minY = Math.min(minY, parentPosition.y, nodePosition.y)
        maxY = Math.max(maxY, parentPosition.y, nodePosition.y)
      })

      if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
        window.alert('Impossible de déterminer la zone à exporter.')
        return
      }

      const contentWidth = Math.max(maxX - minX, 1)
      const contentHeight = Math.max(maxY - minY, 1)

      const availableWidth = pageWidth - margin * 2
      const availableHeight = pageHeight - margin * 2
      const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight)

      const contentWidthScaled = contentWidth * scale
      const contentHeightScaled = contentHeight * scale
      const offsetX = margin + (availableWidth - contentWidthScaled) / 2
      const offsetY = margin + (availableHeight - contentHeightScaled) / 2

      const convertX = (value) => offsetX + (value - minX) * scale
      const convertY = (value) => offsetY + (value - minY) * scale

      pdf.setLineJoin('round')
      pdf.setLineCap('round')
      pdf.setDrawColor(15, 23, 42)

      const connectionWidth = 3 * scale
      pdf.setLineWidth(connectionWidth)
      nodes.forEach((node) => {
        if (node.parentId === null) return
        const parentPosition = positions[node.parentId]
        const nodePosition = positions[node.id]
        if (!parentPosition || !nodePosition) return
        pdf.line(convertX(parentPosition.x), convertY(parentPosition.y), convertX(nodePosition.x), convertY(nodePosition.y))
      })

      const PT_PER_MM = 72 / 25.4
      const baseFontSizePx = 16.8
      const lineHeightFactor = 1.3

      nodesWithPosition.forEach(({ node, position, size }) => {
        const nodeWidth = size.width * scale
        const nodeHeight = size.height * scale
        const nodeX = convertX(position.x - size.width / 2)
        const nodeY = convertY(position.y - size.height / 2)
        const cornerRadius = 24 * scale

        const shadowOffset = 12 * scale
        if (typeof pdf.GState === 'function') {
          const shadowState = pdf.GState({ opacity: 0.18 })
          pdf.setGState(shadowState)
          pdf.setFillColor(15, 23, 42)
          pdf.roundedRect(nodeX + shadowOffset, nodeY + shadowOffset, nodeWidth, nodeHeight, cornerRadius, cornerRadius, 'F')
          pdf.setGState(pdf.GState({ opacity: 1 }))
        }

        const { r, g, b } = hexToRgb(node.color ?? DEFAULT_NODE_COLOR)
        pdf.setFillColor(r, g, b)
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(5 * scale)
        pdf.roundedRect(nodeX, nodeY, nodeWidth, nodeHeight, cornerRadius, cornerRadius, 'FD')

        const paddingX = 20 * scale
        const textAreaWidth = Math.max(nodeWidth - paddingX * 2, 0)
        const centerX = nodeX + nodeWidth / 2
        const centerY = nodeY + nodeHeight / 2

        const label = node.label.trim().length > 0 ? node.label : PLACEHOLDER_LABEL
        const fontSizePt = Math.max(baseFontSizePx * scale * PT_PER_MM, 6)
        pdf.setFont('helvetica', 'bold')
        const isPlaceholder = label === PLACEHOLDER_LABEL && node.label.trim().length === 0
        if (isPlaceholder) {
          pdf.setTextColor(94, 110, 135)
        } else {
          pdf.setTextColor(15, 23, 42)
        }
        pdf.setFontSize(fontSizePt)
        const lines = pdf.splitTextToSize(label, textAreaWidth)
        const lineHeight = (baseFontSizePx * lineHeightFactor * scale)
        const totalHeight = lineHeight * lines.length
        let startY = centerY - totalHeight / 2 + lineHeight / 2

        lines.forEach((line) => {
          pdf.text(line, centerX, startY, { align: 'center', baseline: 'middle' })
          startY += lineHeight
        })
      })

      const filename = getDefaultFilename(rootNode?.label, 'pdf')
      pdf.save(filename)
    } catch (error) {
      console.error('Failed to export PDF', error)
      window.alert("L'export PDF a échoué. Veuillez réessayer.")
    }
  }, [nodeSizes, nodes, positions, rootNode?.label])

  const handleLoadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (event) => {
      const input = event.target
      const { files } = input
      const file = files && files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (loadEvent) => {
        try {
          const text = typeof loadEvent.target?.result === 'string' ? loadEvent.target.result : ''
          const data = JSON.parse(text)
          if (!data || typeof data !== 'object' || !Array.isArray(data.nodes)) {
            throw new Error('Invalid data')
          }

          if (!window.confirm('Charger cette carte remplacera la carte actuelle. Continuer ?')) {
            return
          }

          const nextNodes = data.nodes.map((node) => {
            const label = typeof node.label === 'string' ? node.label : ''
            const externalLink = typeof node.externalLink === 'string' ? node.externalLink.trim() : ''
            const color = normalizeNodeColor(node.color ?? DEFAULT_NODE_COLOR)
            return {
              ...node,
              label,
              externalLink,
              color,
            }
          })
          const nextCustomPositions =
            data.customPositions && typeof data.customPositions === 'object'
              ? data.customPositions
              : {}
          const nextViewTransform =
            data.viewTransform && typeof data.viewTransform === 'object'
              ? {
                  x: Number.isFinite(data.viewTransform.x) ? data.viewTransform.x : 0,
                  y: Number.isFinite(data.viewTransform.y) ? data.viewTransform.y : 0,
                  scale: Number.isFinite(data.viewTransform.scale) ? data.viewTransform.scale : 1,
                }
              : { x: 0, y: 0, scale: 1 }
          setNodes(nextNodes)
          setCustomPositions(nextCustomPositions)
          setViewTransform(nextViewTransform)

          const nextRoot = nextNodes.find((node) => node.parentId === null)
          if (nextRoot) {
            setSelectedId(nextRoot.id)
          } else if (nextNodes.length > 0) {
            setSelectedId(nextNodes[0].id)
          }

          idCounter.current = getNextIdFromNodes(nextNodes)
        } catch (error) {
          console.error('Failed to load mind map', error)
          window.alert("Impossible de charger ce fichier. Veuillez vérifier son contenu.")
        } finally {
          if (input) {
            input.value = ''
          }
        }
      }

      reader.onerror = () => {
        window.alert('Une erreur est survenue lors de la lecture du fichier.')
        if (input) {
          input.value = ''
        }
      }

      reader.readAsText(file)
    },
    [setCustomPositions, setNodes, setSelectedId, setViewTransform],
  )

  return (
    <div className="app">
      <div
        className="canvas-wrapper"
        onClick={handleCanvasClick}
      >
        <svg
          ref={svgRef}
          className={`mindmap-canvas ${isPanning ? 'is-panning' : ''}`}
          viewBox="-720 -480 1440 960"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerLeave}
          onWheel={handleWheel}
        >

          <defs>
            <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="rgba(15, 23, 42, 0.22)" />
            </filter>
          </defs>
          <g transform={`translate(${viewTransform.x} ${viewTransform.y})`}>
            <g transform={`scale(${viewTransform.scale})`}>
              {nodes
                .filter((node) => node.parentId !== null)
                .map((node) => {
                  const parentPos = node.parentId ? positions[node.parentId] : null
                  const nodePos = positions[node.id]
                  if (!parentPos || !nodePos) return null

                  return (
                    <line
                      key={`line-${node.id}`}
                      x1={parentPos.x}
                      y1={parentPos.y}
                      x2={nodePos.x}
                      y2={nodePos.y}
                      className="mindmap-connection"
                    />
                  )
                })}

              {nodes.map((node) => {
                const nodePos = positions[node.id]
                if (!nodePos) return null
                const isSelected = node.id === selectedNode?.id
                const isRoot = node.id === rootNode?.id
                const displayLabel = node.label.trim().length > 0 ? node.label : PLACEHOLDER_LABEL
                const size = nodeSizes[node.id] ?? DEFAULT_NODE_SIZE
                const toolbarWidth = Math.max(size.width, 280)
                const baseColor = node.color ?? DEFAULT_NODE_COLOR
                const effectiveColor =
                  isSelected && isConfigOpen ? draftColor ?? baseColor : baseColor
                const normalizedColor = normalizeNodeColor(effectiveColor)
                const rawLink = typeof node.externalLink === 'string' ? node.externalLink.trim() : ''
                const hasExternalLink = rawLink.length > 0
                const labelClassNames = [
                  'node-label',
                  displayLabel === node.label ? '' : 'is-placeholder',
                  hasExternalLink ? 'node-label-link' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <g
                    key={node.id}
                    transform={`translate(${nodePos.x}, ${nodePos.y})`}
                    className={`mindmap-node ${draggingNodeId === node.id ? 'is-dragging' : ''}`}
                    data-pan-stop="true"
                    onPointerDown={(event) => handleNodePointerDown(event, node)}
                    onPointerMove={handleNodePointerMove}
                    onPointerUp={handleNodePointerUp}
                    onPointerCancel={handleNodePointerCancel}
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedId(node.id)
                    }}
                  >
                    {isSelected && (
                      <foreignObject
                        x={-toolbarWidth / 2}
                        y={-size.height / 2 - 56}
                        width={toolbarWidth}
                        height={48}
                        className="toolbar-wrapper"
                      >
                        <div className="floating-toolbar" data-pan-stop="true" xmlns="http://www.w3.org/1999/xhtml">
                          <button
                            type="button"
                            className="toolbar-button"
                            data-no-drag="true"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedId(node.id)
                              openConfigPanel()
                            }}
                          >
                            <IconEdit />
                            <span>Modifier</span>
                          </button>
                          <button
                            type="button"
                            className="toolbar-button"
                            data-no-drag="true"
                            disabled={isRoot}
                            onClick={(event) => {
                              event.stopPropagation()
                              removeSelectedBranch()
                            }}
                          >
                            <IconTrash />
                            <span>Supprimer</span>
                          </button>
                        </div>
                      </foreignObject>
                    )}

                    <foreignObject
                      x={-size.width / 2}
                      y={-size.height / 2}
                      width={size.width}
                      height={size.height}
                    >
                      <div
                        className={`mindmap-node-card ${isSelected ? 'is-selected' : ''} ${isRoot ? 'is-root' : ''}`}
                        data-pan-stop="true"
                        xmlns="http://www.w3.org/1999/xhtml"
                        style={{ background: normalizedColor }}
                      >
                        {hasExternalLink ? (
                          <a
                            href={rawLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={labelClassNames}
                          >
                            {displayLabel}
                          </a>
                        ) : (
                          <span className={labelClassNames}>{displayLabel}</span>
                        )}
                      </div>
                    </foreignObject>

                    {isSelected && (
                      <foreignObject x={size.width / 2 + 12} y={-22} width={44} height={44}>
                        <div className="quick-add" data-pan-stop="true" xmlns="http://www.w3.org/1999/xhtml">
                          <button
                            type="button"
                            className="quick-add-button"
                            data-no-drag="true"
                            onClick={(event) => {
                              event.stopPropagation()
                              addChild()
                            }}
                          >
                            <IconPlus />
                          </button>
                        </div>
                      </foreignObject>
                    )}
                  </g>
                )
              })}
            </g>
          </g>
        </svg>

        <div className="canvas-overlay">
          <div className="overlay-panel">
            <div className="overlay-actions">
              <button type="button" className="overlay-button" onClick={handleSave} data-pan-stop="true">
                Sauvegarder
              </button>
              <button type="button" className="overlay-button" onClick={handleLoadClick} data-pan-stop="true">
                Charger
              </button>
              <button type="button" className="overlay-button" onClick={handleExportPdf} data-pan-stop="true">
                Exporter en pdf
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      </div>
      {isConfigOpen && (
        <div className="config-modal-backdrop" role="presentation" onClick={closeConfigPanel}>
          <div
            className="config-iframe-wrapper"
            role="dialog"
            aria-modal="true"
            aria-label="Configuration du nœud"
            data-pan-stop="true"
            onClick={(event) => event.stopPropagation()}
          >
            <iframe
              ref={configIframeRef}
              className="config-iframe"
              title="Configuration du nœud"
              sandbox="allow-scripts allow-same-origin"
              srcDoc={configIframeContent}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
