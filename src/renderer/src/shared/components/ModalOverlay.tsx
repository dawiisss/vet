import React, { ReactNode, HTMLAttributes, useRef } from "react";
import { useEscapeKey } from "@/shared/hooks/useEscapeKey";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";

interface ModalOverlayProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  onClose?: () => void;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  trapFocus?: boolean;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * Reusable modal backdrop/overlay component with glassmorphism blur.
 */
export const ModalOverlay: React.FC<ModalOverlayProps> = ({
  children,
  onClose,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  trapFocus = true,
  containerRef,
  onClick,
  style,
  ...props
}) => {
  const defaultRef = useRef<HTMLDivElement>(null);
  const actualRef = containerRef || defaultRef;

  // Handle Escape key
  useEscapeKey(() => {
    if (onClose && closeOnEsc) {
      onClose();
    }
  }, !!onClose && closeOnEsc);

  // Handle focus trapping
  useFocusTrap(actualRef, trapFocus);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) {
      onClick(e);
    }
    if (onClose && closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      ref={actualRef}
      tabIndex={-1}
      onClick={handleOverlayClick}
      className="app-modal-overlay"
      style={style}
      {...props}
    >
      {children}
    </div>
  );
};

