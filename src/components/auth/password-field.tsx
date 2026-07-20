"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PasswordFieldProps = Omit<
  React.ComponentProps<typeof Input>,
  "id" | "type"
> & {
  id: string;
  label: string;
  description?: string;
  error?: string;
};

export function PasswordField({
  id,
  label,
  description,
  error,
  className,
  disabled,
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [props["aria-describedby"], descriptionId, errorId]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <LockKeyhole
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          disabled={disabled}
          aria-invalid={error ? true : props["aria-invalid"]}
          aria-describedby={describedBy}
          className={cn("h-11 px-10 text-[0.95rem]", className)}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {description && !error && (
        <p id={descriptionId} className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs leading-relaxed text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
