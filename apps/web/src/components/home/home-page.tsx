import { HomeHero } from "~/components/home/home-hero";
import { HomeRecentTrees } from "~/components/home/home-recent-trees";
import { HomeSeedForm } from "~/components/home/home-seed-form";
import { HomeSuggestions } from "~/components/home/home-suggestions";

export function HomePage() {
  return (
    <div className="relative flex flex-1 flex-col bg-background text-foreground">
      <div className="relative z-2 flex flex-1 flex-col items-center">
        <main className="flex w-full flex-1 flex-col items-center gap-8 md:p-8">
          <HomeHero />
          <HomeSeedForm />
          <HomeRecentTrees />
          <HomeSuggestions />
        </main>
      </div>
    </div>
  );
}
