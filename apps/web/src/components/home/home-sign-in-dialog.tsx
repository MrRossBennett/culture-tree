import { SiGoogle } from "@icons-pack/react-simple-icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Link } from "@tanstack/react-router";

import { SignInSocialButton } from "~/components/sign-in-social-button";

function homeOAuthCallbackUrl(): string {
  const base = import.meta.env.VITE_BASE_URL;
  if (typeof base === "string" && base.length > 0) {
    return `${base.replace(/\/$/, "")}/`;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/`;
  }
  return "/";
}

interface HomeSignInDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function HomeSignInDialog({ open, onOpenChange }: HomeSignInDialogProps) {
  const callbackURL = homeOAuthCallbackUrl();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Sign in</DialogTitle>
          <DialogDescription className="font-body text-base">
            Sign in with Google to plant your first seed. Your prompt stays right here.
          </DialogDescription>
        </DialogHeader>
        <SignInSocialButton
          provider="google"
          callbackURL={callbackURL}
          icon={<SiGoogle className="size-4" />}
        />
        <p className="font-body text-center text-xs text-muted-foreground">
          Prefer a full page?{" "}
          <Link to="/sign-in" className="text-primary underline-offset-4 hover:underline">
            Open sign in
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
