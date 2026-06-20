import React from "react";

interface PanelProps {
  id?: string;
  title?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  tabIndex?: number;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  hasScrollableBody?: boolean;
}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(function Panel(
  {
    id,
    title,
    headerActions,
    children,
    onKeyDown,
    tabIndex,
    style,
    bodyStyle,
    hasScrollableBody = true,
  },
  ref
) {
  return (
    <div
      id={id}
      ref={ref}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      className="panel-container"
      style={{
        outline: "none",
        padding: 12,
        color: "var(--app-fg)",
        fontSize: 13,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {title && (
        <div
          className="panel-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 12,
            alignItems: "center",
          }}
        >
          <h3
            className="panel-title"
            style={{ margin: 0, fontSize: 14, color: "#bac2de" }}
          >
            {title}
          </h3>
          {headerActions && (
            <div className="panel-header-actions" style={{ display: "flex", gap: 6 }}>
              {headerActions}
            </div>
          )}
        </div>
      )}
      {hasScrollableBody ? (
        <div
          className="panel-body app-scrollbar"
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            ...bodyStyle,
          }}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
});

export default Panel;
