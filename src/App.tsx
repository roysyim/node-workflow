import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
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
  FileQuestion,
  Lightbulb,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  Trash2,
  Upload,
} from 'lucide-react'
import './App.css'
import { clearSavedBoard, loadBoard, saveBoard } from './lib/boardDb'

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
    position: { x: 90, y: 110 },
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
    position: { x: 470, y: 80 },
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
    position: { x: 470, y: 300 },
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
    animated: true,
  },
  {
    id: 'seed-1-seed-3',
    source: 'seed-1',
    target: 'seed-3',
    type: 'smoothstep',
  },
]

const kindIcon = {
  idea: Lightbulb,
  question: FileQuestion,
  task: StickyNote,
}

function IdeaCard({ id, data, selected }: NodeProps<IdeaNode>) {
  const Icon = kindIcon[data.kind]

  return (
    <article className={`idea-node idea-node--${data.kind} ${selected ? 'is-selected' : ''}`}>
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
  const [nodes, setNodes] = useState<IdeaNode[]>(starterNodes)
  const [edges, setEdges] = useState<Edge[]>(starterEdges)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>('seed-1')
  const [loaded, setLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const flowRef = useRef<ReactFlowInstance<IdeaNode, Edge> | null>(null)

  const nodeTypes = useMemo(() => ({ idea: IdeaCard }), [])
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) ?? nodes[0],
    [nodes, selectedId],
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
    loadBoard().then((board) => {
      if (board) {
        setNodes(board.nodes as IdeaNode[])
        setEdges(board.edges)
        setSelectedId(board.nodes[0]?.id ?? null)
      }
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!loaded) {
      return
    }

    const handle = window.setTimeout(() => {
      saveBoard({ nodes, edges, updatedAt: Date.now() })
    }, 350)

    return () => window.clearTimeout(handle)
  }, [edges, loaded, nodes])

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
        addEdge({ ...connection, type: 'smoothstep', animated: false }, current),
      ),
    [],
  )

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
    },
    [],
  )

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
  }, [selectedNode])

  const resetBoard = useCallback(async () => {
    await clearSavedBoard()
    setNodes(starterNodes)
    setEdges(starterEdges)
    setSelectedId('seed-1')
  }, [])

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
        </div>

        <section className="node-list" aria-label="Board nodes">
          {nodes.map((node) => (
            <button
              type="button"
              key={node.id}
              className={node.id === selectedNode?.id ? 'is-active' : ''}
              onClick={() => {
                setSelectedId(node.id)
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
          onNodeClick={(_, node) => setSelectedId(node.id)}
          fitView
          minZoom={0.25}
          maxZoom={1.7}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
          <Controls />
          <MiniMap nodeStrokeWidth={3} pannable zoomable />
          <Panel position="top-center" className="canvas-hint">
            Drag nodes, connect handles, and let the board autosave.
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

            <div className="assistant-note">
              <Bot size={18} />
              <p>
                This panel is ready for an AI summarize/expand action when you want to add OpenAI
                support.
              </p>
            </div>

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
