import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@repo/ui/lib/utils";
import * as React from "react";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded border border-input bg-input/30 px-3 py-1 text-lg transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-lg placeholder:text-muted-foreground focus-visible:border-amber/50 focus-visible:shadow-[0_0_12px_color-mix(in_srgb,var(--color-amber)_20%,transparent)] focus-visible:ring-[3px] focus-visible:ring-amber/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
