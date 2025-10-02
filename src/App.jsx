import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const LEVEL_SPACING = 220
const NODE_WIDTH = 220
const NODE_HEIGHT = 88
const GRID_SIZE = 40

const INITIAL_NODES = [
  { id: 'root', label: 'Ma carte mentale', parentId: null },
  { id: 'node-1', label: 'Idée clé #1', parentId: 'root' },
  { id: 'node-2', label: 'Idée clé #2', parentId: 'root' },
]

const STORAGE_KEY = 'openmindmap:saved-state'
const AUTOSAVE_INTERVAL_MS = 5000

function createDefaultNodes() {
  return INITIAL_NODES.map((node) => ({ ...node }))
}

function computeNextIdFromNodes(nodes) {
  return (
    (nodes ?? []).reduce((acc, node) => {
      const match = node.id.match(/node-(\d+)/)
      if (!match) return acc
      return Math.max(acc, Number.parseInt(match[1], 10))
    }, 0) + 1
  )
}

function readStoredState() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    if (!Array.isArray(parsed.nodes)) {
      return null
    }
    return parsed
  } catch (error) {
    console.error('Impossible de charger la sauvegarde locale', error)
    return null
  }
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

function App() {
  const storedStateRef = useRef(readStoredState())

  const [nodes, setNodes] = useState(() => storedStateRef.current?.nodes ?? createDefaultNodes())
  const [selectedId, setSelectedId] = useState(() => {
    const nodesData = storedStateRef.current?.nodes ?? createDefaultNodes()
    const storedSelected = storedStateRef.current?.selectedId
    if (storedSelected && nodesData.some((node) => node.id === storedSelected)) {
      return storedSelected
    }
    const root = nodesData.find((node) => node.parentId === null)
    return root?.id ?? nodesData[0]?.id ?? 'root'
  })
  const [draftLabel, setDraftLabel] = useState(() => {
    const nodesData = storedStateRef.current?.nodes ?? createDefaultNodes()
    const selectedNodeId = storedStateRef.current?.selectedId
    const selectedNode = nodesData.find((node) => node.id === selectedNodeId)
    if (selectedNode) {
      return selectedNode.label
    }
    const root = nodesData.find((node) => node.parentId === null)
    return root?.label ?? nodesData[0]?.label ?? ''
  })
  const [customPositions, setCustomPositions] = useState(
    () => storedStateRef.current?.customPositions ?? {},
  )
  const [draggingNodeId, setDraggingNodeId] = useState(null)
  const [isGridSnappingEnabled, setIsGridSnappingEnabled] = useState(
    () => storedStateRef.current?.isGridSnappingEnabled ?? false,
  )
  const [viewTransform, setViewTransform] = useState(
    () =>
      storedStateRef.current?.viewTransform ?? {
        x: 0,
        y: 0,
        scale: 1,
      },
  )
  const [lastSavedAt, setLastSavedAt] = useState(() => storedStateRef.current?.lastSavedAt ?? null)
  const idCounter = useRef(
    storedStateRef.current?.idCounter ??
      computeNextIdFromNodes(storedStateRef.current?.nodes ?? createDefaultNodes()),
  )
  const svgRef = useRef(null)
  const panStateRef = useRef({
    isPanning: false,
    pointerId: null,
    last: { x: 0, y: 0 },
    moved: false,
  })

  const [isPanning, setIsPanning] = useState(false)

  const dragStateRef = useRef(null)


  const rootNode = useMemo(
    () => nodes.find((node) => node.parentId === null) ?? null,
    [nodes],
  )

  useEffect(() => {
    const nextFromNodes = computeNextIdFromNodes(nodes)
    if (idCounter.current < nextFromNodes) {
      idCounter.current = nextFromNodes
    }
  }, [nodes])

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

  const saveState = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const payload = {
      nodes,
      customPositions,
      viewTransform,
      isGridSnappingEnabled,
      selectedId: selectedNode?.id ?? null,
      idCounter: idCounter.current,
      lastSavedAt: new Date().toISOString(),
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      setLastSavedAt(payload.lastSavedAt)
    } catch (error) {
      console.error("Impossible d'enregistrer la sauvegarde locale", error)
    }
  }, [customPositions, isGridSnappingEnabled, nodes, selectedNode?.id, viewTransform])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const interval = window.setInterval(() => {
      saveState()
    }, AUTOSAVE_INTERVAL_MS)
    return () => {
      window.clearInterval(interval)
    }
  }, [saveState])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const handleBeforeUnload = () => {
      saveState()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [saveState])

  const handleReset = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch (error) {
        console.error('Impossible de supprimer la sauvegarde locale', error)
      }
    }

    const freshNodes = createDefaultNodes()
    const freshRoot = freshNodes.find((node) => node.parentId === null)
    const nextSelectedId = freshRoot?.id ?? freshNodes[0]?.id ?? 'root'

    setNodes(freshNodes)
    setSelectedId(nextSelectedId)
    setDraftLabel(freshRoot?.label ?? freshNodes[0]?.label ?? '')
    setCustomPositions({})
    setViewTransform({ x: 0, y: 0, scale: 1 })
    setIsGridSnappingEnabled(false)
    setLastSavedAt(null)
    idCounter.current = computeNextIdFromNodes(freshNodes)
  }, [])

  const formattedLastSavedAt = useMemo(() => {
    if (!lastSavedAt) return null
    const parsed = new Date(lastSavedAt)
    if (Number.isNaN(parsed.getTime())) {
      return null
    }
    return parsed.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }, [lastSavedAt])

  useEffect(() => {
    if (selectedNode) {
      setDraftLabel(selectedNode.label)
    } else {
      setDraftLabel('')
    }
  }, [selectedNode?.id])

  const updateSelectedLabel = useCallback(
    (label) => {
      if (!selectedNode) return
      setDraftLabel(label)
      setNodes((prev) =>
        prev.map((node) =>
          node.id === selectedNode.id
            ? {
                ...node,
                label,
              }
            : node,
        ),
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
      } catch (error) {
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
      } catch (error) {
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

  const handleNodeKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        addChild()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'backspace') {
        event.preventDefault()
        removeSelectedBranch()
      }
    },
    [addChild, removeSelectedBranch],
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

  const snapPosition = useCallback(
    (x, y) => {
      if (!isGridSnappingEnabled) {
        return { x, y }
      }
      const snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE
      const snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE
      return { x: snappedX, y: snappedY }
    },
    [isGridSnappingEnabled],
  )

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
      const nextPosition = snapPosition(
        dragState.startPosition.x + deltaX,
        dragState.startPosition.y + deltaY,
      )

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
    [convertPointerToSvgPoint, snapPosition],
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

  return (
    <div className="app">
      <div
        className={`canvas-wrapper ${isGridSnappingEnabled ? 'with-grid' : ''}`}
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
                const displayLabel = node.label.trim().length > 0 ? node.label : 'Nommez cette idée'

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
                        x={-110}
                        y={-NODE_HEIGHT / 2 - 56}
                        width={220}
                        height={48}
                        className="toolbar-wrapper"
                      >
                        <div className="floating-toolbar" data-pan-stop="true" xmlns="http://www.w3.org/1999/xhtml">
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
                      x={-NODE_WIDTH / 2}
                      y={-NODE_HEIGHT / 2}
                      width={NODE_WIDTH}
                      height={NODE_HEIGHT}
                    >
                      <div
                        className={`mindmap-node-card ${isSelected ? 'is-selected' : ''} ${isRoot ? 'is-root' : ''}`}
                        data-pan-stop="true"
                        xmlns="http://www.w3.org/1999/xhtml"
                      >
                        {isSelected ? (
                          <input
                            className="node-input"
                            data-no-drag="true"
                            autoFocus
                            value={draftLabel}
                            placeholder="Nommez cette idée"
                            onChange={(event) => updateSelectedLabel(event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={handleNodeKeyDown}
                          />
                        ) : (
                          <span className={`node-label ${displayLabel === node.label ? '' : 'is-placeholder'}`}>
                            {displayLabel}
                          </span>
                        )}
                      </div>
                    </foreignObject>

                    {isSelected && (
                      <foreignObject x={NODE_WIDTH / 2 + 12} y={-22} width={44} height={44}>
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
            <label className="grid-toggle">
              <input
                type="checkbox"
                checked={isGridSnappingEnabled}
                onChange={(event) => setIsGridSnappingEnabled(event.target.checked)}
              />
              <span>Aligner sur la grille</span>
            </label>
            <div className="overlay-actions">
              <button type="button" className="overlay-button overlay-button--primary" onClick={saveState}>
                <span aria-hidden="true">💾</span>
                <span>Sauvegarder</span>
              </button>
              <button type="button" className="overlay-button overlay-button--danger" onClick={handleReset}>
                <span aria-hidden="true">🗑️</span>
                <span>Réinitialiser</span>
              </button>
            </div>
            <div className="autosave-info">
              {formattedLastSavedAt ? (
                <span>Dernière sauvegarde : {formattedLastSavedAt}</span>
              ) : (
                <span>Aucune sauvegarde locale</span>
              )}
            </div>
            <div className="overlay-tip">
              Cliquez sur un nœud pour le sélectionner, glissez-déposez pour le déplacer. Ctrl + Retour arrière pour supprimer.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
