import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const LEVEL_SPACING = 180
const NODE_WIDTH = 160
const NODE_HEIGHT = 72

const INITIAL_NODES = [
  { id: 'root', label: 'Sujet principal', parentId: null },
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

function App() {
  const [nodes, setNodes] = useState(INITIAL_NODES)
  const [selectedId, setSelectedId] = useState('root')
  const [draftLabel, setDraftLabel] = useState('')
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

  const updateSelectedLabel = (label) => {
    if (!selectedNode) return
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
  }

  const addChild = () => {
    if (!selectedNode) return
    const trimmedLabel = draftLabel.trim()
    const label = trimmedLabel.length > 0 ? trimmedLabel : `Nouvelle idée ${idCounter.current}`

    const newNode = {
      id: `node-${idCounter.current}`,
      label,
      parentId: selectedNode.id,
    }

    idCounter.current += 1
    setNodes((prev) => [...prev, newNode])
    setDraftLabel('')
    setSelectedId(newNode.id)
  }

  const removeSelectedBranch = () => {
    if (!selectedNode || selectedNode.id === rootNode?.id) return

    const toDelete = new Set([selectedNode.id])
    const queue = [selectedNode.id]

    while (queue.length > 0) {
      const current = queue.pop()
      nodes
        .filter((node) => node.parentId === current)
        .forEach((child) => {
          toDelete.add(child.id)
          queue.push(child.id)
        })
    }

    setNodes((prev) => prev.filter((node) => !toDelete.has(node.id)))
    if (rootNode) {
      setSelectedId(rootNode.id)
    }
  }

  const totalIdeas = nodes.length
  const levelCount = Math.max(...nodes.map((node) => positions[node.id]?.depth ?? 0), 0)

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="app-tag">Proof of Concept</p>
          <h1>OpenMindMap</h1>
          <p className="app-subtitle">
            Concevez rapidement une carte mentale interactive. Cette version de démonstration se concentre sur la
            création, l&apos;organisation et l&apos;édition de vos idées essentielles.
          </p>
        </div>
        <div className="header-stats">
          <div>
            <span className="stat-value">{totalIdeas}</span>
            <span className="stat-label">idées</span>
          </div>
          <div>
            <span className="stat-value">{levelCount + 1}</span>
            <span className="stat-label">niveaux</span>
          </div>
        </div>
      </header>

      <main className="app-body">
        <section className="canvas-wrapper">
          <svg className="mindmap-canvas" viewBox="-640 -380 1280 760">
            <defs>
              <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="rgba(15, 23, 42, 0.18)" />
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
                  <foreignObject
                    x={-NODE_WIDTH / 2}
                    y={-NODE_HEIGHT / 2}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                  >
                    <div
                      className={`mindmap-node-card ${isSelected ? 'is-selected' : ''} ${isRoot ? 'is-root' : ''}`}
                      role="button"
                      tabIndex={0}
                    >
                      <span>{node.label}</span>
                    </div>
                  </foreignObject>
                </g>
              )
            })}
          </svg>
          <div className="canvas-hint">Cliquez sur un nœud pour le sélectionner et le modifier.</div>
        </section>

        <aside className="side-panel">
          <h2 className="panel-title">Panneau de contrôle</h2>
          <p className="panel-description">
            Ajoutez de nouvelles branches ou renommez une idée pour structurer rapidement votre projet.
          </p>

          <div className="panel-section">
            <label className="panel-label" htmlFor="selected-label">
              Nom de l&apos;idée sélectionnée
            </label>
            <input
              id="selected-label"
              className="panel-input"
              type="text"
              value={selectedNode?.label ?? ''}
              onChange={(event) => updateSelectedLabel(event.target.value)}
            />
            <p className="panel-hint">
              {selectedNode?.id === rootNode?.id
                ? 'Il s’agit du sujet central de votre carte.'
                : 'Appuyez sur Entrée pour enregistrer rapidement le nouveau titre.'}
            </p>
          </div>

          <div className="panel-section">
            <label className="panel-label" htmlFor="new-idea">
              Ajouter une nouvelle idée liée
            </label>
            <div className="panel-inline">
              <input
                id="new-idea"
                className="panel-input"
                type="text"
                placeholder="Nom de la nouvelle idée"
                value={draftLabel}
                onChange={(event) => setDraftLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addChild()
                  }
                }}
              />
              <button type="button" className="primary-button" onClick={addChild}>
                Ajouter
              </button>
            </div>
            <p className="panel-hint">
              La branche sera reliée à « {selectedNode?.label ?? '...'} ».
            </p>
          </div>

          <div className="panel-section">
            <button
              type="button"
              className="danger-button"
              onClick={removeSelectedBranch}
              disabled={!selectedNode || selectedNode.id === rootNode?.id}
            >
              Supprimer la branche
            </button>
            <p className="panel-hint">Disponible uniquement pour les branches secondaires.</p>
          </div>

          <div className="panel-section">
            <h3 className="panel-subtitle">Astuces rapides</h3>
            <ul className="tips-list">
              <li>Sélectionnez un nœud pour le renommer instantanément.</li>
              <li>Utilisez le bouton « Ajouter » pour créer des idées filles.</li>
              <li>Supprimez une branche pour repartir d&apos;une nouvelle idée.</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default App
