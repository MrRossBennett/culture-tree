import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { type ExternalNodeSearchResult, type NodeTypeValue } from "@repo/schemas";
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
import {
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { useDeferredValue, useEffect, useId, useRef, useState } from "react";

import { NodeThumbnail } from "~/components/node-thumbnail";
import { $searchCultureTreeNodes } from "~/server/culture-trees";

function formatEnumLabel(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSourceLabel(source: ExternalNodeSearchResult["identity"]["source"]): string {
  switch (source) {
    case "tmdb":
      return "TMDB";
    case "wikipedia":
      return "Wikipedia";
    case "google-books":
      return "Google Books";
  }
}

const DEFAULT_CONCEPT_TYPE: NodeTypeValue = "article";
const DEFAULT_CONNECTION_TYPE = "thematic";
const CONCEPT_TYPE_OPTIONS: readonly NodeTypeValue[] = [
  "article",
  "person",
  "artist",
  "place",
  "event",
  "publication",
];

type TreeNodeDrawerSubmitInput =
  | {
      kind: "concept";
      name: string;
      type: NodeTypeValue;
      connectionType: "thematic";
      reason: string;
      year?: number;
    }
  | {
      kind: "search-result";
      result: ExternalNodeSearchResult;
      connectionType: "thematic";
      reason: string;
    };

function ResultRow({
  result,
  selected,
  onSelect,
}: {
  readonly result: ExternalNodeSearchResult;
  readonly selected: boolean;
  readonly onSelect: (result: ExternalNodeSearchResult) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(result)}
      className={cn(
        "flex w-full items-start gap-3 border px-3 py-3 text-left transition-colors",
        selected
          ? "border-primary bg-primary/10"
          : "border-border/70 bg-card/60 hover:border-border hover:bg-card",
      )}
    >
      {result.snapshot.image ? (
        <img
          alt=""
          className="size-14 shrink-0 rounded border border-border/60 object-cover"
          referrerPolicy="no-referrer"
          src={result.snapshot.image}
        />
      ) : (
        <div className="flex size-14 shrink-0 items-center justify-center rounded border border-border/60 bg-muted/35 text-[0.65rem] text-muted-foreground uppercase">
          {formatEnumLabel(result.snapshot.type).slice(0, 3)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-heading truncate text-base leading-snug text-foreground">
              {result.snapshot.name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[0.58rem] tracking-wide text-muted-foreground uppercase">
              <span>{formatEnumLabel(result.snapshot.type)}</span>
              <span>{formatSourceLabel(result.identity.source)}</span>
              {result.snapshot.year != null ? <span>{result.snapshot.year}</span> : null}
            </div>
          </div>
          {selected ? <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" /> : null}
        </div>
        {result.meta ? (
          <p className="font-body mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground italic">
            {result.meta}
          </p>
        ) : null}
      </div>
    </button>
  );
}

interface TreeNodeDrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly parentNodeId: string;
  readonly parentLabel: string;
  readonly parentType?: NodeTypeValue;
  readonly parentImageSrc?: string;
  readonly isPending?: boolean;
  readonly onSubmit: (input: TreeNodeDrawerSubmitInput) => void;
}

export function TreeNodeDrawer({
  open,
  onOpenChange,
  parentNodeId,
  parentLabel,
  parentType,
  parentImageSrc,
  isPending = false,
  onSubmit,
}: TreeNodeDrawerProps) {
  const searchId = useId();
  const reasonId = useId();
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const [query, setQuery] = useState("");
  const [conceptType, setConceptType] = useState<NodeTypeValue>(DEFAULT_CONCEPT_TYPE);
  const [reason, setReason] = useState("");
  const [selectedResult, setSelectedResult] = useState<ExternalNodeSearchResult | null>(null);
  const [creatingConcept, setCreatingConcept] = useState(false);
  const [results, setResults] = useState<ExternalNodeSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const deferredQuery = useDeferredValue(query.trim());

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setConceptType(DEFAULT_CONCEPT_TYPE);
    setReason("");
    setSelectedResult(null);
    setCreatingConcept(false);
    setResults([]);
    setSearchError(null);
    setIsSearching(false);
  }, [open, parentNodeId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (deferredQuery.length < 2) {
      setResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const response = await $searchCultureTreeNodes({ data: { query: deferredQuery } });
        if (!cancelled) {
          setResults(response.results);
        }
      } catch (error) {
        if (!cancelled) {
          setSearchError(error instanceof Error ? error.message : "Could not search right now.");
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [deferredQuery, open]);

  useEffect(() => {
    if ((selectedResult != null || creatingConcept) && reasonRef.current) {
      reasonRef.current.focus();
    }
  }, [creatingConcept, selectedResult]);

  const trimmedQuery = query.trim();
  const trimmedReason = reason.trim();
  const title = parentNodeId === "root" ? "Grow a new branch" : "Where next?";
  const description =
    parentNodeId === "root"
      ? `Find the next item from ${parentLabel}.`
      : `Find the next connection from ${parentLabel}.`;
  const canSubmit =
    trimmedReason.length > 0 && (selectedResult != null || creatingConcept) && !isPending;
  const searchActive = selectedResult == null && !creatingConcept;
  const showSearching =
    searchActive && trimmedQuery.length >= 2 && (isSearching || deferredQuery !== trimmedQuery);

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:p-0 data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none sm:data-[vaul-drawer-direction=right]:w-[34rem] sm:data-[vaul-drawer-direction=right]:max-w-none">
        <form
          className="flex h-full min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) {
              return;
            }
            if (selectedResult) {
              onSubmit({
                kind: "search-result",
                result: selectedResult,
                connectionType: DEFAULT_CONNECTION_TYPE,
                reason: trimmedReason,
              });
              return;
            }
            onSubmit({
              kind: "concept",
              name: trimmedQuery,
              type: conceptType,
              connectionType: DEFAULT_CONNECTION_TYPE,
              reason: trimmedReason,
            });
          }}
        >
          <DrawerHeader className="border-b border-border/60 px-6 py-5 text-left">
            <DrawerTitle className="font-heading text-3xl tracking-tight">{title}</DrawerTitle>
            <DrawerDescription className="font-body mt-1 text-lg leading-relaxed text-foreground italic">
              {description}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="overflow-hidden rounded border border-border/60 bg-muted/20">
              <p className="px-4 pt-3 pb-2 font-mono text-[0.6rem] tracking-[0.18em] text-muted-foreground uppercase">
                Origin
              </p>
              <div className="flex items-center gap-3 px-4 pb-3">
                {parentType ? (
                  <NodeThumbnail
                    type={parentType}
                    src={parentImageSrc}
                    size="sm"
                    className="shrink-0 rounded border border-border/60"
                  />
                ) : null}
                <p className="font-heading text-lg leading-snug tracking-tight text-card-foreground md:text-xl">
                  {parentLabel}
                </p>
              </div>
            </div>

            {searchActive ? (
              <div className="space-y-2">
                <Label
                  htmlFor={searchId}
                  className="font-mono text-[0.6rem] font-normal tracking-[0.18em] text-muted-foreground uppercase"
                >
                  Search
                </Label>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    id={searchId}
                    value={query}
                    onChange={(event) => {
                      const next = event.currentTarget.value;
                      setQuery(next);
                      setCreatingConcept(false);
                    }}
                    placeholder="An album, film, book, place, or vibe…"
                    className="font-body h-11 pr-9 pl-9 text-sm"
                    maxLength={160}
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setCreatingConcept(false);
                        setResults([]);
                        setSearchError(null);
                      }}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <XIcon className="size-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {searchActive && trimmedQuery.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[0.6rem] tracking-[0.18em] text-muted-foreground uppercase">
                    Results
                  </p>
                  {showSearching ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                      Searching…
                    </span>
                  ) : null}
                </div>

                {searchError ? (
                  <p className="text-xs text-destructive">{searchError}</p>
                ) : results.length > 0 ? (
                  <div className="space-y-2">
                    {results.map((result) => (
                      <ResultRow
                        key={`${result.identity.source}:${result.identity.externalId}`}
                        result={result}
                        selected={false}
                        onSelect={(next) => {
                          setSelectedResult(next);
                          setCreatingConcept(false);
                          setResults([]);
                          setSearchError(null);
                        }}
                      />
                    ))}
                  </div>
                ) : !showSearching && deferredQuery.length >= 2 ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">No matches yet.</p>
                ) : null}

                {deferredQuery.length >= 2 && !showSearching ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedResult(null);
                      setCreatingConcept(true);
                      setConceptType(DEFAULT_CONCEPT_TYPE);
                      setReason("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded border border-dashed px-3 py-2.5 text-left transition-colors",
                      creatingConcept
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border/70 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2 text-sm">
                      <PlusIcon className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">No good match? Create "{trimmedQuery}"</span>
                    </span>
                    {creatingConcept ? (
                      <CheckIcon className="size-4 shrink-0 text-primary" />
                    ) : null}
                  </button>
                ) : null}
              </div>
            ) : null}

            {selectedResult ? (
              <div className="space-y-3 rounded border border-primary/30 bg-primary/10 p-4">
                <div className="flex items-start gap-3">
                  {selectedResult.snapshot.image ? (
                    <img
                      alt=""
                      className="size-16 shrink-0 border border-border/60 object-cover"
                      referrerPolicy="no-referrer"
                      src={selectedResult.snapshot.image}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[0.6rem] tracking-[0.18em] text-muted-foreground uppercase">
                          Selected
                        </p>
                        <p className="font-heading mt-1 text-base text-foreground">
                          {selectedResult.snapshot.name}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={() => {
                          setSelectedResult(null);
                          setQuery("");
                          setReason("");
                        }}
                      >
                        Change
                      </Button>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatEnumLabel(selectedResult.snapshot.type)}</span>
                      <span>{formatSourceLabel(selectedResult.identity.source)}</span>
                      {selectedResult.snapshot.year != null ? (
                        <span>{selectedResult.snapshot.year}</span>
                      ) : null}
                      {selectedResult.externalUrl ? (
                        <a
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          href={selectedResult.externalUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Source
                          <ExternalLinkIcon className="size-3" aria-hidden />
                        </a>
                      ) : null}
                    </div>
                    {selectedResult.meta ? (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {selectedResult.meta}
                      </p>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Type is set automatically from the selected item.
                </p>
              </div>
            ) : null}

            {creatingConcept ? (
              <div className="rounded border border-border/70 bg-card/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[0.6rem] tracking-[0.18em] text-muted-foreground uppercase">
                      New concept
                    </p>
                    <p className="font-heading mt-1 text-base text-foreground">{trimmedQuery}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => {
                      setCreatingConcept(false);
                      setReason("");
                    }}
                  >
                    Back
                  </Button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Add a quick note and drop it into the branch.
                </p>
                <div className="mt-4 space-y-2">
                  <Label>Type</Label>
                  <Listbox
                    value={conceptType}
                    onChange={setConceptType}
                    as="div"
                    className="relative space-y-2"
                  >
                    <ListboxButton
                      className={cn(
                        "flex h-10 w-full items-center justify-between gap-2 border border-input bg-input/30 px-3 text-sm text-foreground transition-colors outline-none",
                        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      )}
                    >
                      <span>{formatEnumLabel(conceptType)}</span>
                      <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden />
                    </ListboxButton>
                    <ListboxOptions
                      portal={false}
                      modal={false}
                      className={cn(
                        "absolute top-full right-0 left-0 z-[70] mt-1 overflow-hidden border border-border/70 bg-popover p-1 text-popover-foreground shadow-2xl outline-none",
                      )}
                    >
                      {CONCEPT_TYPE_OPTIONS.map((option) => (
                        <ListboxOption
                          key={option}
                          value={option}
                          as="button"
                          type="button"
                          className={({ focus, selected }) =>
                            cn(
                              "flex w-full cursor-default items-center justify-between px-3 py-2 text-left text-sm transition-colors outline-none",
                              focus && "bg-accent text-accent-foreground",
                              selected && "bg-accent/70 text-accent-foreground",
                            )
                          }
                        >
                          {({ selected }) => (
                            <>
                              <span>{formatEnumLabel(option)}</span>
                              <CheckIcon
                                className={cn("size-4", selected ? "visible" : "invisible")}
                                aria-hidden
                              />
                            </>
                          )}
                        </ListboxOption>
                      ))}
                    </ListboxOptions>
                  </Listbox>
                </div>
              </div>
            ) : null}

            {selectedResult != null || creatingConcept ? (
              <>
                <div className="space-y-2">
                  <Label
                    htmlFor={reasonId}
                    className="font-mono text-[0.6rem] font-normal tracking-[0.18em] text-muted-foreground uppercase"
                  >
                    {selectedResult ? "Note" : "Reason"}
                  </Label>
                  <Textarea
                    id={reasonId}
                    ref={reasonRef}
                    value={reason}
                    onChange={(event) => setReason(event.currentTarget.value)}
                    placeholder="Why does this belong on this branch?"
                    rows={5}
                    maxLength={600}
                    className="font-body text-sm italic"
                  />
                </div>
              </>
            ) : null}
          </div>

          <DrawerFooter className="border-t border-border/60 px-6 py-5">
            <Button
              type="submit"
              disabled={!canSubmit}
              className="font-mono text-xs tracking-[0.06em] uppercase"
            >
              {isPending ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : selectedResult ? (
                "Add to tree"
              ) : (
                "Create concept"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="font-mono text-xs tracking-[0.06em] uppercase"
            >
              Cancel
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

export type { TreeNodeDrawerSubmitInput };
