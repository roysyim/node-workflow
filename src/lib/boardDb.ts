import Dexie, { type Table } from 'dexie'
import type { Edge, Node } from '@xyflow/react'

export type SavedBoard = {
  id: string
  nodes: Node[]
  edges: Edge[]
  updatedAt: number
}

export type SavedProject = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

class IdeaBoardDb extends Dexie {
  boards!: Table<SavedBoard, string>
  projects!: Table<SavedProject, string>

  constructor() {
    super('idea-node-workflow')
    this.version(1).stores({
      boards: 'id, updatedAt',
    })
    this.version(2).stores({
      boards: 'id, updatedAt',
      projects: 'id, updatedAt',
    })
  }
}

const db = new IdeaBoardDb()
const defaultBoardId = 'local-board'

export async function ensureDefaultProject() {
  const projects = await db.projects.orderBy('updatedAt').reverse().toArray()

  if (projects.length > 0) {
    return projects
  }

  const now = Date.now()
  const defaultProject: SavedProject = {
    id: defaultBoardId,
    name: 'First workflow',
    createdAt: now,
    updatedAt: now,
  }

  await db.projects.put(defaultProject)
  return [defaultProject]
}

export async function loadProjects() {
  const projects = await ensureDefaultProject()
  return projects.sort((first, second) => second.updatedAt - first.updatedAt)
}

export async function createProject(name: string) {
  const now = Date.now()
  const project: SavedProject = {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
  }

  await db.projects.put(project)
  return project
}

export async function deleteProject(projectId: string) {
  await db.transaction('rw', db.projects, db.boards, async () => {
    await db.projects.delete(projectId)
    await db.boards.delete(projectId)
  })
}

export async function renameProject(projectId: string, name: string) {
  await touchProject(projectId, name)
}

export async function touchProject(id: string, name?: string) {
  const project = await db.projects.get(id)
  if (!project) {
    return
  }

  await db.projects.put({
    ...project,
    name: name ?? project.name,
    updatedAt: Date.now(),
  })
}

export async function loadBoard(projectId: string) {
  return db.boards.get(projectId)
}

export async function saveBoard(projectId: string, board: Omit<SavedBoard, 'id'>) {
  await db.boards.put({ ...board, id: projectId })
  await touchProject(projectId)
}

export async function clearSavedBoard(projectId: string) {
  return db.boards.delete(projectId)
}
