import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldProps = {
  label?: React.ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * Form field wrapper: label + control + error/hint text. Keeps spacing and
 * error presentation consistent across forms.
 */
function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      {label ? (
        <Label htmlFor={htmlFor}>
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs font-semibold text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs font-medium text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export { Field };
