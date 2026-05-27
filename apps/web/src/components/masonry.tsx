import { cn } from "@repo/ui/lib/utils";
import { gsap } from "gsap";
import {
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

type MasonryBaseItem = {
  id: string;
  img: string;
  height: number;
  aspectRatio?: number;
  chromeHeight?: number;
};

type PositionedMasonryItem<TItem extends MasonryBaseItem> = TItem & {
  h: number;
  w: number;
  x: number;
  y: number;
};

type AnimateFrom = "top" | "bottom" | "left" | "right" | "center" | "random";

function useMedia<TValue>(
  queries: readonly string[],
  values: readonly TValue[],
  defaultValue: TValue,
): TValue {
  const get = useCallback(() => {
    if (typeof window === "undefined") {
      return defaultValue;
    }

    const matchIndex = queries.findIndex((query) => window.matchMedia(query).matches);
    return values[matchIndex] ?? defaultValue;
  }, [defaultValue, queries, values]);

  const [value, setValue] = useState(get);

  useEffect(() => {
    const mediaQueries = queries.map((query) => window.matchMedia(query));
    const handler = () => setValue(get());

    mediaQueries.forEach((query) => query.addEventListener("change", handler));
    return () => mediaQueries.forEach((query) => query.removeEventListener("change", handler));
  }, [get, queries]);

  return value;
}

function useMeasure() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });

    resizeObserver.observe(ref.current);
    return () => resizeObserver.disconnect();
  }, []);

  return [ref, size] as const;
}

async function preloadImages(urls: readonly string[]) {
  const entries = await Promise.all(
    urls.map(
      (src) =>
        new Promise<readonly [string, number] | null>((resolve) => {
          if (!src) {
            resolve(null);
            return;
          }

          const img = new Image();
          img.src = src;
          img.onload = () => {
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              resolve([src, img.naturalHeight / img.naturalWidth]);
              return;
            }

            resolve(null);
          };
          img.onerror = () => resolve(null);
        }),
    ),
  );

  return Object.fromEntries(entries.filter((entry) => entry != null));
}

export function Masonry<TItem extends MasonryBaseItem>({
  items,
  ease = "power3.out",
  duration = 0.6,
  stagger = 0.05,
  animateFrom = "bottom",
  scaleOnHover = true,
  hoverScale = 0.95,
  blurToFocus = true,
  colorShiftOnHover = false,
  className,
  renderItem,
}: {
  readonly items: readonly TItem[];
  readonly ease?: string;
  readonly duration?: number;
  readonly stagger?: number;
  readonly animateFrom?: AnimateFrom;
  readonly scaleOnHover?: boolean;
  readonly hoverScale?: number;
  readonly blurToFocus?: boolean;
  readonly colorShiftOnHover?: boolean;
  readonly className?: string;
  readonly renderItem: (item: TItem, index: number) => ReactNode;
}) {
  const columns = useMedia(
    [
      "(min-width:1700px)",
      "(min-width:1300px)",
      "(min-width:960px)",
      "(min-width:680px)",
      "(min-width:420px)",
    ],
    [6, 5, 4, 3, 2],
    1,
  );

  const [containerRef, { width }] = useMeasure();
  const imageKey = useMemo(() => items.map((item) => item.img).join("\n"), [items]);
  const [readyImageKey, setReadyImageKey] = useState("");
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<string, number>>({});
  const hasMounted = useRef(false);
  const imagesReady = readyImageKey === imageKey;

  useEffect(() => {
    let cancelled = false;

    void preloadImages(items.map((item) => item.img)).then((nextAspectRatios) => {
      if (!cancelled) {
        setImageAspectRatios(nextAspectRatios);
        setReadyImageKey(imageKey);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [imageKey, items]);

  const grid = useMemo(() => {
    if (!width) {
      return [];
    }

    const colHeights = new Array<number>(columns).fill(0);
    const columnWidth = width / columns;

    return items.map((item) => {
      const col = colHeights.indexOf(Math.min(...colHeights));
      const x = columnWidth * col;
      const imageAspectRatio = imageAspectRatios[item.img] ?? item.aspectRatio;
      const height =
        imageAspectRatio != null
          ? columnWidth * imageAspectRatio + (item.chromeHeight ?? 74)
          : item.height / 2;
      const y = colHeights[col] ?? 0;

      colHeights[col] = y + height;

      return { ...item, x, y, w: columnWidth, h: height };
    });
  }, [columns, imageAspectRatios, items, width]);

  const containerHeight = useMemo(() => {
    if (grid.length === 0) {
      return 0;
    }

    return Math.max(...grid.map((item) => item.y + item.h));
  }, [grid]);

  const getInitialPosition = useCallback(
    (item: PositionedMasonryItem<TItem>) => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) {
        return { x: item.x, y: item.y };
      }

      let direction = animateFrom;

      if (animateFrom === "random") {
        const directions: AnimateFrom[] = ["top", "bottom", "left", "right"];
        direction = directions[Math.floor(Math.random() * directions.length)] ?? "bottom";
      }

      switch (direction) {
        case "top":
          return { x: item.x, y: -200 };
        case "bottom":
          return { x: item.x, y: window.innerHeight + 200 };
        case "left":
          return { x: -200, y: item.y };
        case "right":
          return { x: window.innerWidth + 200, y: item.y };
        case "center":
          return {
            x: containerRect.width / 2 - item.w / 2,
            y: containerRect.height / 2 - item.h / 2,
          };
        default:
          return { x: item.x, y: item.y + 100 };
      }
    },
    [animateFrom, containerRef],
  );

  useLayoutEffect(() => {
    if (!imagesReady) {
      return;
    }

    grid.forEach((item, index) => {
      const selector = `[data-masonry-key="${item.id}"]`;
      const animationProps = {
        x: item.x,
        y: item.y,
        width: item.w,
        height: item.h,
      };

      if (!hasMounted.current) {
        const initialPos = getInitialPosition(item);
        const initialState = {
          opacity: 0,
          x: initialPos.x,
          y: initialPos.y,
          width: item.w,
          height: item.h,
          ...(blurToFocus && { filter: "blur(10px)" }),
        };

        gsap.fromTo(selector, initialState, {
          opacity: 1,
          ...animationProps,
          ...(blurToFocus && { filter: "blur(0px)" }),
          duration: 0.8,
          ease: "power3.out",
          delay: index * stagger,
        });
        return;
      }

      gsap.to(selector, {
        ...animationProps,
        duration,
        ease,
        overwrite: "auto",
      });
    });

    hasMounted.current = true;
  }, [blurToFocus, duration, ease, getInitialPosition, grid, imagesReady, stagger]);

  const handleMouseEnter = (
    event: MouseEvent<HTMLDivElement>,
    item: PositionedMasonryItem<TItem>,
  ) => {
    const selector = `[data-masonry-key="${item.id}"]`;

    if (scaleOnHover) {
      gsap.to(selector, {
        scale: hoverScale,
        duration: 0.3,
        ease: "power2.out",
      });
    }

    if (colorShiftOnHover) {
      const overlay = event.currentTarget.querySelector("[data-masonry-color-overlay]");
      if (overlay) {
        gsap.to(overlay, {
          opacity: 0.3,
          duration: 0.3,
        });
      }
    }
  };

  const handleMouseLeave = (
    event: MouseEvent<HTMLDivElement>,
    item: PositionedMasonryItem<TItem>,
  ) => {
    const selector = `[data-masonry-key="${item.id}"]`;

    if (scaleOnHover) {
      gsap.to(selector, {
        scale: 1,
        duration: 0.3,
        ease: "power2.out",
      });
    }

    if (colorShiftOnHover) {
      const overlay = event.currentTarget.querySelector("[data-masonry-color-overlay]");
      if (overlay) {
        gsap.to(overlay, {
          opacity: 0,
          duration: 0.3,
        });
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", className)}
      style={{ height: containerHeight || undefined }}
    >
      {grid.map((item, index) => (
        <div
          key={item.id}
          data-masonry-key={item.id}
          className={cn(
            "absolute top-0 left-0 p-1.5 will-change-[transform,width,height,opacity]",
            imagesReady ? "cursor-pointer opacity-0" : "opacity-100",
          )}
          style={
            imagesReady
              ? undefined
              : {
                  height: item.h,
                  transform: `translate3d(${item.x}px, ${item.y}px, 0)`,
                  width: item.w,
                }
          }
          onMouseEnter={(event) => handleMouseEnter(event, item)}
          onMouseLeave={(event) => handleMouseLeave(event, item)}
        >
          <div className="relative size-full">
            {imagesReady ? (
              renderItem(item, index)
            ) : (
              <div className="flex size-full flex-col overflow-hidden rounded-md border border-border/45 bg-card/35 p-2">
                <div className="min-h-0 flex-1 animate-pulse rounded bg-muted/45" />
                <div className="shrink-0 space-y-2 px-1 pt-3 pb-1.5">
                  <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted/55" />
                  <div className="h-2 w-2/5 animate-pulse rounded-full bg-muted/40" />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
