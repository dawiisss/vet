import React, {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  LabelHTMLAttributes,
} from "react";

/**
 * Standardized form label with uniform size and Catppuccin subtext color.
 */
export const FormLabel: React.FC<LabelHTMLAttributes<HTMLLabelElement>> = ({
  children,
  style,
  ...props
}) => {
  return (
    <label
      style={{
        fontSize: "var(--font-size-sm)",
        color: "var(--app-fg-subtle)",
        display: "inline-block",
        ...style,
      }}
      {...props}
    >
      {children}
    </label>
  );
};

/**
 * Standardized styled input element with dark theme aesthetics.
 */
export const FormInput: React.FC<InputHTMLAttributes<HTMLInputElement>> = ({
  style,
  ...props
}) => {
  return (
    <input
      style={{
        background: "rgba(0, 0, 0, 0.2)",
        border: "1px solid var(--app-border)",
        padding: "var(--spacing-xs) var(--spacing-sm)",
        borderRadius: "var(--border-radius-md)",
        color: "var(--app-fg)",
        fontSize: "var(--font-size-sm)",
        outline: "none",
        ...style,
      }}
      {...props}
    />
  );
};

/**
 * Standardized styled select/dropdown element.
 */
export const FormSelect: React.FC<SelectHTMLAttributes<HTMLSelectElement>> = ({
  children,
  style,
  ...props
}) => {
  return (
    <select
      style={{
        background: "rgba(0, 0, 0, 0.2)",
        border: "1px solid var(--app-border)",
        padding: "var(--spacing-xs) var(--spacing-sm)",
        borderRadius: "var(--border-radius-md)",
        color: "var(--app-fg)",
        fontSize: "var(--font-size-sm)",
        outline: "none",
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  );
};
