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
