import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react'
import type { Connection, Edge, Node, NodeProps, ReactFlowInstance } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Bot,
  Download,
  Edit3,
  FileQuestion,
  FolderKanban,
  Lightbulb,
  Link2,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  Trash2,
  Upload,
} from 'lucide-react'
import './App.css'
import {
  clearSavedBoard,
  createProject,
  deleteProject,
  loadBoard,
  loadProjects,
  renameProject,
  saveBoard,
  type SavedProject,
} from './lib/boardDb'

type IdeaKind = 'idea' | 'question' | 'task'

type IdeaNodeData = {
  title: string
  body: string
  kind: IdeaKind
  tags: string[]
}

type IdeaNode = Node<IdeaNodeData, 'idea'>

const starterNodes: IdeaNode[] = [
  {
    id: 'seed-1',
    type: 'idea',
    position: { x: 90, y: 180 },
    data: {
      title: 'Inbox',
      body: 'Drop raw thoughts here before shaping them.',
      kind: 'idea',
      tags: ['capture'],
    },
  },
  {
    id: 'seed-2',
    type: 'idea',
    position: { x: 420, y: 180 },
    data: {
      title: 'Promising thread',
      body: 'Connect notes when one idea starts feeding another.',
      kind: 'task',
      tags: ['draft'],
    },
  },
  {
    id: 'seed-3',
    type: 'idea',
    position: { x: 750, y: 180 },
    data: {
      title: 'Open question',
      body: 'What would make this worth building next?',
      kind: 'question',
      tags: ['research'],
    },
  },
]

const starterEdges: Edge[] = [
  {
    id: 'seed-1-seed-2',
    source: 'seed-1',
    target: 'seed-2',
    type: 'smoothstep',
  },
  {
    id: 'seed-2-seed-3',
    source: 'seed-2',
    target: 'seed-3',
    type: 'smoothstep',
  },
]

const defaultEdgeOptions: Partial<Edge> = {
  type: 'smoothstep',
}

const kindIcon = {
  idea: Lightbulb,
  question: FileQuestion,
  task: StickyNote,
}

function IdeaCard({ id, data, selected }: NodeProps<IdeaNode>) {
  const Icon = kindIcon[data.kind]

  return (
    <article className={`idea-node idea-node--${data.kind} ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="node-port node-port--in" />
      <Handle type="source" position={Position.Right} className="node-port node-port--out" />
      <div className="node-topline">
        <span className="node-kind">
          <Icon size={14} />
          {data.kind}
        </span>
        <span className="node-id">{id.slice(-4)}</span>
      </div>
      <h3>{data.title}</h3>
      <p>{data.body}</p>
      <div className="node-tags">
        {data.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </article>
  )
}

function App() {
  const [projects, setProjects] = useState<SavedProject[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [nodes, setNodes] = useState<IdeaNode[]>(starterNodes)
  const [edges, setEdges] = useState<Edge[]>(starterEdges)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>('seed-1')
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingProjectName, setEditingProjectName] = useState('')
  const [boardLoaded, setBoardLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const flowRef = useRef<ReactFlowInstance<IdeaNode, Edge> | null>(null)

  const nodeTypes = useMemo(() => ({ idea: IdeaCard }), [])
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) ?? nodes[0],
    [nodes, selectedId],
  )
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  )
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, projects],
  )

  const filteredNodes = useMemo(() => {
    if (!query.trim()) {
      return nodes
    }

    const needle = query.toLowerCase()
    return nodes.map((node) => {
      const haystack = `${node.data.title} ${node.data.body} ${node.data.tags.join(' ')}`.toLowerCase()
      return {
        ...node,
        className: haystack.includes(needle) ? 'matches-query' : 'misses-query',
      }
    })
  }, [nodes, query])

  useEffect(() => {
    loadProjects().then((savedProjects) => {
      setProjects(savedProjects)
      setActiveProjectId(savedProjects[0]?.id ?? null)
    })
  }, [])

  useEffect(() => {
    if (!activeProjectId) {
      return
    }

    loadBoard(activeProjectId).then((board) => {
      if (board) {
        setNodes(board.nodes as IdeaNode[])
        setEdges(board.edges)
        setSelectedId(board.nodes[0]?.id ?? null)
      } else {
        setNodes(starterNodes)
        setEdges(starterEdges)
        setSelectedId('seed-1')
      }
      setSelectedEdgeId(null)
      setBoardLoaded(true)
    })
  }, [activeProjectId])

  useEffect(() => {
    if (!boardLoaded || !activeProjectId) {
      return
    }

    const handle = window.setTimeout(() => {
      saveBoard(activeProjectId, { nodes, edges, updatedAt: Date.now() })
      setProjects((current) =>
        current.map((project) =>
          project.id === activeProjectId ? { ...project, updatedAt: Date.now() } : project,
        ),
      )
    }, 350)

    return () => window.clearTimeout(handle)
  }, [activeProjectId, boardLoaded, edges, nodes])

  const onNodesChange = useCallback(
    (changes: Parameters<typeof applyNodeChanges<IdeaNode>>[0]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    [],
  )

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof applyEdgeChanges<Edge>>[0]) =>
      setEdges((current) => applyEdgeChanges(changes, current)),
    [],
  )

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
          },
          current,
        ),
      ),
    [],
  )

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) {
      return
    }

    setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId))
    setSelectedEdgeId(null)
  }, [selectedEdgeId])

  const addNode = useCallback(
    (kind: IdeaKind = 'idea') => {
      const id = crypto.randomUUID()
      const viewport = flowRef.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 }
      const position = {
        x: (window.innerWidth / 2 - viewport.x) / viewport.zoom - 140,
        y: (window.innerHeight / 2 - viewport.y) / viewport.zoom - 80,
      }

      const nextNode: IdeaNode = {
        id,
        type: 'idea',
        position,
        data: {
          title: kind === 'question' ? 'New question' : kind === 'task' ? 'New action' : 'New idea',
          body: 'Jot the thought, then connect it to what it belongs with.',
          kind,
          tags: [kind],
        },
      }

      setNodes((current) => [...current, nextNode])
      setSelectedId(id)
      setSelectedEdgeId(null)
    },
    [],
  )

  const addProject = useCallback(async () => {
    const project = await createProject(`Workflow ${projects.length + 1}`)
    setBoardLoaded(false)
    setProjects((current) => [project, ...current])
    setActiveProjectId(project.id)
  }, [projects.length])

  const switchProject = useCallback((projectId: string) => {
    setBoardLoaded(false)
    setActiveProjectId(projectId)
  }, [])

  const removeProject = useCallback(
    async (project: SavedProject) => {
      const shouldDelete = window.confirm(`Delete "${project.name}" and its saved workflow?`)
      if (!shouldDelete) {
        return
      }

      setBoardLoaded(false)
      await deleteProject(project.id)
      const remainingProjects = await loadProjects()
      setProjects(remainingProjects)

      if (project.id === activeProjectId) {
        setActiveProjectId(remainingProjects[0]?.id ?? null)
      }
    },
    [activeProjectId],
  )

  const startRenamingProject = useCallback((project: SavedProject) => {
    setEditingProjectId(project.id)
    setEditingProjectName(project.name)
  }, [])

  const saveProjectName = useCallback(async () => {
    if (!editingProjectId) {
      return
    }

    const trimmedName = editingProjectName.trim()
    if (!trimmedName) {
      setEditingProjectId(null)
      return
    }

    await renameProject(editingProjectId, trimmedName)
    setProjects((current) =>
      current.map((project) =>
        project.id === editingProjectId
          ? { ...project, name: trimmedName, updatedAt: Date.now() }
          : project,
      ),
    )
    setEditingProjectId(null)
  }, [editingProjectId, editingProjectName])

  const cancelProjectRename = useCallback(() => {
    setEditingProjectId(null)
    setEditingProjectName('')
  }, [])

  const updateSelectedNode = useCallback(
    (patch: Partial<IdeaNodeData>) => {
      if (!selectedNode) {
        return
      }

      setNodes((current) =>
        current.map((node) =>
          node.id === selectedNode.id ? { ...node, data: { ...node.data, ...patch } } : node,
        ),
      )
    },
    [selectedNode],
  )

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) {
      return
    }

    setNodes((current) => current.filter((node) => node.id !== selectedNode.id))
    setEdges((current) =>
      current.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id),
    )
    setSelectedId(null)
    setSelectedEdgeId(null)
  }, [selectedNode])

  const linkNodesAsChain = useCallback(() => {
    setNodes((current) =>
      [...current]
        .sort((first, second) => first.position.x - second.position.x || first.position.y - second.position.y)
        .map((node, index) => ({
          ...node,
          position: {
            x: 90 + index * 330,
            y: 180,
          },
        })),
    )

    setEdges(() => {
      const sortedNodes = [...nodes].sort(
        (first, second) => first.position.x - second.position.x || first.position.y - second.position.y,
      )

      return sortedNodes.slice(0, -1).map((node, index) => ({
        id: `chain-${node.id}-${sortedNodes[index + 1].id}`,
        source: node.id,
        target: sortedNodes[index + 1].id,
        type: 'smoothstep',
      }))
    })
  }, [nodes])

  const resetBoard = useCallback(async () => {
    if (!activeProjectId) {
      return
    }

    await clearSavedBoard(activeProjectId)
    setNodes(starterNodes)
    setEdges(starterEdges)
    setSelectedId('seed-1')
    setSelectedEdgeId(null)
  }, [activeProjectId])

  const exportBoard = useCallback(() => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `idea-board-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [edges, nodes])

  const importBoard = useCallback((file: File | undefined) => {
    if (!file) {
      return
    }

    file.text().then((text) => {
      const parsed = JSON.parse(text) as { nodes: IdeaNode[]; edges: Edge[] }
      setNodes(parsed.nodes)
      setEdges(parsed.edges)
      setSelectedId(parsed.nodes[0]?.id ?? null)
      setSelectedEdgeId(null)
    })
  }, [])

  return (
    <main className="app-shell">
      <aside className="left-panel">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Sparkles size={18} />
          </div>
          <div>
            <h1>Idea Nodes</h1>
            <p>Local-first workflow canvas</p>
          </div>
        </div>

        <section className="project-switcher" aria-label="Projects">
          <div className="section-heading">
            <span>Projects</span>
            <button type="button" onClick={addProject} title="Create project">
              <Plus size={14} />
            </button>
          </div>
          <div className="project-list">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`project-row ${project.id === activeProjectId ? 'is-active' : ''}`}
              >
                <button
                  type="button"
                  className="project-select"
                  onClick={() => switchProject(project.id)}
                >
                  <FolderKanban size={15} />
                  {editingProjectId === project.id ? (
                    <input
                      value={editingProjectName}
                      onChange={(event) => setEditingProjectName(event.target.value)}
                      onBlur={saveProjectName}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          saveProjectName()
                        }

                        if (event.key === 'Escape') {
                          event.preventDefault()
                          cancelProjectRename()
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <span>{project.name}</span>
                  )}
                </button>
                <button
                  type="button"
                  className="project-rename"
                  onClick={() => startRenamingProject(project)}
                  title={`Rename ${project.name}`}
                  aria-label={`Rename ${project.name}`}
                >
                  <Edit3 size={13} />
                </button>
                <button
                  type="button"
                  className="project-delete"
                  onClick={() => removeProject(project)}
                  title={`Delete ${project.name}`}
                  aria-label={`Delete ${project.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <label className="search-box">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes"
          />
        </label>

        <div className="quick-actions">
          <button type="button" onClick={() => addNode('idea')} title="Add idea">
            <Plus size={16} />
            Idea
          </button>
          <button type="button" onClick={() => addNode('question')} title="Add question">
            <FileQuestion size={16} />
            Question
          </button>
          <button type="button" onClick={() => addNode('task')} title="Add action">
            <StickyNote size={16} />
            Action
          </button>
          <button type="button" onClick={linkNodesAsChain} title="Arrange and connect as a chain">
            <Link2 size={16} />
            Chain
          </button>
        </div>

        <section className="node-list" aria-label="Board nodes">
          {nodes.map((node) => (
            <button
              type="button"
              key={node.id}
              className={node.id === selectedNode?.id ? 'is-active' : ''}
              onClick={() => {
                setSelectedId(node.id)
                setSelectedEdgeId(null)
                flowRef.current?.setCenter(node.position.x + 140, node.position.y + 90, {
                  duration: 350,
                  zoom: 1,
                })
              }}
            >
              <span>{node.data.title}</span>
              <small>{node.data.tags.join(', ')}</small>
            </button>
          ))}
        </section>

        <div className="panel-footer">
          <button type="button" onClick={exportBoard} title="Export board">
            <Download size={16} />
            Export
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} title="Import board">
            <Upload size={16} />
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={(event) => importBoard(event.target.files?.[0])}
          />
        </div>
      </aside>

      <section className="canvas-wrap">
        <ReactFlow<IdeaNode, Edge>
          nodes={filteredNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={(instance) => {
            flowRef.current = instance
            instance.fitView({ padding: 0.22 })
          }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => {
            setSelectedId(node.id)
            setSelectedEdgeId(null)
          }}
          onEdgeClick={(_, edge) => {
            setSelectedEdgeId(edge.id)
          }}
          onPaneClick={() => {
            setSelectedEdgeId(null)
          }}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          minZoom={0.25}
          maxZoom={1.7}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
          <Controls />
          <MiniMap nodeStrokeWidth={3} pannable zoomable />
          <Panel position="top-center" className="canvas-hint">
            {activeProject?.name ?? 'Workflow'} saves its own nodes and connections.
          </Panel>
        </ReactFlow>
      </section>

      <aside className="right-panel">
        {selectedNode ? (
          <>
            <div className="inspector-heading">
              <div>
                <p>Selected note</p>
                <h2>{selectedNode.data.title}</h2>
              </div>
              <button type="button" onClick={deleteSelectedNode} title="Delete selected note">
                <Trash2 size={16} />
              </button>
            </div>

            <label>
              Title
              <input
                value={selectedNode.data.title}
                onChange={(event) => updateSelectedNode({ title: event.target.value })}
              />
            </label>

            <label>
              Body
              <textarea
                value={selectedNode.data.body}
                onChange={(event) => updateSelectedNode({ body: event.target.value })}
              />
            </label>

            <label>
              Kind
              <select
                value={selectedNode.data.kind}
                onChange={(event) => updateSelectedNode({ kind: event.target.value as IdeaKind })}
              >
                <option value="idea">Idea</option>
                <option value="question">Question</option>
                <option value="task">Action</option>
              </select>
            </label>

            <label>
              Tags
              <input
                value={selectedNode.data.tags.join(', ')}
                onChange={(event) =>
                  updateSelectedNode({
                    tags: event.target.value
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>

            {selectedEdge ? (
              <button
                type="button"
                className="connection-delete-callout"
                onClick={deleteSelectedEdge}
                title="Delete selected connection"
              >
                <Trash2 size={18} />
                <span>
                  <strong>Connection selected</strong>
                  Delete the link between these two notes.
                </span>
              </button>
            ) : (
              <div className="assistant-note">
                <Bot size={18} />
                <p>
                  This panel is ready for an AI summarize/expand action when you want to add OpenAI
                  support.
                </p>
              </div>
            )}

            <button type="button" className="reset-button" onClick={resetBoard}>
              Reset sample board
            </button>
          </>
        ) : (
          <div className="empty-inspector">
            <h2>No note selected</h2>
            <p>Select a node or add a new one to start shaping the board.</p>
          </div>
        )}
      </aside>
    </main>
  )
}

export default function FlowApp() {
  return (
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  )
}
