import { type ExternalNodeSearchResult, type NodeTypeValue } from "@repo/schemas";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { LoaderCircleIcon, SearchIcon, SparklesIcon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

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

interface TreeNodeDialogProps {
  readonly triggerLabel: string;
  readonly triggerClassName?: string;
  readonly triggerIcon?: ReactNode;
  readonly triggerVariant?: "amber" | "default" | "outline" | "secondary" | "ghost";
  readonly title?: string;
  readonly isPending?: boolean;
  readonly isAiPending?: boolean;
  readonly onAiSubmit?: (input: TreeNodePopoverSubmitInput) => Promise<void>;
  readonly onSubmit: (input: TreeNodePopoverSubmitInput) => Promise<void>;
}

export function TreeNodeDialog({
  triggerLabel,
  triggerClassName,
  triggerIcon,
  triggerVariant = "outline",
  title = "Add Branch",
  isPending = false,
  isAiPending = false,
  onAiSubmit,
  onSubmit,
}: TreeNodeDialogProps) {
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
  const suggestedAiResult = filteredResults.at(0);

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

  const handleSubmitResult = async (
    result: ExternalNodeSearchResult,
    submit: (input: TreeNodePopoverSubmitInput) => Promise<void>,
  ) => {
    if (isPending || isAiPending) {
      return;
    }

    await submit({
      kind: "search-result",
      result,
      connectionType: DEFAULT_CONNECTION_TYPE,
      reason: "",
    });
    setOpen(false);
  };

  const handleSelectResult = async (result: ExternalNodeSearchResult) => {
    await handleSubmitResult(result, onSubmit);
  };

  const handleAiSubmit = async () => {
    if (!onAiSubmit || !suggestedAiResult) {
      return;
    }

    await handleSubmitResult(suggestedAiResult, onAiSubmit);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant={triggerVariant}
        size="sm"
        className={cn("rounded-sm font-mono tracking-[0.04em] uppercase", triggerClassName)}
        onClick={() => setOpen(true)}
      >
        {triggerIcon ? <span data-icon="inline-start">{triggerIcon}</span> : null}
        {triggerLabel}
      </Button>
      <DialogContent className="grid h-[min(44rem,calc(100vh-2rem))] max-h-[calc(100vh-2rem)] w-[min(78rem,calc(100vw-2rem))] max-w-none gap-0 overflow-hidden rounded-2xl border border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.18_0.012_125)] p-0 text-[oklch(0.91_0.014_125)] shadow-2xl ring-1 ring-[oklch(0.95_0.01_120/0.06)] sm:max-w-none md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-h-0 flex-col bg-[oklch(0.18_0.012_125)]">
          <DialogHeader className="border-b border-[oklch(0.9_0.01_120/0.1)] px-6 pt-6 pb-5">
            <DialogTitle className="font-heading text-2xl leading-tight tracking-tight text-[oklch(0.95_0.012_125)]">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-[oklch(0.9_0.01_120/0.58)]">
              Find a recognized cultural subject and add it as the next Branch.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-5 px-6 py-5">
            <div className="space-y-2">
              <Label
                htmlFor={searchId}
                className="font-mono text-[0.6rem] font-normal tracking-[0.18em] text-[oklch(0.9_0.01_120/0.48)] uppercase"
              >
                Search
              </Label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[oklch(0.9_0.01_120/0.42)]" />
                  <Input
                    id={searchId}
                    ref={inputRef}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.currentTarget.value);
                    }}
                    placeholder="A film, album, book, artist, place..."
                    className="font-body h-11 border-[oklch(0.9_0.01_120/0.12)] bg-[oklch(0.95_0.01_120/0.06)] pr-9 pl-9 text-sm text-[oklch(0.95_0.012_125)] placeholder:text-[oklch(0.9_0.01_120/0.38)] focus-visible:ring-[oklch(0.82_0.11_100/0.45)]"
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
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-[oklch(0.9_0.01_120/0.52)] transition-colors hover:text-[oklch(0.95_0.012_125)]"
                      aria-label="Clear search"
                    >
                      <XIcon className="size-4" />
                    </button>
                  ) : null}
                </div>
                {onAiSubmit ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="amber"
                          size="icon-lg"
                          disabled={!suggestedAiResult || isPending || isAiPending}
                          aria-label="Grow with AI"
                          onClick={() => {
                            void handleAiSubmit();
                          }}
                        />
                      }
                    >
                      {isAiPending ? (
                        <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <SparklesIcon className="size-4" aria-hidden />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>Grow with AI</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[0.6rem] tracking-[0.18em] text-[oklch(0.9_0.01_120/0.48)] uppercase">
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
                    disabled={isPending || isAiPending}
                    onSelectAll={() => setActiveResultType(null)}
                    onToggleType={(type) =>
                      setActiveResultType((current) => (current === type ? null : type))
                    }
                  />
                  <p className="text-[0.7rem] text-[oklch(0.9_0.01_120/0.5)]">
                    {filteredResults.length} result{filteredResults.length === 1 ? "" : "s"}
                    {activeResultType ? ` in ${typeLabel(activeResultType).toLowerCase()}` : ""}
                  </p>
                </div>
              ) : null}

              {results.length > 0 ? (
                <div className="relative min-h-0 flex-1">
                  <div ref={resultsPaneRef} className="h-full space-y-1.5 overflow-y-auto pr-1">
                    {filteredResults.map((result) => (
                      <ResultRow
                        key={`${result.identity.source}:${result.identity.externalId}`}
                        result={result}
                        disabled={isPending || isAiPending}
                        onSelect={(next) => {
                          void handleSelectResult(next);
                        }}
                      />
                    ))}
                  </div>
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-xl bg-linear-to-t from-[oklch(0.18_0.012_125)] via-[oklch(0.18_0.012_125/0.42)] to-transparent transition-opacity",
                      showResultsFade ? "opacity-100" : "opacity-0",
                    )}
                  />
                </div>
              ) : showSearching ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.95_0.01_120/0.05)]">
                  <span className="inline-flex items-center gap-2 text-xs text-[oklch(0.9_0.01_120/0.58)]">
                    <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                    Looking for matches...
                  </span>
                </div>
              ) : !showSearching && trimmedQuery.length >= 2 ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.95_0.01_120/0.05)]">
                  <p className="text-xs leading-relaxed text-[oklch(0.9_0.01_120/0.58)]">
                    No matches yet.
                  </p>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.95_0.01_120/0.05)]" />
              )}
            </div>
          </div>
        </div>

        <aside className="hidden min-h-0 flex-col border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.21_0.012_125)] md:flex md:border-l">
          <div className="border-b border-[oklch(0.9_0.01_120/0.1)] px-6 py-5">
            <span className="rounded-full border border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.95_0.01_120/0.05)] px-2.5 py-1 font-mono text-[0.6rem] tracking-[0.08em] text-[oklch(0.9_0.01_120/0.64)] uppercase">
              Branch
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-8 px-6 py-6">
            <div className="space-y-3">
              <p className="font-heading text-2xl leading-tight tracking-tight text-[oklch(0.95_0.012_125)]">
                Add to this tree
              </p>
              <p className="text-sm leading-relaxed text-[oklch(0.9_0.01_120/0.58)]">
                Search across films, albums, books, artists, places, and cultural scenes.
              </p>
            </div>
          </div>
        </aside>
      </DialogContent>
    </Dialog>
  );
}

export type { TreeNodePopoverSubmitInput };
