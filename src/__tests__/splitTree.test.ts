import {
  leafNode,
  splitNode,
  getNode,
  setNode,
  firstLeafId,
  collectTerminalIds,
  leafPaths,
  pathIndex,
  navigatePath,
  insertLeaves,
  removeLeaf,
  SplitNode,
} from '../renderer/src/features/terminal/splitTree'

describe('splitTree', () => {
  describe('leafNode', () => {
    it('creates a leaf node with terminalId', () => {
      const node = leafNode('term-1')
      expect(node).toEqual({ terminalId: 'term-1' })
    })
  })

  describe('splitNode', () => {
    it('creates a split node with equal sizes', () => {
      const child1 = leafNode('a')
      const child2 = leafNode('b')
      const child3 = leafNode('c')
      const node = splitNode('horizontal', [child1, child2, child3])
      expect(node.direction).toBe('horizontal')
      expect(node.children).toHaveLength(3)
      expect(node.sizes).toEqual([1 / 3, 1 / 3, 1 / 3])
    })

    it('creates vertical split', () => {
      const node = splitNode('vertical', [leafNode('a'), leafNode('b')])
      expect(node.direction).toBe('vertical')
      expect(node.sizes).toEqual([0.5, 0.5])
    })
  })

  describe('getNode', () => {
    const root = splitNode('horizontal', [
      leafNode('term-a'),
      splitNode('vertical', [leafNode('term-b'), leafNode('term-c')]),
    ])

    it('gets root with empty path', () => {
      expect(getNode(root, [])).toBe(root)
    })

    it('gets first-level child', () => {
      const child = getNode(root, [0])
      expect(child.terminalId).toBe('term-a')
    })

    it('gets nested child', () => {
      const child = getNode(root, [1, 0])
      expect(child.terminalId).toBe('term-b')
    })

    it('gets second nested child', () => {
      const child = getNode(root, [1, 1])
      expect(child.terminalId).toBe('term-c')
    })
  })

  describe('setNode', () => {
    const root = splitNode('horizontal', [leafNode('old'), leafNode('b')])

    it('replaces at path and returns new tree', () => {
      const replacement = leafNode('replaced')
      const newRoot = setNode(root, [0], replacement)
      expect(newRoot).not.toBe(root)
      expect(getNode(newRoot, [0]).terminalId).toBe('replaced')
      expect(getNode(newRoot, [1]).terminalId).toBe('b')
    })

    it('replaces nested node', () => {
      const nested = splitNode('horizontal', [
        splitNode('vertical', [leafNode('inner'), leafNode('other')]),
      ])
      const newLeaf = leafNode('pushed')
      const newRoot = setNode(nested, [0, 0], newLeaf)
      expect(getNode(newRoot, [0, 0]).terminalId).toBe('pushed')
    })

    it('replaces root with empty path', () => {
      const newLeaf = leafNode('everything')
      expect(setNode(leafNode('old'), [], newLeaf)).toBe(newLeaf)
    })
  })

  describe('firstLeafId', () => {
    it('returns terminalId from leaf', () => {
      expect(firstLeafId(leafNode('t1'))).toBe('t1')
    })

    it('returns first leaf in split', () => {
      const root = splitNode('vertical', [leafNode('first'), leafNode('second')])
      expect(firstLeafId(root)).toBe('first')
    })

    it('traverses deep nesting', () => {
      const root = splitNode('horizontal', [
        splitNode('vertical', [leafNode('deep'), leafNode('sibling')]),
        leafNode('right'),
      ])
      expect(firstLeafId(root)).toBe('deep')
    })
  })

  describe('collectTerminalIds', () => {
    it('returns single id from leaf', () => {
      expect(collectTerminalIds(leafNode('t'))).toEqual(['t'])
    })

    it('collects all ids from split', () => {
      const root = splitNode('horizontal', [leafNode('a'), leafNode('b')])
      expect(collectTerminalIds(root)).toEqual(['a', 'b'])
    })

    it('collects from nested splits', () => {
      const root = splitNode('horizontal', [
        leafNode('a'),
        splitNode('vertical', [leafNode('b'), leafNode('c')]),
      ])
      expect(new Set(collectTerminalIds(root))).toEqual(new Set(['a', 'b', 'c']))
    })

    it('handles complex trees', () => {
      const root = splitNode('horizontal', [
        splitNode('vertical', [leafNode('1'), leafNode('2')]),
        splitNode('vertical', [leafNode('3'), splitNode('horizontal', [leafNode('4'), leafNode('5')])]),
      ])
      expect(collectTerminalIds(root)).toHaveLength(5)
    })
  })

  describe('leafPaths', () => {
    it('returns empty path for leaf', () => {
      expect(leafPaths(leafNode('t'))).toEqual([[]])
    })

    it('returns paths for each leaf in split', () => {
      const root = splitNode('horizontal', [leafNode('a'), leafNode('b'), leafNode('c')])
      expect(leafPaths(root)).toEqual([[0], [1], [2]])
    })

    it('returns nested paths', () => {
      const root = splitNode('horizontal', [
        leafNode('left'),
        splitNode('vertical', [leafNode('top'), leafNode('bottom')]),
      ])
      expect(leafPaths(root)).toEqual([[0], [1, 0], [1, 1]])
    })
  })

  describe('pathIndex', () => {
    const root = splitNode('horizontal', [leafNode('a'), leafNode('b'), leafNode('c')])

    it('returns index of path in leaf order', () => {
      expect(pathIndex(root, [0])).toBe(0)
      expect(pathIndex(root, [1])).toBe(1)
      expect(pathIndex(root, [2])).toBe(2)
    })

    it('returns -1 for non-existent path', () => {
      expect(pathIndex(root, [3])).toBe(-1)
    })
  })

  describe('navigatePath', () => {
    const root = splitNode('horizontal', [leafNode('a'), leafNode('b'), leafNode('c')])

    it('moves forward by delta', () => {
      expect(navigatePath(root, [0], 1)).toEqual([1])
      expect(navigatePath(root, [1], 1)).toEqual([2])
    })

    it('wraps around forward', () => {
      expect(navigatePath(root, [2], 1)).toEqual([0])
    })

    it('moves backward', () => {
      expect(navigatePath(root, [1], -1)).toEqual([0])
      expect(navigatePath(root, [0], -1)).toEqual([2])
    })

    it('returns current path for empty tree', () => {
      const empty = splitNode('horizontal', [])
      expect(navigatePath(empty, [], 1)).toEqual([])
    })

    it('falls back to first leaf for unknown path', () => {
      expect(navigatePath(root, [99], 0)).toEqual([0])
    })
  })

  describe('insertLeaves', () => {
    describe('root is a leaf', () => {
      it('wraps leaf and new terminal in horizontal split', () => {
        const root = leafNode('existing')
        const result = insertLeaves(root, [], 'horizontal', ['new-1'])
        expect(result.root.direction).toBe('horizontal')
        expect(result.root.children).toHaveLength(2)
        expect(result.focusedPath).toEqual([1])
      })

      it('wraps leaf and new terminal in vertical split', () => {
        const root = leafNode('existing')
        const result = insertLeaves(root, [], 'vertical', ['new-1'])
        expect(result.root.direction).toBe('vertical')
      })

      it('handles multiple new terminals', () => {
        const root = leafNode('existing')
        const result = insertLeaves(root, [], 'horizontal', ['a', 'b'])
        expect(result.root.children).toHaveLength(3)
        expect(result.focusedPath).toEqual([2])
      })
    })

    describe('same direction as parent', () => {
      it('inserts adjacent in horizontal parent', () => {
        const root = splitNode('horizontal', [leafNode('a'), leafNode('b'), leafNode('c')])
        const result = insertLeaves(root, [1], 'horizontal', ['new'])
        expect(result.root.children).toHaveLength(4)
        expect(result.focusedPath).toEqual([2])
        expect(collectTerminalIds(result.root)).toContain('new')
      })
    })

    describe('different direction from parent', () => {
      it('wraps focused leaf in new split of different direction', () => {
        const root = splitNode('horizontal', [leafNode('a'), leafNode('b')])
        const result = insertLeaves(root, [0], 'vertical', ['new'])
        expect(getNode(result.root, [0]).direction).toBe('vertical')
        expect(getNode(result.root, [0]).children).toHaveLength(2)
        expect(result.focusedPath).toEqual([0, 1])
      })
    })
  })

  describe('removeLeaf', () => {
    it('returns null for single leaf', () => {
      expect(removeLeaf(leafNode('only'), []).root).toBeNull()
    })

    it('removes leaf from split with >2 children, returns adjusted siblings', () => {
      const root = splitNode('horizontal', [leafNode('a'), leafNode('b'), leafNode('c')])
      const result = removeLeaf(root, [1])
      expect(result.root).not.toBeNull()
      expect(result.root!.children).toHaveLength(2)
      expect(collectTerminalIds(result.root!)).toEqual(['a', 'c'])
    })

    it('collapses split when only one child remains', () => {
      const root = splitNode('horizontal', [leafNode('a'), leafNode('b')])
      const result = removeLeaf(root, [0])
      expect(result.root).toEqual(leafNode('b'))
      expect(result.newPath).toEqual([])
    })

    it('removes nested leaf and collapses parent if needed', () => {
      const root = splitNode('horizontal', [
        leafNode('left'),
        splitNode('vertical', [
          leafNode('top'),
          leafNode('bottom'),
        ]),
      ])
      const result = removeLeaf(root, [1, 1])
      expect(result.root!.children).toHaveLength(2)
      expect(getNode(result.root!, [1]).terminalId).toBe('top')
    })
  })

  describe('round-trip: insert then remove', () => {
    it('returns to single leaf', () => {
      const root = leafNode('original')
      const { root: withNew } = insertLeaves(root, [], 'horizontal', ['extra'])
      const ids = collectTerminalIds(withNew)
      expect(ids).toContain('original')
      expect(ids).toContain('extra')

      const { root: afterRemove } = removeLeaf(withNew, [0])
      expect(afterRemove).not.toBeNull()
      expect(firstLeafId(afterRemove!)).toBe('extra')
    })
  })
})
