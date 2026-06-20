import React, { useCallback, useRef } from "react";
import TerminalView from "./TerminalView";
import BrowserView from "../../browser/components/BrowserView";
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

  // Split node — renders children with resize handles between them
  const direction = node.direction!;
  const children = node.children!;
  const sizes = node.sizes!;

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
    >
      {children}
    </SplitContainer>
  );
}

interface SplitContainerProps {
  direction: "horizontal" | "vertical";
  children: SplitNode[];
  sizes: number[];
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
  direction,
  children,
  sizes,
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
      }}
    >
      {children.map((child, i) => (
        <React.Fragment key={firstLeafId(child)}>
          {i > 0 && (
            <div
              className="split-handle"
              onMouseDown={handleMouseDown(i - 1)}
              onDoubleClick={() => {
                const eqSize = 1 / children.length;
                onResize(
                  parentPath,
                  children.map(() => eqSize),
                );
              }}
              style={{
                width: direction === "horizontal" ? 4 : "100%",
                height: direction === "vertical" ? 4 : "100%",
                cursor:
                  direction === "horizontal" ? "col-resize" : "row-resize",
                background: "var(--app-border)",
                flexShrink: 0,
                zIndex: 1,
                transition: "background 0.15s",
              }}
            />
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
