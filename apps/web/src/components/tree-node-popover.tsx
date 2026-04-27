import { type ExternalNodeSearchResult, type NodeTypeValue } from "@repo/schemas";
import { Button } from "@repo/ui/components/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@repo/ui/components/drawer";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { cn } from "@repo/ui/lib/utils";
import { LoaderCircleIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { NodeThumbnail } from "~/components/node-thumbnail";
import { NodeTypeBadge } from "~/components/node-type-badge";
import { NodeTypeFilterList } from "~/components/node-type-filter-list";
import { $searchCultureTreeNodes } from "~/server/culture-trees";

const DEFAULT_CONNECTION_TYPE = "thematic";
const SEARCH_DEBOUNCE_MS = 350;

type TreeNodePopoverSubmitInput = {
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
        "group w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
        "disabled:pointer-events-none disabled:opacity-60",
        "border-border/70 bg-card/60 hover:border-primary/35 hover:bg-accent/45 focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <NodeThumbnail
            type={result.snapshot.type}
            src={result.snapshot.image}
            size="sm"
            className="size-7 rounded-none object-cover"
          />
          <p className="font-heading min-w-0 flex-1 truncate text-[0.95rem] leading-snug text-foreground">
            {result.snapshot.name}
          </p>
        </div>
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

interface TreeNodeDrawerProps {
  readonly triggerLabel: string;
  readonly triggerClassName?: string;
  readonly isPending?: boolean;
  readonly onSubmit: (input: TreeNodePopoverSubmitInput) => Promise<void>;
}

export function TreeNodeDrawer({
  triggerLabel,
  triggerClassName,
  isPending = false,
  onSubmit,
}: TreeNodeDrawerProps) {
  const [open, setOpen] = useState(false);
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsPaneRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExternalNodeSearchResult[]>([]);
  const [activeResultType, setActiveResultType] = useState<NodeTypeValue | null>(null);
  const [showResultsFade, setShowResultsFade] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const trimmedQuery = query.trim();
  const showSearching = trimmedQuery.length >= 2 && isSearching;
  const showResultsSection =
    showSearching || Boolean(searchError) || results.length > 0 || trimmedQuery.length >= 2;

  useEffect(() => {
    if (!open) {
      setQuery("");
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
    if (!open) {
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
  }, [open, trimmedQuery]);

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

    setQuery("");
    setResults([]);
    setActiveResultType(null);
    setSearchError(null);
    inputRef.current?.focus();
    await onSubmit({
      kind: "search-result",
      result,
      connectionType: DEFAULT_CONNECTION_TYPE,
      reason: "",
    });
  };

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <Button
        type="button"
        variant="amber"
        size="sm"
        className={cn("rounded-sm font-mono tracking-[0.04em] uppercase", triggerClassName)}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      <DrawerContent className="w-[min(34rem,calc(100vw-1rem))] sm:max-w-lg">
        <DrawerHeader>
          <DrawerTitle className="font-heading text-xl">Grow new branch</DrawerTitle>
        </DrawerHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
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

          {showResultsSection ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[0.6rem] tracking-[0.18em] text-muted-foreground uppercase">
                  Results
                </p>
              </div>

              {searchError ? <p className="text-xs text-destructive">{searchError}</p> : null}

              {results.length > 0 ? (
                <div className="space-y-2">
                  <NodeTypeFilterList
                    types={resultTypeFilters}
                    selectedTypes={activeResultType ? [activeResultType] : []}
                    allSelected={activeResultType == null}
                    disabled={isPending}
                    onSelectAll={() => setActiveResultType(null)}
                    onToggleType={(type) =>
                      setActiveResultType((current) => (current === type ? null : type))
                    }
                  />
                  <p className="text-[0.7rem] text-muted-foreground">
                    {filteredResults.length} result{filteredResults.length === 1 ? "" : "s"}
                    {activeResultType ? ` in ${typeLabel(activeResultType).toLowerCase()}` : ""}
                  </p>
                </div>
              ) : null}

              {results.length > 0 ? (
                <div className="relative">
                  <div
                    ref={resultsPaneRef}
                    className="max-h-[calc(100vh-18rem)] space-y-1.5 overflow-y-auto pr-1"
                  >
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
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export type { TreeNodePopoverSubmitInput };
