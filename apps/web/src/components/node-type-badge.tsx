import type { NodeTypeValue } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";

import { nodeTypeIcon } from "~/components/node-thumbnail";

function formatNodeTypeLabel(type: NodeTypeValue): string {
  return type
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function nodeTypeBadgeClassName(type: NodeTypeValue): string {
  switch (type) {
    case "book":
      return "border-amber/40 bg-amber/12 text-amber-700 dark:text-amber-300";
    case "album":
      return "border-sky-500/30 bg-sky-500/12 text-sky-700 dark:text-sky-300";
    case "song":
      return "border-cyan-500/30 bg-cyan-500/12 text-cyan-700 dark:text-cyan-300";
    case "film":
      return "border-rose-500/30 bg-rose-500/12 text-rose-700 dark:text-rose-300";
    case "tv":
      return "border-fuchsia-500/30 bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300";
    case "artist":
      return "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
    case "podcast":
      return "border-violet-500/30 bg-violet-500/12 text-violet-700 dark:text-violet-300";
    case "artwork":
      return "border-pink-500/30 bg-pink-500/12 text-pink-700 dark:text-pink-300";
    case "place":
      return "border-lime-500/30 bg-lime-500/12 text-lime-700 dark:text-lime-300";
    case "event":
      return "border-orange-500/30 bg-orange-500/12 text-orange-700 dark:text-orange-300";
    case "person":
      return "border-teal-500/30 bg-teal-500/12 text-teal-700 dark:text-teal-300";
    case "article":
      return "border-stone-500/30 bg-stone-500/12 text-stone-700 dark:text-stone-300";
  }
}

export function NodeTypeBadge({
  type,
  className,
  showIcon = false,
  asButton = false,
  pressed = false,
  disabled = false,
  onClick,
}: {
  readonly type: NodeTypeValue;
  readonly className?: string;
  readonly showIcon?: boolean;
  readonly asButton?: boolean;
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
}) {
  const Component = asButton ? "button" : "span";

  return (
    <Component
      type={asButton ? "button" : undefined}
      disabled={asButton ? disabled : undefined}
      aria-pressed={asButton ? pressed : undefined}
      onClick={asButton ? onClick : undefined}
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 font-mono text-[0.56rem] leading-none tracking-[0.08em] uppercase",
        asButton &&
          "cursor-pointer transition-[transform,box-shadow,opacity] hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none disabled:cursor-default disabled:opacity-50",
        asButton && !pressed && "opacity-70 hover:opacity-100",
        asButton && pressed && "opacity-100 ring-2 ring-current/20",
        nodeTypeBadgeClassName(type),
        className,
      )}
    >
      {showIcon ? nodeTypeIcon(type, "mr-1 size-3 shrink-0 opacity-80") : null}
      {formatNodeTypeLabel(type)}
    </Component>
  );
}
