import { useState } from "react";

import { HomeHero } from "~/components/home/home-hero";
import { HomeSeedForm } from "~/components/home/home-seed-form";
import { HomeSuggestions } from "~/components/home/home-suggestions";
import { HomeYourTrees } from "~/components/your-trees-section";

export function HomePage() {
  const [seedHovered, setSeedHovered] = useState(false);
  const [prompt, setPrompt] = useState("");

  return (
    <div className="relative flex flex-1 flex-col bg-background text-foreground">
      <div className="relative z-2 flex flex-1 flex-col items-center justify-center">
        <main className="flex w-full flex-1 flex-col items-center justify-center gap-10 px-4 py-16">
          <HomeHero seedHovered={seedHovered} />
          <HomeSeedForm prompt={prompt} setPrompt={setPrompt} onSeedHover={setSeedHovered} />
          <HomeSuggestions setPrompt={setPrompt} />
          <HomeYourTrees />
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
