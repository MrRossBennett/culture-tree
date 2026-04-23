import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { type ExternalNodeSearchResult, type NodeTypeValue } from "@repo/schemas";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";
import {
  CheckIcon,
  ChevronDownIcon,
  LoaderCircleIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { NodeTypeBadge } from "~/components/node-type-badge";
import { $searchCultureTreeNodes } from "~/server/culture-trees";

function formatEnumLabel(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const DEFAULT_CONCEPT_TYPE: NodeTypeValue = "article";
const DEFAULT_CONNECTION_TYPE = "thematic";
const SEARCH_DEBOUNCE_MS = 350;
const CONCEPT_TYPE_OPTIONS: readonly NodeTypeValue[] = [
  "article",
  "person",
  "artist",
  "place",
  "event",
];

type TreeNodePopoverSubmitInput =
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
  disabled,
  onSelect,
}: {
  readonly result: ExternalNodeSearchResult;
  readonly disabled: boolean;
  readonly onSelect: (result: ExternalNodeSearchResult) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(result)}
      className={cn(
        "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
        "disabled:pointer-events-none disabled:opacity-60",
        "border-border/70 bg-card/60 hover:border-border hover:bg-card",
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="font-heading min-w-0 flex-1 truncate text-[0.95rem] leading-snug text-foreground">
          {result.snapshot.name}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <NodeTypeBadge type={result.snapshot.type} />
          {result.snapshot.year != null ? (
            <span className="font-mono text-[0.58rem] tracking-wide text-muted-foreground tabular-nums">
              {result.snapshot.year}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function typeLabel(type: NodeTypeValue): string {
  return type
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

interface TreeNodePopoverProps {
  readonly triggerLabel: string;
  readonly triggerClassName?: string;
  readonly isPending?: boolean;
  readonly onSubmit: (input: TreeNodePopoverSubmitInput) => Promise<void>;
}

export function TreeNodePopover({
  triggerLabel,
  triggerClassName,
  isPending = false,
  onSubmit,
}: TreeNodePopoverProps) {
  const [open, setOpen] = useState(false);
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsPaneRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [conceptType, setConceptType] = useState<NodeTypeValue>(DEFAULT_CONCEPT_TYPE);
  const [creatingConcept, setCreatingConcept] = useState(false);
  const [results, setResults] = useState<ExternalNodeSearchResult[]>([]);
  const [activeResultType, setActiveResultType] = useState<NodeTypeValue | null>(null);
  const [showResultsFade, setShowResultsFade] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const trimmedQuery = query.trim();
  const searchActive = !creatingConcept;
  const showSearching = searchActive && trimmedQuery.length >= 2 && isSearching;
  const showResultsSection =
    searchActive &&
    (showSearching || Boolean(searchError) || results.length > 0 || trimmedQuery.length >= 2);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setConceptType(DEFAULT_CONCEPT_TYPE);
      setCreatingConcept(false);
      setResults([]);
      setActiveResultType(null);
      setShowResultsFade(false);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || creatingConcept) {
      return;
    }
    if (trimmedQuery.length < 2) {
      setResults([]);
      setActiveResultType(null);
      setShowResultsFade(false);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchError(null);

    const queryToSearch = trimmedQuery;
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await $searchCultureTreeNodes({ data: { query: queryToSearch } });
        if (!cancelled) {
          console.log("tree node search results", {
            query: queryToSearch,
            results: response.results,
          });
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
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [creatingConcept, open, trimmedQuery]);

  useEffect(() => {
    if (activeResultType == null) {
      return;
    }

    const hasMatchingResult = results.some((result) => result.snapshot.type === activeResultType);
    if (!hasMatchingResult) {
      setActiveResultType(null);
    }
  }, [activeResultType, results]);

  const resultTypeFilters = Array.from(new Set(results.map((result) => result.snapshot.type))).sort(
    (left, right) => typeLabel(left).localeCompare(typeLabel(right)),
  );

  const filteredResults =
    activeResultType == null
      ? results
      : results.filter((result) => result.snapshot.type === activeResultType);

  useEffect(() => {
    const resultsPane = resultsPaneRef.current;
    if (!resultsPane || filteredResults.length === 0) {
      setShowResultsFade(false);
      return;
    }

    const updateFadeVisibility = () => {
      const remainingScroll =
        resultsPane.scrollHeight - resultsPane.clientHeight - resultsPane.scrollTop;
      setShowResultsFade(remainingScroll > 6);
    };

    updateFadeVisibility();
    resultsPane.addEventListener("scroll", updateFadeVisibility, { passive: true });
    window.addEventListener("resize", updateFadeVisibility);

    return () => {
      resultsPane.removeEventListener("scroll", updateFadeVisibility);
      window.removeEventListener("resize", updateFadeVisibility);
    };
  }, [filteredResults, open]);

  const handleSelectResult = async (result: ExternalNodeSearchResult) => {
    if (isPending) {
      return;
    }

    await onSubmit({
      kind: "search-result",
      result,
      connectionType: DEFAULT_CONNECTION_TYPE,
      reason: "",
    });
    setOpen(false);
  };

  const handleCreateConcept = async () => {
    if (isPending || trimmedQuery.length === 0) {
      return;
    }

    await onSubmit({
      kind: "concept",
      name: trimmedQuery,
      type: conceptType,
      connectionType: DEFAULT_CONNECTION_TYPE,
      reason: "",
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="amber"
            size="xs"
            className={cn("rounded-sm font-mono tracking-[0.04em] uppercase", triggerClassName)}
          />
        }
      >
        {triggerLabel}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionAvoidance={{
          side: "none",
          align: "shift",
          fallbackAxisSide: "none",
        }}
        sideOffset={8}
        className="w-[min(30rem,calc(100vw-2rem))] gap-0 p-4"
      >
        <div className="space-y-4">
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
                  ref={inputRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.currentTarget.value);
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
                      setActiveResultType(null);
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

          {showResultsSection ? (
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

              {searchError ? <p className="text-xs text-destructive">{searchError}</p> : null}

              {results.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveResultType(null)}
                      aria-pressed={activeResultType == null}
                      className={cn(
                        "inline-flex items-center rounded border px-2 py-0.5 font-mono text-[0.56rem] leading-none tracking-[0.08em] uppercase transition-[transform,box-shadow,opacity]",
                        "hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                        activeResultType == null
                          ? "border-foreground/20 bg-foreground text-background"
                          : "border-border/70 bg-card/60 text-muted-foreground opacity-70 hover:opacity-100",
                      )}
                    >
                      All
                    </button>
                    {resultTypeFilters.map((type) => (
                      <NodeTypeBadge
                        key={type}
                        type={type}
                        asButton
                        pressed={activeResultType === type}
                        disabled={isPending}
                        onClick={() =>
                          setActiveResultType((current) => (current === type ? null : type))
                        }
                      />
                    ))}
                  </div>
                  <p className="text-[0.7rem] text-muted-foreground">
                    {filteredResults.length} result{filteredResults.length === 1 ? "" : "s"}
                    {activeResultType ? ` in ${typeLabel(activeResultType).toLowerCase()}` : ""}
                  </p>
                </div>
              ) : null}

              {results.length > 0 ? (
                <div className="relative">
                  <div ref={resultsPaneRef} className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                    {filteredResults.map((result) => (
                      <ResultRow
                        key={`${result.identity.source}:${result.identity.externalId}`}
                        result={result}
                        disabled={isPending}
                        onSelect={(next) => {
                          void handleSelectResult(next);
                        }}
                      />
                    ))}
                  </div>
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-xl bg-linear-to-t from-popover/64 via-popover/30 to-transparent transition-opacity",
                      showResultsFade ? "opacity-100" : "opacity-0",
                    )}
                  />
                </div>
              ) : showSearching ? (
                <div className="flex min-h-28 items-center justify-center rounded-xl border border-border/60 bg-card/30">
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                    Looking for matches…
                  </span>
                </div>
              ) : !showSearching && trimmedQuery.length >= 2 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">No matches yet.</p>
              ) : null}

              {trimmedQuery.length >= 2 && !showSearching ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    setCreatingConcept(true);
                    setConceptType(DEFAULT_CONCEPT_TYPE);
                  }}
                  className="w-full justify-start gap-2 border-dashed font-mono text-[0.65rem] tracking-[0.04em] uppercase"
                >
                  <PlusIcon className="size-4" aria-hidden />
                  Create concept instead
                </Button>
              ) : null}
            </div>
          ) : null}

          {creatingConcept ? (
            <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-4">
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
                  onClick={() => setCreatingConcept(false)}
                >
                  Back
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Listbox
                  value={conceptType}
                  onChange={setConceptType}
                  as="div"
                  className="relative space-y-2"
                >
                  <ListboxButton
                    className={cn(
                      "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-input/30 px-3 text-sm text-foreground transition-colors outline-none",
                      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    )}
                  >
                    <span>{formatEnumLabel(conceptType)}</span>
                    <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden />
                  </ListboxButton>
                  <ListboxOptions
                    portal={false}
                    modal={false}
                    className="absolute top-full right-0 left-0 z-[70] mt-1 overflow-hidden rounded-xl border border-border/70 bg-popover p-1 text-popover-foreground shadow-2xl outline-none"
                  >
                    {CONCEPT_TYPE_OPTIONS.map((option) => (
                      <ListboxOption
                        key={option}
                        value={option}
                        as="button"
                        type="button"
                        className={({ focus, selected }) =>
                          cn(
                            "flex w-full cursor-default items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors outline-none",
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

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Search and select is the fastest path. Use this when nothing fits.
                </p>
                <Button
                  type="button"
                  disabled={isPending || trimmedQuery.length === 0}
                  onClick={() => {
                    void handleCreateConcept();
                  }}
                  className="shrink-0 font-mono text-[0.65rem] tracking-[0.04em] uppercase"
                >
                  {isPending ? (
                    <>
                      <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                      Creating…
                    </>
                  ) : (
                    "Create"
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export type { TreeNodePopoverSubmitInput };
