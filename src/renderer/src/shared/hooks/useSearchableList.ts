import { useState, useEffect, useRef } from "react";

export interface UseSearchableListOptions<T> {
  items: T[];
  filterFn: (item: T, query: string) => boolean;
  onSelect: (item: T) => void;
  isOpen?: boolean;
}

export function useSearchableList<T>({
  items,
  filterFn,
  onSelect,
  isOpen = true,
}: UseSearchableListOptions<T>) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const filteredItems = items.filter((item) => filterFn(item, query));

  // Reset selectedIndex when query or items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, items]);

  // Reset when isOpen changes (e.g. command palette opening/closing)
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl && typeof selectedEl.scrollIntoView === "function") {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredItems.length === 0) return;

    if (e.key === "ArrowDown") {
      setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      const selected = filteredItems[selectedIndex];
      if (selected) {
        onSelect(selected);
      }
      e.preventDefault();
    }
  };

  return {
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    filteredItems,
    handleKeyDown,
    listRef,
  };
}
export default useSearchableList;
