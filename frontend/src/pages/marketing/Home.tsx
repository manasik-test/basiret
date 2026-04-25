import { Hero } from "@/components/landing/hero";
import { StatsCounter } from "@/components/landing/stats-counter";
import { Marquee } from "@/components/landing/marquee";
import { Problem } from "@/components/landing/problem";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Features } from "@/components/landing/features";
import { SocialProof } from "@/components/landing/social-proof";
import { CTABanner } from "@/components/landing/cta-banner";

export default function Home() {
  return (
    <main>
      <Hero />
      <StatsCounter />
      <Marquee />
      <Problem />
      <HowItWorks />
      <Features />
      <SocialProof />
      <CTABanner />
    </main>
  );
}
