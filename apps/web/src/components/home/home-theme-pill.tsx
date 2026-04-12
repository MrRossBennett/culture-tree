import { Button } from "@repo/ui/components/button";
import { useTheme } from "@repo/ui/lib/theme-provider";
import { cn } from "@repo/ui/lib/utils";
import { useSyncExternalStore } from "react";

function subscribeDark(callback: () => void) {
  const el = document.documentElement;
  const observer = new MutationObserver(callback);
  observer.observe(el, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getDarkSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

export function HomeThemePill() {
  const { setTheme } = useTheme();
  const isDark = useSyncExternalStore(subscribeDark, getDarkSnapshot, getServerSnapshot);

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className={cn(
        "h-7 rounded-full px-3 font-mono text-[0.65rem] tracking-[0.12em] uppercase",
        !isDark && "border-amber-200/80 text-muted-foreground dark:border-border",
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? "light" : "dark"}
    </Button>
  );
}
