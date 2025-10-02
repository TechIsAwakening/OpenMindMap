import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const LEVEL_SPACING = 220
const NODE_WIDTH = 220
const NODE_HEIGHT = 88

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

function IconCenter() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M3 10h4m6 0h4M10 3v4m0 6v4m-4-4h8m-4-4h.01"
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
  const idCounter = useRef(nextIdFromInitial)

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

  const positions = useMemo(() => computeLayout(nodes), [nodes])
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
    if (rootNode) {
      setSelectedId(rootNode.id)
    }
  }, [nodes, rootNode, selectedNode])

  const recentre = useCallback(() => {
    if (!rootNode) return
    setSelectedId(rootNode.id)
  }, [rootNode])

  const handleCanvasClick = useCallback(() => {
    if (rootNode) {
      setSelectedId(rootNode.id)
    }
  }, [rootNode])

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

  return (
    <div className="app">
      <header className="top-bar">
        <div>
          <p className="top-tag">POC interactif</p>
          <h1 className="top-title">OpenMindMap</h1>
          <p className="top-subtitle">
            Ajoutez et renommez vos idées directement sur la carte. Appuyez sur <strong>Entrée</strong> ou
            <strong> Tab</strong> pour créer une idée secondaire.
          </p>
        </div>
        <div className="top-metrics">
          <div>
            <span className="metric-value">{nodes.length}</span>
            <span className="metric-label">idées</span>
          </div>
          <div>
            <span className="metric-value">{Math.max(...nodes.map((node) => positions[node.id]?.depth ?? 0), 0) + 1}</span>
            <span className="metric-label">niveaux</span>
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="canvas-wrapper" onClick={handleCanvasClick}>
          <svg className="mindmap-canvas" viewBox="-720 -480 1440 960">
            <defs>
              <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="rgba(15, 23, 42, 0.22)" />
              </filter>
            </defs>

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
                  className="mindmap-node"
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
                      <div className="floating-toolbar" xmlns="http://www.w3.org/1999/xhtml">
                        <button type="button" className="toolbar-button" onClick={(event) => {
                          event.stopPropagation()
                          addChild()
                        }}
                        >
                          <IconPlus />
                          <span>Ajouter</span>
                        </button>
                        <button
                          type="button"
                          className="toolbar-button"
                          onClick={(event) => {
                            event.stopPropagation()
                            recentre()
                          }}
                        >
                          <IconCenter />
                          <span>Centre</span>
                        </button>
                        <button
                          type="button"
                          className="toolbar-button"
                          disabled={isRoot}
                          onClick={(event) => {
                            event.stopPropagation()
                            removeSelectedBranch()
                          }}
                        >
                          <IconTrash />
                          <span>Suppr.</span>
                        </button>
                      </div>
                    </foreignObject>
                  )}

                  <foreignObject x={-NODE_WIDTH / 2} y={-NODE_HEIGHT / 2} width={NODE_WIDTH} height={NODE_HEIGHT}>
                    <div
                      className={`mindmap-node-card ${isSelected ? 'is-selected' : ''} ${isRoot ? 'is-root' : ''}`}
                      xmlns="http://www.w3.org/1999/xhtml"
                    >
                      {isSelected ? (
                        <input
                          className="node-input"
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
                      <div className="quick-add" xmlns="http://www.w3.org/1999/xhtml">
                        <button
                          type="button"
                          className="quick-add-button"
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
          </svg>

          <div className="canvas-overlay">
            <div className="overlay-tip">Cliquez sur la carte pour sélectionner un nœud. Ctrl + Retour arrière pour supprimer.</div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
