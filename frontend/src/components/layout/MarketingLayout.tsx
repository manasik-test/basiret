import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { ScrollProgress } from "@/components/landing/scroll-progress";

/**
 * Wraps every public marketing route. Replaces Next.js's `app/layout.tsx`.
 * Auth and dashboard routes do NOT use this layout.
 */
export default function MarketingLayout() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#484848]">
      <ScrollProgress />
      <Navbar />
      <Outlet />
      <Footer />
    </div>
  );
}
