import React from "react";
import { FormLabel } from "@/shared/components/FormComponents";

interface SettingsFieldProps {
  htmlFor: string;
  label: string;
  description?: string;
  flex?: string | number;
  children: React.ReactNode;
}

export const SettingsField: React.FC<SettingsFieldProps> = ({
  htmlFor,
  label,
  description,
  flex,
  children,
}) => {
  return (
    <div
      className="settings-field-group"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        flex: flex,
      }}
    >
      <FormLabel htmlFor={htmlFor} className="settings-field-label">
        {label}
      </FormLabel>
      {description && (
        <p
          className="settings-field-description"
          style={{
            margin: "0 0 4px 0",
            fontSize: 11,
            color: "var(--app-fg-muted)",
          }}
        >
          {description}
        </p>
      )}
      {children}
    </div>
  );
};

export default SettingsField;
