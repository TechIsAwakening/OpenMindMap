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

const nextIdFromInitial =
  INITIAL_NODES.reduce((acc, node) => {
    const match = node.id.match(/node-(\d+)/)
    if (!match) return acc
    return Math.max(acc, Number.parseInt(match[1], 10))
  }, 0) + 1

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
  const [nodes, setNodes] = useState(INITIAL_NODES)
  const [selectedId, setSelectedId] = useState('root')
  const [draftLabel, setDraftLabel] = useState(INITIAL_NODES[0].label)
  const [customPositions, setCustomPositions] = useState({})
  const [draggingNodeId, setDraggingNodeId] = useState(null)
  const [isGridSnappingEnabled, setIsGridSnappingEnabled] = useState(false)
  const idCounter = useRef(nextIdFromInitial)
  const svgRef = useRef(null)
  const historyRef = useRef({ past: [], future: [] })
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

  useEffect(() => {
    if (selectedNode) {
      setDraftLabel(selectedNode.label)
    } else {
      setDraftLabel('')
    }
  }, [selectedNode?.id, selectedNode?.label])

  const cloneSnapshot = useCallback((snapshot) => {
    const nodesClone = (snapshot.nodes ?? []).map((node) => ({ ...node }))
    const customPositionsSource = snapshot.customPositions ?? {}
    const customPositionsClone = Object.fromEntries(
      Object.entries(customPositionsSource).map(([key, value]) => [key, { ...value }]),
    )

    return {
      nodes: nodesClone,
      customPositions: customPositionsClone,
      selectedId: snapshot.selectedId ?? null,
    }
  }, [])

  const captureSnapshot = useCallback(() => {
    return cloneSnapshot({ nodes, customPositions, selectedId })
  }, [cloneSnapshot, customPositions, nodes, selectedId])

  const applySnapshot = useCallback(
    (snapshot) => {
      const cloned = cloneSnapshot(snapshot)
      setNodes(cloned.nodes)
      setCustomPositions(cloned.customPositions)
      setSelectedId(cloned.selectedId)
    },
    [cloneSnapshot],
  )

  const areSnapshotsEqual = useCallback((a, b) => {
    if (a.nodes.length !== b.nodes.length) {
      return false
    }

    for (let index = 0; index < a.nodes.length; index += 1) {
      const nodeA = a.nodes[index]
      const nodeB = b.nodes[index]
      if (nodeA.id !== nodeB.id || nodeA.label !== nodeB.label || nodeA.parentId !== nodeB.parentId) {
        return false
      }
    }

    const keysA = Object.keys(a.customPositions)
    const keysB = Object.keys(b.customPositions)
    if (keysA.length !== keysB.length) {
      return false
    }

    for (const key of keysA) {
      const posA = a.customPositions[key]
      const posB = b.customPositions[key]
      if (!posB || posA.x !== posB.x || posA.y !== posB.y) {
        return false
      }
    }

    return a.selectedId === b.selectedId
  }, [])

  const pushSnapshotToHistory = useCallback(
    (snapshot) => {
      const { past } = historyRef.current
      const lastSnapshot = past[past.length - 1]
      if (lastSnapshot && areSnapshotsEqual(lastSnapshot, snapshot)) {
        return
      }
      historyRef.current = {
        past: [...past, cloneSnapshot(snapshot)],
        future: [],
      }
    },
    [areSnapshotsEqual, cloneSnapshot],
  )

  const recordHistory = useCallback(() => {
    pushSnapshotToHistory(captureSnapshot())
  }, [captureSnapshot, pushSnapshotToHistory])

  const undo = useCallback(() => {
    const { past, future } = historyRef.current
    if (past.length === 0) {
      return
    }

    const currentSnapshot = captureSnapshot()
    const previousSnapshot = past[past.length - 1]
    historyRef.current = {
      past: past.slice(0, past.length - 1),
      future: [cloneSnapshot(currentSnapshot), ...future],
    }
    applySnapshot(previousSnapshot)
  }, [applySnapshot, captureSnapshot, cloneSnapshot])

  const redo = useCallback(() => {
    const { past, future } = historyRef.current
    if (future.length === 0) {
      return
    }

    const currentSnapshot = captureSnapshot()
    const nextSnapshot = future[0]
    historyRef.current = {
      past: [...past, cloneSnapshot(currentSnapshot)],
      future: future.slice(1),
    }
    applySnapshot(nextSnapshot)
  }, [applySnapshot, captureSnapshot, cloneSnapshot])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return
      }

      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }

      if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [redo, undo])

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

    recordHistory()

    const newNode = {
      id: `node-${idCounter.current}`,
      label: '',
      parentId: selectedNode.id,
    }

    idCounter.current += 1
    setNodes((prev) => [...prev, newNode])
    setSelectedId(newNode.id)
    setDraftLabel('')
  }, [recordHistory, selectedNode])

  const removeSelectedBranch = useCallback(() => {
    if (!selectedNode || selectedNode.id === rootNode?.id) return

    recordHistory()

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
  }, [nodes, recordHistory, rootNode, selectedNode])

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
        historySnapshot: captureSnapshot(),
        historyRecorded: false,
      }

      setDraggingNodeId(node.id)
      event.currentTarget.setPointerCapture?.(event.pointerId)
      event.preventDefault()
    },
    [captureSnapshot, convertPointerToSvgPoint, positions, rootNode],
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

      const hasMoved =
        nextPosition.x !== dragState.startPosition.x ||
        nextPosition.y !== dragState.startPosition.y

      if (!dragState.historyRecorded && !hasMoved) {
        return
      }

      if (!dragState.historyRecorded) {
        pushSnapshotToHistory(dragState.historySnapshot)
        dragState.historyRecorded = true
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
    [convertPointerToSvgPoint, pushSnapshotToHistory, snapPosition],
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
