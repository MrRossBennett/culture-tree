import type { NodeTypeValue } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";

export const CULTURE_TREE_NODE_TYPES = [
  "book",
  "album",
  "song",
  "film",
  "tv",
  "artist",
  "podcast",
  "artwork",
  "place",
  "event",
  "person",
  "article",
] as const satisfies readonly NodeTypeValue[];

function formatNodeTypeLabel(type: NodeTypeValue): string {
  return type
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function nodeTypeFilterColorClassName(type: NodeTypeValue, selected: boolean): string {
  switch (type) {
    case "book":
      return selected
        ? "border-amber/50 bg-amber text-amber-foreground"
        : "border-amber/25 text-amber-700/60 hover:border-amber/45 hover:bg-amber/8 hover:text-amber-700 dark:text-amber-300/60 dark:hover:text-amber-300";
    case "album":
      return selected
        ? "border-sky-500/45 bg-sky-500 text-white"
        : "border-sky-500/25 text-sky-700/60 hover:border-sky-500/45 hover:bg-sky-500/8 hover:text-sky-700 dark:text-sky-300/60 dark:hover:text-sky-300";
    case "song":
      return selected
        ? "border-cyan-500/45 bg-cyan-500 text-white"
        : "border-cyan-500/25 text-cyan-700/60 hover:border-cyan-500/45 hover:bg-cyan-500/8 hover:text-cyan-700 dark:text-cyan-300/60 dark:hover:text-cyan-300";
    case "film":
      return selected
        ? "border-rose-500/45 bg-rose-500 text-white"
        : "border-rose-500/25 text-rose-700/60 hover:border-rose-500/45 hover:bg-rose-500/8 hover:text-rose-700 dark:text-rose-300/60 dark:hover:text-rose-300";
    case "tv":
      return selected
        ? "border-fuchsia-500/45 bg-fuchsia-500 text-white"
        : "border-fuchsia-500/25 text-fuchsia-700/60 hover:border-fuchsia-500/45 hover:bg-fuchsia-500/8 hover:text-fuchsia-700 dark:text-fuchsia-300/60 dark:hover:text-fuchsia-300";
    case "artist":
      return selected
        ? "border-emerald-500/45 bg-emerald-500 text-white"
        : "border-emerald-500/25 text-emerald-700/60 hover:border-emerald-500/45 hover:bg-emerald-500/8 hover:text-emerald-700 dark:text-emerald-300/60 dark:hover:text-emerald-300";
    case "podcast":
      return selected
        ? "border-violet-500/45 bg-violet-500 text-white"
        : "border-violet-500/25 text-violet-700/60 hover:border-violet-500/45 hover:bg-violet-500/8 hover:text-violet-700 dark:text-violet-300/60 dark:hover:text-violet-300";
    case "artwork":
      return selected
        ? "border-pink-500/45 bg-pink-500 text-white"
        : "border-pink-500/25 text-pink-700/60 hover:border-pink-500/45 hover:bg-pink-500/8 hover:text-pink-700 dark:text-pink-300/60 dark:hover:text-pink-300";
    case "place":
      return selected
        ? "border-lime-500/45 bg-lime-500 text-lime-950"
        : "border-lime-500/25 text-lime-700/60 hover:border-lime-500/45 hover:bg-lime-500/8 hover:text-lime-700 dark:text-lime-300/60 dark:hover:text-lime-300";
    case "event":
      return selected
        ? "border-orange-500/45 bg-orange-500 text-white"
        : "border-orange-500/25 text-orange-700/60 hover:border-orange-500/45 hover:bg-orange-500/8 hover:text-orange-700 dark:text-orange-300/60 dark:hover:text-orange-300";
    case "person":
      return selected
        ? "border-teal-500/45 bg-teal-500 text-white"
        : "border-teal-500/25 text-teal-700/60 hover:border-teal-500/45 hover:bg-teal-500/8 hover:text-teal-700 dark:text-teal-300/60 dark:hover:text-teal-300";
    case "article":
      return selected
        ? "border-stone-500/45 bg-stone-500 text-white"
        : "border-stone-500/25 text-stone-700/60 hover:border-stone-500/45 hover:bg-stone-500/8 hover:text-stone-700 dark:text-stone-300/60 dark:hover:text-stone-300";
  }
}

export function NodeTypeFilterList({
  types = CULTURE_TREE_NODE_TYPES,
  selectedTypes,
  allSelected,
  disabled = false,
  allLabel = "All",
  size = "sm",
  onSelectAll,
  onToggleType,
}: {
  readonly types?: readonly NodeTypeValue[];
  readonly selectedTypes: readonly NodeTypeValue[];
  readonly allSelected: boolean;
  readonly disabled?: boolean;
  readonly allLabel?: string;
  readonly size?: "sm" | "md";
  readonly onSelectAll: () => void;
  readonly onToggleType: (type: NodeTypeValue) => void;
}) {
  const chipSizeClassName =
    size === "md" ? "min-h-7 px-3 py-1 text-[0.66rem]" : "px-2 py-0.5 text-[0.56rem] leading-none";

  return (
    <div className={cn("flex flex-wrap", size === "md" ? "gap-2" : "gap-1.5")}>
      <button
        type="button"
        disabled={disabled}
        onClick={onSelectAll}
        aria-pressed={allSelected}
        className={cn(
          "inline-flex items-center rounded border font-mono tracking-[0.08em] uppercase transition-[transform,box-shadow,opacity]",
          "hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none disabled:cursor-default disabled:opacity-50",
          chipSizeClassName,
          allSelected
            ? "border-foreground/20 bg-foreground text-background"
            : "border-border/40 bg-transparent text-muted-foreground/45 opacity-100 hover:border-border hover:bg-card/30 hover:text-muted-foreground",
        )}
      >
        {allLabel}
      </button>
      {types.map((type) => (
        <NodeTypeFilterChip
          key={type}
          type={type}
          selected={selectedTypes.includes(type)}
          disabled={disabled}
          size={size}
          onClick={() => onToggleType(type)}
        />
      ))}
    </div>
  );
}

export function CulturalMixSelector({
  selectedTypes,
  disabled = false,
  size = "sm",
  className,
  onSelectedTypesChange,
}: {
  readonly selectedTypes: readonly NodeTypeValue[];
  readonly disabled?: boolean;
  readonly size?: "sm" | "md";
  readonly className?: string;
  readonly onSelectedTypesChange: (types: NodeTypeValue[]) => void;
}) {
  const allSelected = selectedTypes.length === CULTURE_TREE_NODE_TYPES.length;

  const toggleType = (type: NodeTypeValue) => {
    if (selectedTypes.length === CULTURE_TREE_NODE_TYPES.length) {
      onSelectedTypesChange([type]);
      return;
    }

    if (selectedTypes.includes(type)) {
      onSelectedTypesChange(
        selectedTypes.length === 1
          ? [...selectedTypes]
          : selectedTypes.filter((item) => item !== type),
      );
      return;
    }

    onSelectedTypesChange([...selectedTypes, type]);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <p className="font-mono text-[0.6rem] tracking-[0.18em] text-muted-foreground uppercase">
        Cultural mix
      </p>
      <NodeTypeFilterList
        selectedTypes={selectedTypes}
        allSelected={allSelected}
        disabled={disabled}
        size={size}
        onSelectAll={() => onSelectedTypesChange([...CULTURE_TREE_NODE_TYPES])}
        onToggleType={toggleType}
      />
    </div>
  );
}

function NodeTypeFilterChip({
  type,
  selected,
  disabled,
  size,
  onClick,
}: {
  readonly type: NodeTypeValue;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly size: "sm" | "md";
  readonly onClick: () => void;
}) {
  const chipSizeClassName =
    size === "md" ? "min-h-7 px-3 py-1 text-[0.66rem]" : "px-2 py-0.5 text-[0.56rem] leading-none";

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded border font-mono tracking-[0.08em] uppercase transition-[transform,box-shadow,opacity]",
        "hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none disabled:cursor-default disabled:opacity-50",
        chipSizeClassName,
        selected ? "shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" : "bg-transparent opacity-100",
        nodeTypeFilterColorClassName(type, selected),
      )}
    >
      {formatNodeTypeLabel(type)}
    </button>
  );
}

export function mediaFilterFromSelectedNodeTypes(
  selectedTypes: readonly NodeTypeValue[],
): NodeTypeValue[] | undefined {
  if (selectedTypes.length === CULTURE_TREE_NODE_TYPES.length) {
    return undefined;
  }

  return [...selectedTypes];
}
