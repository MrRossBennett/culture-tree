import { HomeFooter } from "~/components/home/home-footer";
import { HomeGrain } from "~/components/home/home-grain";
import { HomeHeader } from "~/components/home/home-header";
import { HomeHero } from "~/components/home/home-hero";
import { HomeSeedForm } from "~/components/home/home-seed-form";
import { HomeSuggestions } from "~/components/home/home-suggestions";

export function HomePage() {
  return (
    <div className="relative min-h-svh bg-background text-foreground">
      <HomeGrain />
      <div className="relative z-[2] flex min-h-svh flex-col items-center">
        <HomeHeader />
        <main className="flex w-full flex-1 flex-col items-center gap-8 md:p-8">
          <HomeHero />
          <HomeSeedForm />
          <HomeSuggestions />
        </main>
        <HomeFooter />
      </div>
    </div>
  );
}
