import { HomeHero } from "~/components/home/home-hero";
import { HomeSeedForm } from "~/components/home/home-seed-form";
import { HomeSuggestions } from "~/components/home/home-suggestions";
import { HomeYourTrees } from "~/components/your-trees-section";

export function HomePage() {
  return (
    <div className="relative flex flex-1 flex-col bg-background text-foreground">
      <div className="relative z-2 flex flex-1 flex-col items-center">
        <main className="flex w-full flex-1 flex-col items-center gap-8 md:p-8">
          <HomeHero />
          <HomeSeedForm />
          <HomeYourTrees />
          <HomeSuggestions />
        </main>
      </div>
    </div>
  );
}
