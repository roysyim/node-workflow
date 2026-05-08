import Dexie, { type Table } from 'dexie'
import type { Edge, Node } from '@xyflow/react'

export type SavedBoard = {
  id: string
  nodes: Node[]
  edges: Edge[]
  updatedAt: number
}

class IdeaBoardDb extends Dexie {
  boards!: Table<SavedBoard, string>

  constructor() {
    super('idea-node-workflow')
    this.version(1).stores({
      boards: 'id, updatedAt',
    })
  }
}

const db = new IdeaBoardDb()
const defaultBoardId = 'local-board'

export async function loadBoard() {
  return db.boards.get(defaultBoardId)
}

export async function saveBoard(board: Omit<SavedBoard, 'id'>) {
  return db.boards.put({ ...board, id: defaultBoardId })
}

export async function clearSavedBoard() {
  return db.boards.delete(defaultBoardId)
}
