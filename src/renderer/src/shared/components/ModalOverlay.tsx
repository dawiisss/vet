import React, { ReactNode, HTMLAttributes } from "react";

interface ModalOverlayProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * Reusable modal backdrop/overlay component with glassmorphism blur.
 */
export const ModalOverlay: React.FC<ModalOverlayProps> = ({
  children,
  onClick,
  containerRef,
  style,
  ...props
}) => {
  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onClick={onClick}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        outline: "none",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
