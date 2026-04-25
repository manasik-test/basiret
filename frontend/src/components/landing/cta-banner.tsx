import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContainerAnimated,
  ContainerStagger,
  GalleryGrid,
  GalleryGridCell,
} from "@/components/ui/cta-section-with-gallery";
import { useI18n } from "@/lib/marketing-i18n";

const IMAGES = [
  "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1611162616475-46b635cb6868?q=80&w=2000&auto=format&fit=crop",
];

export function CTABanner() {
  const { t, dir } = useI18n();

  return (
    <section dir={dir} className="bg-[#F5F3FF] py-16 sm:py-24">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 py-4 sm:px-6 md:grid-cols-2 md:gap-12">
        <ContainerStagger className="text-center md:text-left rtl:md:text-right">
          <ContainerAnimated className="mb-4 block text-xs font-semibold uppercase tracking-[0.2em] text-[#664FA1] md:text-sm">
            {t("Ready to grow?", "جاهز للنمو؟")}
          </ContainerAnimated>
          <ContainerAnimated className="text-3xl font-bold tracking-tight text-[#484848] sm:text-4xl md:text-[2.6rem] md:leading-[1.1]">
            {t(
              "Grow your social presence with confidence",
              "نمِّ حضورك الاجتماعي بثقة"
            )}
          </ContainerAnimated>
          <ContainerAnimated className="my-5 text-base leading-relaxed text-gray-500 md:my-7 md:text-lg">
            {t(
              "Join thousands of creators and businesses who trust Basiret to grow smarter — actions, not dashboards.",
              "انضم لآلاف المبدعين والشركات الذين يثقون ببصيرة للنمو بذكاء — خطوات عملية لا لوحات تحكم."
            )}
          </ContainerAnimated>
          <ContainerAnimated className="flex flex-col items-center gap-3 md:items-start">
            <Link to="/register">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Button className="h-12 cursor-pointer rounded-xl bg-[#664FA1] px-7 font-semibold text-white hover:bg-[#5A4590] shadow-lg shadow-[#664FA1]/25 flex items-center gap-2">
                  {t("Get Started for Free", "ابدأ مجاناً")}
                  <ArrowRight className="size-4 rtl:rotate-180" />
                </Button>
              </motion.div>
            </Link>
            <p className="text-sm text-gray-400">
              {t("No credit card needed. Free forever.", "لا حاجة لبطاقة ائتمان. مجاني للأبد.")}
            </p>
          </ContainerAnimated>
        </ContainerStagger>

        <GalleryGrid>
          {IMAGES.map((imageUrl, index) => (
            <GalleryGridCell index={index} key={index}>
              <img
                className="size-full object-cover object-center"
                width="100%"
                height="100%"
                src={imageUrl}
                alt=""
              />
            </GalleryGridCell>
          ))}
        </GalleryGrid>
      </div>
    </section>
  );
}
