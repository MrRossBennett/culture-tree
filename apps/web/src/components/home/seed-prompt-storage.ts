const KEY = "culture-tree:seed-prompt";

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) {
    l();
  }
}

export function subscribeSeedPrompt(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) {
      onChange();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function getSeedPromptSnapshot(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function getSeedPromptServerSnapshot(): string {
  return "";
}

export function writeSeedPrompt(value: string) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    return;
  }
  emit();
}
