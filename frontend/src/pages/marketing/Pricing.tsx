import { Pricing } from "@/components/landing/pricing";
import { ComparisonTable } from "@/components/landing/comparison-table";
import { FAQ } from "@/components/landing/faq";
import { CTAMarquee } from "@/components/landing/cta-marquee";

export default function PricingPage() {
  return (
    <main className="pt-16">
      <Pricing />
      <ComparisonTable />
      <FAQ />
      <CTAMarquee />
    </main>
  );
}
