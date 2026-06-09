import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { HomeHero } from "~/components/home/home-hero";
import { homeSurfaceSections } from "~/components/home/home-layout-policy";
import { HomeSeedForm } from "~/components/home/home-seed-form";
import { HomeSuggestions } from "~/components/home/home-suggestions";
import { HomeYourTrees } from "~/components/your-trees-section";

export function HomePage() {
  const [seedHovered, setSeedHovered] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { data: user } = useQuery(authQueryOptions());
  const signedIn = Boolean(user);
  const sections = homeSurfaceSections({ signedIn });

  if (signedIn) {
    return (
      <div className="relative flex flex-1 flex-col bg-background text-foreground">
        <div className="relative z-2 flex flex-1 flex-col">
          <main className="flex w-full flex-1 flex-col gap-9 px-4 py-10 sm:px-6 lg:px-8">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">
                  Curator workbench
                </p>
                <h1 className="font-heading mt-3 text-4xl leading-tight tracking-tight text-foreground md:text-5xl">
                  Your Culture Trees
                </h1>
                <p className="font-body mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
                  Keep building the references, scenes, works, and people that define your taste.
                </p>
              </div>
              <Button
                type="button"
                variant="amber"
                className="shrink-0 rounded-full"
                onClick={() => setCreateOpen(true)}
              >
                <PlusIcon className="size-4" aria-hidden />
                New Tree
              </Button>
            </header>

            {sections.map((section) => {
              if (section === "tree-library") {
                return <HomeYourTrees key={section} />;
              }
              return null;
            })}
          </main>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl">New Culture Tree</DialogTitle>
              <DialogDescription className="font-body text-base leading-relaxed">
                Name a tree to build by hand, or start an AI-assisted Seed.
              </DialogDescription>
            </DialogHeader>
            <HomeSeedForm
              prompt={prompt}
              setPrompt={setPrompt}
              onSeedHover={setSeedHovered}
              variant="compact"
              onCreated={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col bg-background text-foreground">
      <div className="relative z-2 flex flex-1 flex-col items-center justify-center">
        <main className="flex w-full flex-1 flex-col items-center justify-center gap-10 px-4 py-16">
          {sections.map((section) => {
            if (section === "hero") {
              return <HomeHero key={section} seedHovered={seedHovered} />;
            }
            if (section === "start-tree") {
              return (
                <HomeSeedForm
                  key={section}
                  prompt={prompt}
                  setPrompt={setPrompt}
                  onSeedHover={setSeedHovered}
                />
              );
            }
            if (section === "suggestions") {
              return <HomeSuggestions key={section} setPrompt={setPrompt} />;
            }
            return null;
          })}
        </main>

        <div className="shrink-0 pb-8 text-center">
          <span className="font-mono text-[0.6rem] tracking-[0.14em] text-muted-foreground/50 uppercase">
            Music · Films · Books · Art · People · Places · Vibes
          </span>
        </div>
      </div>
    </div>
  );
}
