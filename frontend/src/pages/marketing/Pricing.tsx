import { Pricing } from "@/components/landing/pricing";
import { FAQ } from "@/components/landing/faq";
import { CTABanner } from "@/components/landing/cta-banner";

export default function PricingPage() {
  return (
    <main className="pt-16">
      <Pricing />
      <FAQ />
      <CTABanner />
    </main>
  );
}
