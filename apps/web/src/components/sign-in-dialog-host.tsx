import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { HomeSignInDialog } from "~/components/home/home-sign-in-dialog";

type SignInDialogContextValue = {
  readonly openSignIn: () => void;
};

const SignInDialogContext = createContext<SignInDialogContextValue | null>(null);

export function useOpenSignIn(): SignInDialogContextValue {
  const ctx = useContext(SignInDialogContext);
  if (!ctx) {
    throw new Error("useOpenSignIn must be used within SignInDialogHost");
  }
  return ctx;
}

export function SignInDialogHost({ children }: { readonly children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSignIn = useCallback(() => {
    setOpen(true);
  }, []);
  const value = useMemo(() => ({ openSignIn }), [openSignIn]);

  return (
    <SignInDialogContext.Provider value={value}>
      <HomeSignInDialog open={open} onOpenChange={setOpen} />
      {children}
    </SignInDialogContext.Provider>
  );
}
