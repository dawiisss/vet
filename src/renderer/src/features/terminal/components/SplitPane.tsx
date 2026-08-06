import React, { useCallback, useRef, useState } from "react";
import TerminalView from "./TerminalView";
import BrowserView from "../../browser/components/BrowserView";
import EditorView from "../../workspace/components/EditorView";
import { getNode, firstLeafId } from "../splitTree";
import type { SplitNode } from "../splitTree";

interface SplitPaneProps {
  node: SplitNode;
  path: number[];
  focusedPath: number[];
  isActive: boolean;
  onFocus: (path: number[]) => void;
  onExit: (terminalId: string) => void;
  onResize: (path: number[], newSizes: number[]) => void;
  onExtract?: ((path: number[]) => void) | undefined;
  onContextMenuAction?: (
    (path: number[], action: "split-h" | "split-v" | "close") => void
  ) | undefined;
  leafCount?: number | undefined;
}

import { pathsEqual } from "../../../../../shared/utils/pathUtils";

function SplitPane({
  node,
  path,
  focusedPath,
  isActive,
  onFocus,
  onExit,
  onResize,
  onExtract,
  onContextMenuAction,
  leafCount,
}: SplitPaneProps) {
  if (!node) return null;

  if (node.terminalId) {
    const focused = isActive && pathsEqual(path, focusedPath);
    return (
      <div style={{ flex: 1, overflow: "hidden", minWidth: 0, minHeight: 0 }}>
        <TerminalView
          terminalId={node.terminalId}
          isActive={isActive}
          isFocused={focused}
          onFocus={() => onFocus(path)}
          onExit={(id) => onExit(id)}
          onExtract={onExtract ? () => onExtract(path) : undefined}
          onContextMenuAction={
            onContextMenuAction
              ? (action) => onContextMenuAction(path, action)
              : undefined
          }
        />
      </div>
    );
  }

  if (node.browserId) {
    const focused = isActive && pathsEqual(path, focusedPath);
    return (
      <div style={{ flex: 1, overflow: "hidden", minWidth: 0, minHeight: 0 }}>
        <BrowserView
          browserId={node.browserId}
          initialUrl={node.url}
          isActive={isActive}
          isFocused={focused}
          onFocus={() => onFocus(path)}
          onExit={(id) => onExit(id)}
          onExtract={onExtract ? () => onExtract(path) : undefined}
          onContextMenuAction={
            onContextMenuAction
              ? (action) => onContextMenuAction(path, action)
              : undefined
          }
        />
      </div>
    );
  }

  if (node.editorId) {
    const focused = isActive && pathsEqual(path, focusedPath);
    return (
      <div style={{ flex: 1, overflow: "hidden", minWidth: 0, minHeight: 0 }}>
        <EditorView
          editorId={node.editorId}
          filePath={node.filePath!}
          sshHostId={node.sshHostId}
          isActive={isActive}
          isFocused={focused}
          onFocus={() => onFocus(path)}
          onExit={() => onExit(node.editorId!)}
          onExtract={onExtract ? () => onExtract(path) : undefined}
          onContextMenuAction={
            onContextMenuAction
              ? (action) => onContextMenuAction(path, action)
              : undefined
          }
        />
      </div>
    );
  }

  // Split node — renders children with resize handles between them
  const direction = node.direction || "horizontal";
  const children = node.children || [];
  const sizes = node.sizes || [];

  return (
    <SplitContainer
      direction={direction}
      sizes={sizes}
      parentPath={path}
      focusedPath={focusedPath}
      isActive={isActive}
      onFocus={onFocus}
      onExit={onExit}
      onResize={onResize}
      onExtract={onExtract}
      leafCount={leafCount}
      childrenNodes={children}
    />
  );
}

interface SplitContainerProps {
  direction?: "horizontal" | "vertical" | undefined;
  childrenNodes?: SplitNode[] | undefined;
  sizes?: number[] | undefined;
  parentPath: number[];
  focusedPath: number[];
  isActive: boolean;
  onFocus: (path: number[]) => void;
  onExit: (terminalId: string) => void;
  onResize: (path: number[], newSizes: number[]) => void;
  onExtract?: ((path: number[]) => void) | undefined;
  onContextMenuAction?: (
    (path: number[], action: "split-h" | "split-v" | "close") => void
  ) | undefined;
  leafCount?: number | undefined;
}

function SplitContainer({
  direction = "horizontal",
  childrenNodes = [],
  sizes = [],
  parentPath,
  focusedPath,
  isActive,
  onFocus,
  onExit,
  onResize,
  onExtract,
  onContextMenuAction,
  leafCount,
}: SplitContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const draggingRef = useRef<{
    index: number;
    startSizes: number[];
    startPos: number;
  } | null>(null);

  const handleMouseDown = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const isH = direction === "horizontal";
      const startPos = isH ? e.clientX : e.clientY;
      const containerSize = isH ? rect.width : rect.height;

      draggingRef.current = { index, startSizes: [...sizes], startPos };
      setDraggingIndex(index);

      const handleMouseMove = (ev: MouseEvent) => {
        const drag = draggingRef.current;
        if (!drag) return;

        const currentPos = isH ? ev.clientX : ev.clientY;
        const deltaRatio = (currentPos - drag.startPos) / containerSize;

        const newSizes = [...drag.startSizes];
        const idx = drag.index;
        const startSizeIdx = drag.startSizes[idx]!;
        const startSizeNext = drag.startSizes[idx + 1]!;
        const totalSize = startSizeIdx + startSizeNext;
        const minSize = 0.05;

        newSizes[idx] = Math.max(
          minSize,
          Math.min(
            startSizeIdx + deltaRatio,
            totalSize - minSize,
          ),
        );
        newSizes[idx + 1] = totalSize - newSizes[idx]!;

        onResize(parentPath, newSizes);
      };

      const handleMouseUp = () => {
        draggingRef.current = null;
        setDraggingIndex(null);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor =
        direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [sizes, direction, parentPath, onResize],
  );

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: direction === "horizontal" ? "row" : "column",
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      {childrenNodes.map((child, i) => (
        <React.Fragment key={firstLeafId(child)}>
          {i > 0 && (
            <div
              className={`split-handle ${draggingIndex === i - 1 ? "dragging" : ""}`}
              onMouseDown={handleMouseDown(i - 1)}
              onDoubleClick={() => {
                const eqSize = 1 / childrenNodes.length;
                onResize(
                  parentPath,
                  childrenNodes.map(() => eqSize),
                );
              }}
              title="Drag to resize split, double-click to equalize"
              style={{
                width: direction === "horizontal" ? 4 : "100%",
                height: direction === "vertical" ? 4 : "100%",
                cursor:
                  direction === "horizontal" ? "col-resize" : "row-resize",
                background: "var(--app-border)",
                flexShrink: 0,
                zIndex: 2,
                position: "relative",
                transition: "background 0.15s",
              }}
            >
              {draggingIndex === i - 1 && (
                <div
                  style={{
                    position: "absolute",
                    left: direction === "horizontal" ? "50%" : "50%",
                    top: direction === "vertical" ? "50%" : "50%",
                    transform: "translate(-50%, -50%)",
                    background: "var(--app-bg, #1e1e2e)",
                    border: "1px solid var(--app-blue)",
                    color: "var(--app-blue)",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: "bold",
                    pointerEvents: "none",
                    zIndex: 10,
                    whiteSpace: "nowrap",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                  }}
                >
                  {Math.round((sizes[i - 1] || 0) * 100)}% / {Math.round((sizes[i] || 0) * 100)}%
                </div>
              )}
            </div>
          )}
          <div
            style={{
              display: "flex",
              flex: sizes[i] ?? 1,
              overflow: "hidden",
              minWidth: 0,
              minHeight: 0,
            }}
          >
            <SplitPane
              node={child}
              path={[...parentPath, i]}
              focusedPath={focusedPath}
              isActive={isActive}
              onFocus={onFocus}
              onExit={onExit}
              onResize={onResize}
              onExtract={onExtract}
              onContextMenuAction={onContextMenuAction}
              leafCount={leafCount}
            />
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

export default SplitPane;
