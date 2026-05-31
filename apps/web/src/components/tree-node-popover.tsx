import { type ExternalNodeSearchResult, type NodeTypeValue, type TreeItem } from "@repo/schemas";
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
import {
  CheckIcon,
  ChevronDownIcon,
  LoaderCircleIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { NodeThumbnail } from "~/components/node-thumbnail";
import { NodeTypeBadge } from "~/components/node-type-badge";
import { NodeTypeFilterList } from "~/components/node-type-filter-list";
import { addToTreeShortcutIntent } from "~/lib/add-to-tree-shortcuts";
import {
  BRANCH_TRAY_MAX_ITEMS,
  branchTrayUnavailableReason,
  branchTraySubmitLabel,
  canSubmitBranchTray,
  clearBranchTray,
  removeBranchTrayItem,
  stageSuggestedResults,
  stageSearchResult,
  submitInputsFromBranchTray,
  type BranchTrayItem,
  type BranchTraySubmitInput,
} from "~/lib/branch-tray-state";
import { $resolveSearchSubjectWorks, $searchCultureTreeNodes } from "~/server/culture-trees";

const SEARCH_DEBOUNCE_MS = 350;

type TreeNodePopoverSubmitInput = BranchTraySubmitInput;

// Cover images can 404 (notably Cover Art Archive, which has gaps), so swap to the medium
// placeholder on load error instead of showing a broken-image icon.
function CoverImage({
  src,
  imgClassName,
  renderFallback,
}: {
  readonly src: string | undefined;
  readonly imgClassName: string;
  readonly renderFallback: () => ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <>{renderFallback()}</>;
  }
  return (
    <img
      alt=""
      referrerPolicy="no-referrer"
      src={src}
      onError={() => setFailed(true)}
      className={imgClassName}
    />
  );
}

function ResultCard({
  result,
  unavailableReason,
  onStage,
  onUnstage,
}: {
  readonly result: ExternalNodeSearchResult;
  readonly unavailableReason: "not-addable" | "staged" | "existing" | "full" | null;
  readonly onStage: (result: ExternalNodeSearchResult) => void;
  readonly onUnstage: (result: ExternalNodeSearchResult) => void;
}) {
  const isStaged = unavailableReason === "staged";
  const isBlocked =
    unavailableReason === "existing" ||
    unavailableReason === "full" ||
    unavailableReason === "not-addable";
  const overlayLabel =
    unavailableReason === "existing"
      ? "In tree"
      : unavailableReason === "full"
        ? "Tray full"
        : null;

  return (
    <button
      type="button"
      disabled={isBlocked}
      onClick={() => (isStaged ? onUnstage(result) : onStage(result))}
      className={cn(
        "group relative aspect-[3/4] overflow-hidden rounded-lg border text-left transition-transform",
        "focus-visible:ring-2 focus-visible:ring-[oklch(0.82_0.11_100/0.6)] focus-visible:outline-none",
        isBlocked ? "cursor-not-allowed opacity-45" : "hover:scale-[1.03]",
        isStaged
          ? "border-[oklch(0.82_0.11_100)] ring-2 ring-[oklch(0.82_0.11_100/0.5)]"
          : "border-[oklch(0.9_0.01_120/0.12)]",
      )}
    >
      <CoverImage
        src={result.snapshot.image}
        imgClassName="size-full object-cover"
        renderFallback={() => (
          <div className="flex size-full items-center justify-center bg-[oklch(0.95_0.01_120/0.05)]">
            <NodeThumbnail
              type={result.snapshot.type}
              size="md"
              className="size-12 bg-transparent text-[oklch(0.9_0.01_120/0.45)]"
            />
          </div>
        )}
      />

      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/95 via-black/70 to-transparent p-2.5 pt-10">
        <p className="truncate text-sm font-medium text-white">{result.snapshot.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <NodeTypeBadge type={result.snapshot.type} />
          {result.snapshot.year != null ? (
            <span className="font-mono text-[0.6rem] text-white/70 tabular-nums">
              {result.snapshot.year}
            </span>
          ) : null}
        </div>
      </div>

      {isStaged ? (
        <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-[oklch(0.82_0.11_100)] text-black">
          <CheckIcon className="size-3.5" aria-hidden />
        </span>
      ) : !isBlocked ? (
        <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100">
          <PlusIcon className="size-3.5" aria-hidden />
        </span>
      ) : null}

      {overlayLabel ? (
        <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[0.55rem] tracking-wide text-white/80 uppercase">
          {overlayLabel}
        </span>
      ) : null}
    </button>
  );
}

function typeLabel(type: NodeTypeValue): string {
  return type
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function identityKey(identity: ExternalNodeSearchResult["identity"]): string {
  return `${identity.source}:${identity.externalId}`;
}

type SubjectWorksState = {
  status: "loading" | "loaded" | "error";
  results: readonly ExternalNodeSearchResult[];
};

// A creator subject (artist/person): a header row that expands in place to reveal the
// creator's works (hop two). The subject itself is never addable — only its works are.
function SubjectSection({
  subject,
  isOpen,
  state,
  onToggle,
  renderWork,
}: {
  readonly subject: ExternalNodeSearchResult;
  readonly isOpen: boolean;
  readonly state: SubjectWorksState | undefined;
  readonly onToggle: (subject: ExternalNodeSearchResult) => void;
  readonly renderWork: (work: ExternalNodeSearchResult) => ReactNode;
}) {
  const works = state?.results ?? [];

  return (
    <section className="overflow-hidden rounded-lg border border-[oklch(0.9_0.01_120/0.12)]">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => onToggle(subject)}
        className="flex w-full items-center gap-3 bg-[oklch(0.95_0.01_120/0.04)] p-2.5 text-left transition-colors hover:bg-[oklch(0.95_0.01_120/0.07)] focus-visible:ring-2 focus-visible:ring-[oklch(0.82_0.11_100/0.6)] focus-visible:outline-none"
      >
        <span className="size-12 shrink-0 overflow-hidden rounded-full bg-[oklch(0.95_0.01_120/0.05)]">
          <CoverImage
            src={subject.snapshot.image}
            imgClassName="size-full object-cover"
            renderFallback={() => (
              <span className="flex size-full items-center justify-center">
                <NodeThumbnail
                  type={subject.snapshot.type}
                  size="sm"
                  className="size-6 bg-transparent text-[oklch(0.9_0.01_120/0.45)]"
                />
              </span>
            )}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">
            {subject.snapshot.name}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <NodeTypeBadge type={subject.snapshot.type} />
            {subject.meta ? (
              <span className="truncate text-[0.7rem] text-[oklch(0.9_0.01_120/0.5)]">
                {subject.meta}
              </span>
            ) : null}
          </span>
        </span>
        <span className="flex items-center gap-1.5 pr-1 text-[0.7rem] text-[oklch(0.9_0.01_120/0.6)]">
          {state?.status === "loading" ? (
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
          ) : (
            <>
              {isOpen ? "Hide" : "Expand"}
              <ChevronDownIcon
                className={cn("size-4 transition-transform", isOpen ? "rotate-180" : "")}
                aria-hidden
              />
            </>
          )}
        </span>
      </button>

      {isOpen ? (
        <div className="p-3">
          {state?.status === "error" ? (
            <p className="py-4 text-center text-xs text-destructive">
              Couldn&apos;t load works for {subject.snapshot.name}.
            </p>
          ) : state?.status === "loaded" && works.length === 0 ? (
            <p className="py-4 text-center text-xs text-[oklch(0.9_0.01_120/0.58)]">
              No works found.
            </p>
          ) : works.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
              {works.map((work) => renderWork(work))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <LoaderCircleIcon
                className="size-4 animate-spin text-[oklch(0.9_0.01_120/0.58)]"
                aria-hidden
              />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

interface TreeNodeDialogProps {
  readonly triggerLabel: string;
  readonly triggerClassName?: string;
  readonly triggerIcon?: ReactNode;
  readonly triggerVariant?: "amber" | "default" | "outline" | "secondary" | "ghost";
  readonly title?: string;
  readonly existingBranches?: readonly TreeItem[];
  readonly isPending?: boolean;
  readonly isAiPending?: boolean;
  readonly onSuggestBranches?: (
    trayResults: readonly ExternalNodeSearchResult[],
  ) => Promise<readonly ExternalNodeSearchResult[]>;
  readonly onAiSubmit?: (input: TreeNodePopoverSubmitInput) => Promise<void>;
  readonly onSubmit: (input: readonly TreeNodePopoverSubmitInput[]) => Promise<void>;
}

export function TreeNodeDialog({
  triggerLabel,
  triggerClassName,
  triggerIcon,
  triggerVariant = "outline",
  title = "Add Branch",
  existingBranches = [],
  isPending = false,
  isAiPending = false,
  onSuggestBranches,
  onAiSubmit,
  onSubmit,
}: TreeNodeDialogProps) {
  const [open, setOpen] = useState(false);
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsPaneRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [branchTray, setBranchTray] = useState<BranchTrayItem[]>([]);
  const [results, setResults] = useState<ExternalNodeSearchResult[]>([]);
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(() => new Set());
  const [subjectWorks, setSubjectWorks] = useState<Record<string, SubjectWorksState>>({});
  const [activeResultType, setActiveResultType] = useState<NodeTypeValue | null>(null);
  const [showResultsFade, setShowResultsFade] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const trimmedQuery = query.trim();
  const showSearching = trimmedQuery.length >= 2 && isSearching;
  const isSubmitting = isPending || isAiPending;
  const canSubmitTray = canSubmitBranchTray(branchTray) && !isSubmitting;
  const canSuggestBranches =
    Boolean(onSuggestBranches) && !isSubmitting && branchTray.length < BRANCH_TRAY_MAX_ITEMS;

  useEffect(() => {
    if (!open) {
      setQuery("");
      setBranchTray((current) => clearBranchTray(current));
      setResults([]);
      setOpenSubjects(new Set());
      setSubjectWorks({});
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
      setOpenSubjects(new Set());
      setSubjectWorks({});
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
          // New result set — collapse any previously expanded subjects and drop their cache.
          setResults(response.results);
          setOpenSubjects(new Set());
          setSubjectWorks({});
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
  // Results can mix addable works and expandable creator subjects; render each in its own
  // section. Works lead (the engine orders them first), creator subjects follow.
  const workResults = filteredResults.filter((result) => result.kind === "addable-work");
  const subjectResultsList = filteredResults.filter(
    (result) => result.kind === "expandable-subject",
  );
  // AI "grow" and keyboard-stage only apply to addable works, never to creator subjects.
  const suggestedAiResult = workResults.at(0);
  const topStageableResult = filteredResults.find(
    (result) =>
      branchTrayUnavailableReason({
        tray: branchTray,
        existingBranches,
        result,
      }) == null,
  );

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

  // Expanding a creator subject resolves its works (hop two) on demand, in place. Results
  // are cached per subject so collapsing/re-expanding doesn't refetch.
  const handleToggleSubject = (subject: ExternalNodeSearchResult) => {
    const key = identityKey(subject.identity);
    const willOpen = !openSubjects.has(key);

    setOpenSubjects((current) => {
      const next = new Set(current);
      if (willOpen) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });

    if (!willOpen || subjectWorks[key]?.status === "loaded") {
      return;
    }

    setSubjectWorks((current) => ({ ...current, [key]: { status: "loading", results: [] } }));
    void (async () => {
      try {
        const response = await $resolveSearchSubjectWorks({ data: { identity: subject.identity } });
        setSubjectWorks((current) => ({
          ...current,
          [key]: { status: "loaded", results: response.results },
        }));
      } catch {
        setSubjectWorks((current) => ({ ...current, [key]: { status: "error", results: [] } }));
      }
    })();
  };

  // Staging keeps the gallery in place so several Branches can be staged from one search.
  const handleStageResult = (result: ExternalNodeSearchResult) => {
    if (isSubmitting) {
      return;
    }

    setBranchTray((current) => stageSearchResult({ tray: current, existingBranches, result }));
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleUnstageResult = (result: ExternalNodeSearchResult) => {
    setBranchTray((current) =>
      current.filter(
        (item) =>
          !(
            item.result.identity.source === result.identity.source &&
            item.result.identity.externalId === result.identity.externalId
          ),
      ),
    );
  };

  const renderWorkCard = (result: ExternalNodeSearchResult): ReactNode => (
    <ResultCard
      key={identityKey(result.identity)}
      result={result}
      unavailableReason={branchTrayUnavailableReason({
        tray: branchTray,
        existingBranches,
        result,
      })}
      onStage={handleStageResult}
      onUnstage={handleUnstageResult}
    />
  );

  const handleSubmitTray = async () => {
    const input = submitInputsFromBranchTray(branchTray);
    if (input.length === 0 || isSubmitting) {
      return;
    }

    await onSubmit(input);
    setOpen(false);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const intent = addToTreeShortcutIntent({
      key: event.key,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      searchValue: event.currentTarget.value,
      canStageTopResult: topStageableResult != null && !isSubmitting,
      canSubmitTray,
      hasTrayItems: branchTray.length > 0,
    });
    if (!intent) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (intent === "stage-top-result" && topStageableResult) {
      handleStageResult(topStageableResult);
      return;
    }

    if (intent === "submit-tray") {
      void handleSubmitTray();
      return;
    }

    if (intent === "remove-last-staged") {
      setBranchTray((current) => current.slice(0, -1));
      return;
    }

    setOpen(false);
  };

  const handleAiSubmit = async () => {
    if (!onAiSubmit || !suggestedAiResult) {
      return;
    }

    await onAiSubmit({
      kind: "search-result",
      result: suggestedAiResult,
      connectionType: "thematic",
      reason: "",
    });
    setOpen(false);
  };

  const handleSuggestBranches = async () => {
    if (!onSuggestBranches || !canSuggestBranches) {
      return;
    }

    const suggestions = await onSuggestBranches(branchTray.map((item) => item.result));
    setBranchTray((current) =>
      stageSuggestedResults({
        tray: current,
        existingBranches,
        results: suggestions,
      }),
    );
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
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
      <DialogContent className="grid h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)] w-[min(96rem,calc(100vw-3rem))] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl border border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.18_0.012_125)] p-0 text-[oklch(0.91_0.014_125)] shadow-2xl ring-1 ring-[oklch(0.95_0.01_120/0.06)] sm:max-w-none">
        {/* Header: title, search, category filter */}
        <div className="border-b border-[oklch(0.9_0.01_120/0.1)] px-6 pt-6 pb-5">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl leading-tight tracking-tight text-[oklch(0.95_0.012_125)]">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-[oklch(0.9_0.01_120/0.58)]">
              Search a recognized cultural subject, then stage Branches before adding them.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2">
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
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search films, books, albums, artists, places..."
                  className="font-body h-14 border-[oklch(0.9_0.01_120/0.12)] bg-[oklch(0.95_0.01_120/0.06)] pr-9 pl-10 text-base text-[oklch(0.95_0.012_125)] placeholder:text-[oklch(0.9_0.01_120/0.38)] focus-visible:ring-[oklch(0.82_0.11_100/0.45)]"
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
              {onSuggestBranches ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="amber"
                        size="icon-lg"
                        disabled={!canSuggestBranches}
                        aria-label="Suggest Branches"
                        onClick={() => {
                          void handleSuggestBranches();
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
                  <TooltipContent>Suggest Branches</TooltipContent>
                </Tooltip>
              ) : onAiSubmit ? (
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

            {searchError ? <p className="text-xs text-destructive">{searchError}</p> : null}

            {results.length > 0 ? (
              <div className="space-y-2 pt-1">
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
          </div>
        </div>

        {/* Body: poster gallery */}
        <div ref={resultsPaneRef} className="relative min-h-0 overflow-y-auto px-6 py-5">
          {filteredResults.length > 0 ? (
            <div className="space-y-4">
              {workResults.length > 0 ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
                  {workResults.map((result) => renderWorkCard(result))}
                </div>
              ) : null}
              {subjectResultsList.length > 0 ? (
                <div className="space-y-2.5">
                  {subjectResultsList.map((subject) => {
                    const key = identityKey(subject.identity);
                    return (
                      <SubjectSection
                        key={key}
                        subject={subject}
                        isOpen={openSubjects.has(key)}
                        state={subjectWorks[key]}
                        onToggle={handleToggleSubject}
                        renderWork={renderWorkCard}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : showSearching ? (
            <div className="flex h-full items-center justify-center">
              <span className="inline-flex items-center gap-2 text-xs text-[oklch(0.9_0.01_120/0.58)]">
                <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                Looking for matches...
              </span>
            </div>
          ) : trimmedQuery.length >= 2 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs leading-relaxed text-[oklch(0.9_0.01_120/0.58)]">
                No matches yet.
              </p>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="max-w-xs text-center text-sm leading-relaxed text-[oklch(0.9_0.01_120/0.5)]">
                Search to browse covers, then stage Branches into the shelf below.
              </p>
            </div>
          )}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-[oklch(0.18_0.012_125)] via-[oklch(0.18_0.012_125/0.42)] to-transparent transition-opacity",
              showResultsFade ? "opacity-100" : "opacity-0",
            )}
          />
        </div>

        {/* Footer: staged filmstrip + submit */}
        <div className="border-t border-[oklch(0.9_0.01_120/0.1)] bg-[oklch(0.21_0.012_125)] px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex min-h-20 min-w-0 flex-1 items-center gap-2 overflow-x-auto">
              {branchTray.length > 0 ? (
                branchTray.map((item) => (
                  <div
                    key={item.id}
                    className="group relative h-20 w-14 shrink-0 overflow-hidden rounded border border-[oklch(0.82_0.11_100/0.4)]"
                  >
                    {item.result.snapshot.image ? (
                      <img
                        alt=""
                        referrerPolicy="no-referrer"
                        src={item.result.snapshot.image}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-[oklch(0.95_0.01_120/0.05)]">
                        <NodeThumbnail
                          type={item.result.snapshot.type}
                          size="sm"
                          className="size-6 bg-transparent text-[oklch(0.9_0.01_120/0.45)]"
                        />
                      </div>
                    )}
                    {item.source === "suggested" ? (
                      <span className="absolute top-1 left-1 rounded-full bg-[oklch(0.82_0.11_100)] px-1.5 font-mono text-[0.5rem] tracking-wide text-black uppercase">
                        S
                      </span>
                    ) : null}
                    <button
                      type="button"
                      disabled={isSubmitting}
                      aria-label={`Remove ${item.result.snapshot.name} from Branch Tray`}
                      onClick={() => {
                        setBranchTray((current) =>
                          removeBranchTrayItem({ tray: current, itemId: item.id }),
                        );
                      }}
                      className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/55 group-hover:opacity-100 focus-visible:bg-black/55 focus-visible:opacity-100 focus-visible:outline-none"
                    >
                      <XIcon className="size-4 text-white" aria-hidden />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-relaxed text-[oklch(0.9_0.01_120/0.5)]">
                  Stage Branches from the gallery to add them to this Culture Tree.
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="amber"
              className="shrink-0 rounded-sm font-mono text-[0.68rem] tracking-[0.08em] uppercase"
              disabled={!canSubmitTray}
              onClick={() => {
                void handleSubmitTray();
              }}
            >
              {isPending ? (
                <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
              ) : (
                <PlusIcon className="size-4" aria-hidden />
              )}
              {branchTraySubmitLabel(branchTray)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { TreeNodePopoverSubmitInput };
