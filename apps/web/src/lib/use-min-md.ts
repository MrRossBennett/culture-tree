import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/** SSR / first paint: false so we don't assume desktop (and skip Flow on server). */
function getServerSnapshot() {
  return false;
}

/** `true` from768px up (Tailwind `md`). */
export function useMinMd() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
