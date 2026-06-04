export interface SplitNode {
  terminalId?: string
  direction?: 'horizontal' | 'vertical'
  children?: SplitNode[]
  sizes?: number[]
}

export function leafNode(terminalId: string): SplitNode {
  return { terminalId }
}

export function splitNode(direction: 'horizontal' | 'vertical', children: SplitNode[]): SplitNode {
  return {
    direction,
    children,
    sizes: children.map(() => 1 / children.length)
  }
}

export function getNode(root: SplitNode, path: number[]): SplitNode {
  let node = root
  for (const i of path) {
    node = node.children![i]
  }
  return node
}

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
  return node.terminalId!
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

export function leafPaths(root: SplitNode): number[][] {
  const paths: number[][] = []
  function walk(node: SplitNode, path: number[]): void {
    if (node.terminalId) {
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
  if (path.length === 0) {
    // Root leaf — wrap in new split
    const newLeaves = newTerminalIds.map(leafNode)
    const newSplit = splitNode(direction, [root, ...newLeaves])
    return { root: newSplit, focusedPath: [newLeaves.length] }
  }

  const parentPath = path.slice(0, -1)
  const leafIndex = path[path.length - 1]
  const parent = getNode(root, parentPath)
  const newLeaves = newTerminalIds.map(leafNode)

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
