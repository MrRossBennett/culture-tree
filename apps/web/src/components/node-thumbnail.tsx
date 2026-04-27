import type { NodeTypeValue } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";
import {
  BookOpenIcon,
  CalendarIcon,
  ClapperboardIcon,
  Disc3Icon,
  ImageIcon,
  MapPinIcon,
  MusicIcon,
  NewspaperIcon,
  PodcastIcon,
  TvIcon,
  UserIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export function nodeTypeIcon(type: NodeTypeValue, className: string) {
  switch (type) {
    case "album":
      return <Disc3Icon className={className} aria-hidden />;
    case "film":
      return <ClapperboardIcon className={className} aria-hidden />;
    case "book":
      return <BookOpenIcon className={className} aria-hidden />;
    case "song":
      return <MusicIcon className={className} aria-hidden />;
    case "tv":
      return <TvIcon className={className} aria-hidden />;
    case "artist":
    case "person":
      return <UserIcon className={className} aria-hidden />;
    case "podcast":
      return <PodcastIcon className={className} aria-hidden />;
    case "artwork":
      return <ImageIcon className={className} aria-hidden />;
    case "place":
      return <MapPinIcon className={className} aria-hidden />;
    case "event":
      return <CalendarIcon className={className} aria-hidden />;
    case "article":
      return <NewspaperIcon className={className} aria-hidden />;
  }
}

const SQUARE_TYPES: ReadonlySet<NodeTypeValue> = new Set(["album", "person", "song"]);

export function NodeThumbnail({
  type,
  src,
  size = "md",
  className,
}: {
  readonly type: NodeTypeValue;
  readonly src?: string;
  readonly size?: "sm" | "md";
  readonly className?: string;
}) {
  const isSquare = SQUARE_TYPES.has(type);
  const isAlbum = type === "album";

  if (size === "sm") {
    return (
      <AnimatePresence mode="wait" initial={false}>
        {src ? (
          <motion.img
            key={src}
            alt=""
            referrerPolicy="no-referrer"
            src={src}
            initial={{ opacity: 0, scale: 1.018, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.992, filter: "blur(6px)" }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "shrink-0 object-cover",
              isSquare ? cn("size-10", !isAlbum) : "max-h-20 w-12 self-start object-top",
              className,
            )}
          />
        ) : (
          <motion.div
            key="fallback"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center bg-muted/20 text-muted-foreground",
              !isAlbum,
              className,
            )}
          >
            {nodeTypeIcon(type, "size-4 opacity-50")}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {src ? (
        <motion.img
          key={src}
          alt=""
          referrerPolicy="no-referrer"
          src={src}
          initial={{ opacity: 0, scale: 1.018, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.992, filter: "blur(6px)" }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "shrink-0",
            isSquare
              ? cn("size-22 object-cover md:size-24", !isAlbum)
              : "max-h-40 w-22 self-start object-contain object-top md:max-h-48 md:w-24",
            className,
          )}
        />
      ) : (
        <motion.div
          key="fallback"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className={cn(
            "flex size-22 shrink-0 items-center justify-center bg-muted/20 text-muted-foreground md:size-24",
            !isAlbum,
            className,
          )}
        >
          {nodeTypeIcon(type, "size-6 opacity-50 md:size-7")}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
