"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-moss focus:ring-2 focus:ring-moss/20",
        className
      )}
      {...props}
    />
  );
}

type NumberInputProps = Omit<InputProps, "type" | "value" | "onChange"> & {
  value: number;
  onValueChange: (value: number) => void;
};

/**
 * Number field that can be cleared while typing. It keeps the typed text and only reports valid numbers, so
 * clearing the box doesn't force a 0 into it (which left values like "02000"). Leaving it empty restores the value.
 */
export function NumberInput({ value, onValueChange, onBlur, ...props }: NumberInputProps) {
  const [text, setText] = useState(String(value));

  // Follow outside changes (reset, saves elsewhere) without disturbing what's being typed for the same number.
  useEffect(() => {
    setText((current) => (current.trim() !== "" && Number(current) === value ? current : String(value)));
  }, [value]);

  return (
    <Input
      {...props}
      type="number"
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const parsed = Number(next);
        if (next.trim() !== "" && Number.isFinite(parsed)) onValueChange(parsed);
      }}
      onBlur={(event) => {
        setText(String(value));
        onBlur?.(event);
      }}
    />
  );
}

/** Password field with the standard eye button to show or hide what was typed. */
export function PasswordInput({ className, ...props }: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-10", className)} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted transition hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-moss/30"
      >
        <Icon size={17} />
      </button>
    </div>
  );
}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-moss focus:ring-2 focus:ring-moss/20",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-[0.10em] text-muted">
      {children}
    </label>
  );
}
