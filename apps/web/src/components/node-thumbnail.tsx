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
    if (src) {
      return (
        <img
          alt=""
          referrerPolicy="no-referrer"
          src={src}
          className={cn(
            "shrink-0 object-cover",
            isSquare ? cn("size-10", !isAlbum) : "max-h-20 w-12 self-start object-top",
            className,
          )}
        />
      );
    }
    return (
      <div
        aria-hidden
        className={cn(
          "flex size-10 shrink-0 items-center justify-center bg-muted/20 text-muted-foreground",
          !isAlbum,
          className,
        )}
      >
        {nodeTypeIcon(type, "size-4 opacity-50")}
      </div>
    );
  }

  // md size — square for albums/people/songs, portrait for everything else
  if (src) {
    return (
      <img
        alt=""
        referrerPolicy="no-referrer"
        src={src}
        className={cn(
          "shrink-0",
          isSquare
            ? cn("size-22 object-cover md:size-24", !isAlbum)
            : "max-h-40 w-22 self-start object-contain object-top md:max-h-48 md:w-24",
          className,
        )}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "flex size-22 shrink-0 items-center justify-center bg-muted/20 text-muted-foreground md:size-24",
        !isAlbum,
        className,
      )}
    >
      {nodeTypeIcon(type, "size-6 opacity-50 md:size-7")}
    </div>
  );
}
