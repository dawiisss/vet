import React, { InputHTMLAttributes, SelectHTMLAttributes, LabelHTMLAttributes } from 'react'

/**
 * Standardized form label with uniform size and Catppuccin subtext color.
 */
export const FormLabel: React.FC<LabelHTMLAttributes<HTMLLabelElement>> = ({ children, style, ...props }) => {
  return (
    <label
      style={{
        fontSize: 12,
        color: '#bac2de',
        display: 'inline-block',
        ...style
      }}
      {...props}
    >
      {children}
    </label>
  )
}

/**
 * Standardized styled input element with dark theme aesthetics.
 */
export const FormInput: React.FC<InputHTMLAttributes<HTMLInputElement>> = ({ style, ...props }) => {
  return (
    <input
      style={{
        background: 'rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '6px 10px',
        borderRadius: 6,
        color: 'var(--app-fg)',
        fontSize: 13,
        outline: 'none',
        ...style
      }}
      {...props}
    />
  )
}

/**
 * Standardized styled select/dropdown element.
 */
export const FormSelect: React.FC<SelectHTMLAttributes<HTMLSelectElement>> = ({ children, style, ...props }) => {
  return (
    <select
      style={{
        background: 'rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '6px 10px',
        borderRadius: 6,
        color: 'var(--app-fg)',
        fontSize: 13,
        outline: 'none',
        ...style
      }}
      {...props}
    >
      {children}
    </select>
  )
}
