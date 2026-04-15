import {
  ConnectionType,
  NodeType,
  type ConnectionTypeValue,
  type NodeTypeValue,
} from "@repo/schemas";
import { Button } from "@repo/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@repo/ui/components/drawer";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";
import { LoaderCircleIcon } from "lucide-react";
import { useId, useState } from "react";

function formatEnumLabel(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const NODE_TYPE_OPTIONS = NodeType.options;
const CONNECTION_TYPE_OPTIONS = ConnectionType.options;

function ChoiceGrid<Value extends string>({
  value,
  onChange,
  options,
  columns = 2,
}: {
  readonly value: Value;
  readonly onChange: (value: Value) => void;
  readonly options: readonly Value[];
  readonly columns?: 2 | 3;
}) {
  return (
    <div
      className={cn("grid gap-2", columns === 2 && "grid-cols-2", columns === 3 && "grid-cols-3")}
      role="radiogroup"
    >
      {options.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={cn(
              "min-h-10 rounded-2xl border px-3 py-2 text-left text-sm transition-colors",
              "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              selected
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-input/30 text-muted-foreground hover:bg-input/50 hover:text-foreground",
            )}
          >
            {formatEnumLabel(option)}
          </button>
        );
      })}
    </div>
  );
}

interface TreeNodeDrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly parentNodeId: string;
  readonly parentLabel: string;
  readonly isPending?: boolean;
  readonly onSubmit: (input: {
    name: string;
    type: NodeTypeValue;
    connectionType: ConnectionTypeValue;
    reason: string;
    year?: number;
  }) => void;
}

export function TreeNodeDrawer({
  open,
  onOpenChange,
  parentNodeId,
  parentLabel,
  isPending = false,
  onSubmit,
}: TreeNodeDrawerProps) {
  const nameId = useId();
  const yearId = useId();
  const reasonId = useId();
  const [name, setName] = useState("");
  const [type, setType] = useState<NodeTypeValue>("book");
  const [connectionType, setConnectionType] = useState<ConnectionTypeValue>("thematic");
  const [reason, setReason] = useState("");
  const [year, setYear] = useState("");

  const trimmedName = name.trim();
  const trimmedReason = reason.trim();
  const canSubmit = trimmedName.length > 0 && trimmedReason.length > 0 && !isPending;
  const title = parentNodeId === "root" ? "Add top-level branch" : "Add child node";
  const description =
    parentNodeId === "root"
      ? `This will append a new first-level branch under ${parentLabel}.`
      : `This will append a new child node under ${parentLabel}.`;

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:p-0 data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none sm:data-[vaul-drawer-direction=right]:w-[30rem] sm:data-[vaul-drawer-direction=right]:max-w-none">
        <form
          key={`${parentNodeId}:${open ? "open" : "closed"}`}
          className="flex h-full min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) {
              return;
            }
            const parsedYear = year.trim().length > 0 ? Number(year) : undefined;
            onSubmit({
              name: trimmedName,
              type,
              connectionType,
              reason: trimmedReason,
              year: parsedYear != null && Number.isFinite(parsedYear) ? parsedYear : undefined,
            });
          }}
        >
          <DrawerHeader className="border-b border-border/60 px-6 py-5 text-left">
            <DrawerTitle className="font-heading text-2xl">{title}</DrawerTitle>
            <DrawerDescription className="font-body text-sm leading-relaxed">
              {description}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="rounded-2xl border border-border/70 bg-muted/35 px-4 py-3">
              <p className="font-mono text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase">
                Parent
              </p>
              <p className="font-body mt-1 text-sm text-foreground">{parentLabel}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={nameId}>Name</Label>
              <Input
                id={nameId}
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                placeholder="A work, place, event, or person"
                maxLength={160}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <ChoiceGrid value={type} onChange={setType} options={NODE_TYPE_OPTIONS} />
              </div>

              <div className="space-y-2">
                <Label>Connection</Label>
                <ChoiceGrid
                  value={connectionType}
                  onChange={setConnectionType}
                  options={CONNECTION_TYPE_OPTIONS}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={reasonId}>Reason</Label>
              <Textarea
                id={reasonId}
                value={reason}
                onChange={(event) => setReason(event.currentTarget.value)}
                placeholder="Why does this belong on this branch?"
                rows={5}
                maxLength={600}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={yearId}>Year</Label>
              <Input
                id={yearId}
                type="number"
                inputMode="numeric"
                min={0}
                max={3000}
                value={year}
                onChange={(event) => setYear(event.currentTarget.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <DrawerFooter className="border-t border-border/60 px-6 py-5">
            <Button type="submit" disabled={!canSubmit}>
              {isPending ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Add node"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
