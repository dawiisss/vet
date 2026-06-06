import { useClipboardStore } from '../renderer/src/features/clipboard/useClipboardStore'

describe('useClipboardStore', () => {
  beforeEach(() => {
    // Clear the store before each test
    useClipboardStore.getState().clear()
  })

  it('adds an item correctly', () => {
    const store = useClipboardStore.getState()
    store.add('test snippet')

    const newStore = useClipboardStore.getState()
    expect(newStore.history.length).toBe(1)
    expect(newStore.history[0].text).toBe('test snippet')
    expect(newStore.history[0].id).toBeDefined()
    expect(newStore.history[0].timestamp).toBeDefined()
  })

  it('does not add empty or whitespace-only strings', () => {
    const store = useClipboardStore.getState()
    store.add('')
    store.add('   ')

    const newStore = useClipboardStore.getState()
    expect(newStore.history.length).toBe(0)
  })

  it('does not add consecutive duplicate items', () => {
    const store = useClipboardStore.getState()
    store.add('duplicate')
    store.add('duplicate')

    const newStore = useClipboardStore.getState()
    expect(newStore.history.length).toBe(1)
    expect(newStore.history[0].text).toBe('duplicate')
  })

  it('adds non-consecutive duplicates correctly', () => {
    const store = useClipboardStore.getState()
    store.add('duplicate')
    store.add('other')
    store.add('duplicate')

    const newStore = useClipboardStore.getState()
    expect(newStore.history.length).toBe(3)
    expect(newStore.history[0].text).toBe('duplicate')
    expect(newStore.history[1].text).toBe('other')
    expect(newStore.history[2].text).toBe('duplicate')
  })

  it('respects the maxItems limit', () => {
    const store = useClipboardStore.getState()

    // Default limit is 50, but we can't easily mock the internal get() call
    // without overriding Zustand state, so we just add 51 items.
    for (let i = 0; i < 51; i++) {
      store.add(`item ${i}`)
    }

    const newStore = useClipboardStore.getState()
    expect(newStore.history.length).toBe(50)

    // The most recently added item should be at the top
    expect(newStore.history[0].text).toBe('item 50')

    // The oldest item ('item 0') should have been pushed out
    expect(newStore.history[49].text).toBe('item 1')
  })

  it('removes an item by id', () => {
    const store = useClipboardStore.getState()

    // Add items with a mock timestamp or ensure they have different IDs
    // Date.now() can be identical if executed very fast
    const originalDateNow = Date.now;
    let mockTime = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      mockTime += 1000;
      return mockTime;
    });

    store.add('to remove')
    store.add('to keep')

    let currentStore = useClipboardStore.getState()
    const idToRemove = currentStore.history.find(i => i.text === 'to remove')?.id

    expect(idToRemove).toBeDefined()

    currentStore.remove(idToRemove!)

    currentStore = useClipboardStore.getState()
    expect(currentStore.history.length).toBe(1)
    expect(currentStore.history[0].text).toBe('to keep')

    jest.spyOn(Date, 'now').mockRestore();
  })

  it('clears all items', () => {
    const store = useClipboardStore.getState()
    store.add('item 1')
    store.add('item 2')

    let currentStore = useClipboardStore.getState()
    expect(currentStore.history.length).toBe(2)

    currentStore.clear()

    currentStore = useClipboardStore.getState()
    expect(currentStore.history.length).toBe(0)
  })
})
