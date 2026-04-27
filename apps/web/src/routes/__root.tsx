import type { AuthQueryResult } from "@repo/auth/tanstack/queries";
import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { Toaster } from "@repo/ui/components/sonner";
import { TooltipProvider } from "@repo/ui/components/tooltip";
import { ThemeProvider } from "@repo/ui/lib/theme-provider";
import { a11yDevtoolsPlugin } from "@tanstack/devtools-a11y/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { formDevtoolsPlugin } from "@tanstack/react-form-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  redirect,
  ScriptOnce,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { AppHeader } from "~/components/app-header";
import { SignInDialogHost } from "~/components/sign-in-dialog-host";

import appCss from "~/styles.css?url";

interface MyRouterContext {
  queryClient: QueryClient;
  user: AuthQueryResult;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData({
      ...authQueryOptions(),
      revalidateIfStale: true,
    });
    const path = location.pathname;
    if (
      user &&
      !user.username &&
      path !== "/onboarding" &&
      !path.startsWith("/api/") &&
      !path.startsWith("/tree/")
    ) {
      throw redirect({ to: "/onboarding" });
    }
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        // scaffold:title
        title: "Culture Tree",
      },
      {
        name: "description",
        // scaffold:description
        content: "A minimal monorepo starter template for 🏝️ TanStack Start",
      },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      {
        rel: "icon",
        href: "/favicon.svg",
        type: "image/svg+xml",
      },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { readonly children: React.ReactNode }) {
  return (
    // suppress since we're updating the "dark" class in a custom script below
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ScriptOnce>
          {/* Apply theme early to avoid FOUC */}
          {`document.documentElement.classList.toggle(
            'dark',
            localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
            )`}
        </ScriptOnce>

        <ThemeProvider>
          <TooltipProvider>
            <SignInDialogHost>
              <div className="flex min-h-svh flex-col bg-background text-foreground">
                <div className="relative z-10 flex w-full justify-center">
                  <AppHeader />
                </div>
                <div className="relative z-2 flex min-h-0 flex-1 flex-col">{children}</div>
              </div>
            </SignInDialogHost>
            <Toaster richColors />
          </TooltipProvider>
        </ThemeProvider>

        <TanStackDevtools
          plugins={[
            {
              name: "TanStack Query",
              render: <ReactQueryDevtoolsPanel />,
            },
            {
              name: "TanStack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            formDevtoolsPlugin(),
            a11yDevtoolsPlugin(),
          ]}
        />

        <Scripts />
      </body>
    </html>
  );
}
