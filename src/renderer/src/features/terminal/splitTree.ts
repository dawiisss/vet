/**
 * Represents a node in the terminal split-pane tree.
 * The tree structure allows nested splitting of terminals into rows and columns.
 *
 * @remarks
 * A leaf node represents an actual terminal instance and has a `terminalId`.
 * A split node represents a container and has a `direction`, `children`, and `sizes`.
 * The `sizes` array tracks the proportional visual space (0.0 to 1.0) each child
 * occupies, ensuring UI layouts remain consistent when resized.
 */
export interface SplitNode {
  terminalId?: string
  browserId?: string
  url?: string
  direction?: 'horizontal' | 'vertical'
  children?: SplitNode[]
  sizes?: number[]
}

/**
 * Creates a leaf node representing a single, unsplit terminal.
 *
 * @param terminalId - The unique identifier of the terminal process.
 * @returns A terminal leaf node.
 */
export function leafNode(terminalId: string): SplitNode {
  return { terminalId }
}

/**
 * Creates a leaf node representing a single browser view.
 *
 * @param browserId - The unique identifier of the browser view.
 * @returns A browser leaf node.
 */
export function browserLeafNode(browserId: string): SplitNode {
  return { browserId }
}

/**
 * Creates a container node that splits its children uniformly in the given direction.
 *
 * @remarks
 * Initial sizes are distributed equally (e.g., two children get 0.5 each).
 *
 * @param direction - The layout axis ('horizontal' splits columns, 'vertical' splits rows).
 * @param children - The nodes contained within this split.
 * @returns A split container node.
 */
export function splitNode(direction: 'horizontal' | 'vertical', children: SplitNode[]): SplitNode {
  return {
    direction,
    children,
    sizes: children.map(() => 1 / children.length)
  }
}

/**
 * Traverses the split tree to retrieve a node at a specific path.
 *
 * @remarks
 * Paths are represented as an array of indices. E.g., `[0, 1]` means
 * "take the 0th child of the root, then the 1st child of that node".
 *
 * @param root - The starting node of the tree.
 * @param path - The sequence of child indices to reach the target node.
 * @returns The node at the specified path.
 */
export function getNode(root: SplitNode, path: number[]): SplitNode {
  let node = root
  for (const i of path) {
    node = node.children![i]
  }
  return node
}

/**
 * Creates a new tree with a node replaced at the specified path.
 *
 * @remarks
 * This function does not mutate the original tree (immutable structure),
 * making it safe to use with React state managers like Zustand.
 *
 * @param root - The starting node of the tree.
 * @param path - The sequence of child indices pointing to the node to replace.
 * @param replacement - The new node to insert at the path.
 * @returns A new root node with the nested replacement applied.
 */
export function setNode(root: SplitNode, path: number[], replacement: SplitNode): SplitNode {
  if (path.length === 0) return replacement
  const [i, ...rest] = path
  const newChildren = [...root.children!]
  newChildren[i] = setNode(newChildren[i], rest, replacement)
  return { ...root, children: newChildren }
}

export function firstLeafId(root: SplitNode): string {
  let node = root
  while (node.children && node.children.length > 0) {
    node = node.children[0]
  }
  return node.terminalId || node.browserId || ''
}

export function collectTerminalIds(root: SplitNode): string[] {
  const ids: string[] = []
  function walk(node: SplitNode): void {
    if (node.terminalId) {
      ids.push(node.terminalId)
    } else if (node.children) {
      node.children.forEach(walk)
    }
  }
  walk(root)
  return ids
}

export function collectLeafIds(root: SplitNode): string[] {
  const ids: string[] = []
  function walk(node: SplitNode): void {
    if (node.terminalId) {
      ids.push(node.terminalId)
    } else if (node.browserId) {
      ids.push(node.browserId)
    } else if (node.children) {
      node.children.forEach(walk)
    }
  }
  walk(root)
  return ids
}

export function leafCount(root: SplitNode): number {
  if (root.terminalId || root.browserId) return 1
  if (root.children) {
    let count = 0
    for (const child of root.children) count += leafCount(child)
    return count
  }
  return 0
}

export function leafPaths(root: SplitNode): number[][] {
  const paths: number[][] = []
  function walk(node: SplitNode, path: number[]): void {
    if (node.terminalId || node.browserId) {
      paths.push([...path])
    } else if (node.children) {
      node.children.forEach((child, i) => walk(child, [...path, i]))
    }
  }
  walk(root, [])
  return paths
}

export function pathIndex(root: SplitNode, targetPath: number[]): number {
  const paths = leafPaths(root)
  return paths.findIndex(
    (p) => p.length === targetPath.length && p.every((v, i) => v === targetPath[i])
  )
}

export function navigatePath(root: SplitNode, currentPath: number[], delta: number): number[] {
  const paths = leafPaths(root)
  if (paths.length === 0) return currentPath
  const idx = pathIndex(root, currentPath)
  if (idx === -1) return paths[0]
  return paths[(idx + delta + paths.length) % paths.length]
}

export function insertLeaves(
  root: SplitNode,
  path: number[],
  direction: 'horizontal' | 'vertical',
  newTerminalIds: string[]
): { root: SplitNode; focusedPath: number[] } {
  const toNode = (id: string) => id.startsWith('browser-') ? browserLeafNode(id) : leafNode(id)

  if (path.length === 0) {
    // Root leaf — wrap in new split
    const newLeaves = newTerminalIds.map(toNode)
    const newSplit = splitNode(direction, [root, ...newLeaves])
    return { root: newSplit, focusedPath: [newLeaves.length] }
  }

  const parentPath = path.slice(0, -1)
  const leafIndex = path[path.length - 1]
  const parent = getNode(root, parentPath)
  const newLeaves = newTerminalIds.map(toNode)

  if (parent.direction === direction) {
    // Same direction — insert adjacent in the parent
    const insertAt = leafIndex + 1
    const newChildren = [
      ...parent.children!.slice(0, insertAt),
      ...newLeaves,
      ...parent.children!.slice(insertAt)
    ]
    const count = newChildren.length
    const newParent: SplitNode = {
      ...parent,
      children: newChildren,
      sizes: newChildren.map(() => 1 / count)
    }
    const focusedPath = [...parentPath, insertAt + newLeaves.length - 1]
    return { root: setNode(root, parentPath, newParent), focusedPath }
  }

  // Different direction — wrap focused leaf in a new split
  const existingLeaf = getNode(root, path)
  const allLeaves = [existingLeaf, ...newLeaves]
  const newSplit = splitNode(direction, allLeaves)
  const focusedPath = [...path, newLeaves.length]
  return { root: setNode(root, path, newSplit), focusedPath }
}

export function removeLeaf(
  root: SplitNode,
  path: number[]
): { root: SplitNode | null; newPath: number[] } {
  if (path.length === 0) return { root: null, newPath: [] }

  const parentPath = path.slice(0, -1)
  const leafIndex = path[path.length - 1]

  // Removing from a split node
  const parent = getNode(root, parentPath)
  const newChildren = parent.children!.filter((_, i) => i !== leafIndex)

  if (newChildren.length === 0) return { root: null, newPath: [] }

  if (newChildren.length === 1) {
    // Collapse — only one child left, promote it up
    return { root: setNode(root, parentPath, newChildren[0]), newPath: parentPath }
  }

  // Multiple children remain
  const count = newChildren.length
  const newParent: SplitNode = {
    ...parent,
    children: newChildren,
    sizes: newChildren.map(() => 1 / count)
  }
  return { root: setNode(root, parentPath, newParent), newPath: parentPath }
}
