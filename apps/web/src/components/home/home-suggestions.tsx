import { cn } from "@repo/ui/lib/utils";
import { useState } from "react";

import { writeSeedPrompt } from "~/components/home/seed-prompt-storage";

const SUGGESTIONS = [
  "Grimy New York 1970s",
  "Boards of Canada",
  "Wong Kar-wai",
  "Post-punk London",
  "Hiroshi Sugimoto",
  "Stalker (1979)",
  "Laurel Canyon 1969",
] as const;

const AMBER = "var(--color-amber)";
const GREEN = "var(--color-primary)";

function MiniTree({ active }: { readonly active: boolean }) {
  const color = active ? AMBER : GREEN;
  return (
    <svg
      width="14"
      height="18"
      viewBox="0 0 14 18"
      fill="none"
      strokeWidth="1"
      style={{ display: "block", overflow: "visible" }}
    >
      <circle cx="7" cy="16" r="1.5" fill={color} style={{ transition: "fill 0.3s" }} />
      <line
        x1="7"
        y1="16"
        x2="7"
        y2="2"
        stroke={color}
        strokeDasharray="16"
        strokeDashoffset={active ? 0 : 16}
        style={{ transition: "stroke-dashoffset 0.35s cubic-bezier(0.4,0,0.2,1) 0ms, stroke 0.3s" }}
      />
      <line
        x1="7"
        y1="12"
        x2="3"
        y2="8"
        stroke={color}
        strokeDasharray="6"
        strokeDashoffset={active ? 0 : 6}
        style={{
          transition: "stroke-dashoffset 0.28s cubic-bezier(0.4,0,0.2,1) 80ms, stroke 0.3s",
        }}
      />
      <line
        x1="7"
        y1="8"
        x2="11"
        y2="4"
        stroke={color}
        strokeDasharray="6"
        strokeDashoffset={active ? 0 : 6}
        style={{
          transition: "stroke-dashoffset 0.28s cubic-bezier(0.4,0,0.2,1) 150ms, stroke 0.3s",
        }}
      />
      <circle
        cx="7"
        cy="2"
        r={active ? 1.5 : 0}
        fill={AMBER}
        style={{ transition: "r 0.2s cubic-bezier(0.4,0,0.2,1) 300ms" }}
      />
    </svg>
  );
}

function SeedPill({
  label,
  treePosition,
}: {
  readonly label: string;
  readonly treePosition: "top" | "bottom";
}) {
  const [hovered, setHovered] = useState(false);

  const treeEl = (
    <div
      style={{
        height: 22,
        display: "flex",
        alignItems: treePosition === "top" ? "flex-end" : "flex-start",
        justifyContent: "center",
        marginBottom: treePosition === "top" ? 3 : 0,
        marginTop: treePosition === "bottom" ? 3 : 0,
        opacity: hovered ? 1 : 0,
        transform: hovered
          ? "translateY(0) scaleY(1)"
          : treePosition === "top"
            ? "translateY(6px) scaleY(1)"
            : "translateY(-6px) scaleY(1)",
        transition: "opacity 0.25s, transform 0.3s cubic-bezier(0.16,1,0.3,1)",
        pointerEvents: "none",
      }}
    >
      <div style={{ transform: treePosition === "bottom" ? "scaleY(-1)" : undefined }}>
        <MiniTree active={hovered} />
      </div>
    </div>
  );

  return (
    <div className="relative inline-flex flex-col items-center">
      {treePosition === "top" && treeEl}
      <button
        type="button"
        onClick={() => writeSeedPrompt(label)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "rounded-sm px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.04em] transition-colors",
          hovered
            ? "border border-amber/50 text-foreground"
            : "border border-border/50 text-muted-foreground/70",
        )}
        style={{
          boxShadow: hovered
            ? `0 0 12px color-mix(in srgb, var(--color-amber) 20%, transparent)`
            : "none",
          transition: "border-color 0.2s, color 0.2s, box-shadow 0.2s",
        }}
      >
        {label}
      </button>
      {treePosition === "bottom" && treeEl}
    </div>
  );
}

export function HomeSuggestions() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-xl px-4 sm:px-6 md:px-0">
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((label, i) => (
          <SeedPill key={label} label={label} treePosition={i < 4 ? "top" : "bottom"} />
        ))}
      </div>
    </section>
  );
}
