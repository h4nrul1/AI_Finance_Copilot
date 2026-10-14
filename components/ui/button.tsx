"use client";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-moss/30 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "border-moss bg-moss text-white hover:bg-ink",
        variant === "secondary" && "border-line bg-white text-ink hover:border-moss hover:bg-paper",
        variant === "ghost" && "border-transparent bg-transparent text-muted hover:bg-paper hover:text-ink",
        variant === "danger" && "border-coral bg-coral text-white hover:bg-ink",
        size === "sm" && "h-8 px-3",
        size === "md" && "h-10 px-4",
        size === "icon" && "h-9 w-9",
        className
      )}
      {...props}
    />
  );
}
