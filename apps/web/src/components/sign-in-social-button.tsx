import { authClient } from "@repo/auth/auth-client";
import { Button } from "@repo/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

interface SocialLoginButtonProps {
  provider: "google";
  icon: React.ReactNode;
  disabled?: boolean;
  callbackURL: string;
}

export function SignInSocialButton(props: SocialLoginButtonProps) {
  const providerLabel = "Google";

  const mutation = useMutation({
    mutationFn: async () =>
      await authClient.signIn.social(
        {
          provider: props.provider,
          callbackURL: props.callbackURL,
        },
        {
          onError: ({ error }) => {
            toast.error(error.message || `An error occurred during ${providerLabel} sign-in.`);
          },
        },
      ),
  });

  return (
    <Button
      variant="outline"
      className="w-full"
      type="button"
      disabled={mutation.isSuccess || mutation.isPending || props.disabled}
      onClick={() => mutation.mutate()}
    >
      {props.icon}
      Continue with {providerLabel}
    </Button>
  );
}
