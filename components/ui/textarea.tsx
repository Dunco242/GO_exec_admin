"use client";

import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  rows?: number;
  className?: string;
  id?: string;
  placeholder?: string;
  value?: string | number | readonly string[] | undefined;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ id, value, onChange, placeholder, rows = 3, className = "" }, ref) => {
    return (
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        ref={ref}
        className={`block w-full rounded-md border p-2 ${className}`}
      />
    );
  }
);

Textarea.displayName = "Textarea";
