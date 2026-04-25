import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FloatingIcon } from "@/components/ui/floating-icon";
import { FluidCanvas } from "@/components/landing/fluid-canvas";
import { useI18n } from "@/lib/marketing-i18n";
import {
  ArrowRight,
  Heart,
  MessageCircle,
  Share2,
  Play,
  Bookmark,
  Send,
  ThumbsUp,
  Repeat2,
  type LucideIcon,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 15 },
  },
} as const;

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}
function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-9" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-9" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
function PinterestIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.437-2.889-2.437-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.358-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  );
}
function BlueskyIcon() {
  return (
    <svg viewBox="0 0 568 501" className="size-8" fill="currentColor">
      <path d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.21C491.866-1.58 568-28.355 568 58.523c0 17.34-9.945 145.666-15.778 166.497-20.275 72.453-94.155 90.933-159.875 79.748C507.182 324.042 536.22 388.34 473.233 452.638c-119.62 122.112-171.918-30.614-185.317-69.767C285.444 375.859 284.233 372.573 284 369.832c-.233 2.741-1.444 6.027-3.916 13.039-13.399 39.153-65.697 191.879-185.317 69.767C31.78 388.34 60.818 324.042 176.653 304.768 110.933 315.953 37.053 297.473 16.778 225.02 10.945 204.189 1 75.863 1 58.523c0-86.879 76.134-60.103 123.121-24.859z" />
    </svg>
  );
}
function ThreadsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="currentColor">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.958-3.898-5.980-8.304-6.011-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.16 1.43 1.781 3.631 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.745-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z" />
    </svg>
  );
}

const TILE_SIZE = "w-11 h-11";
type SocialTile = {
  Icon: () => React.ReactNode;
  color: string;
  bg: string;
  pos: string;
  rounded: string;
  mobile?: boolean;
  mobilePos?: string;
};
const socialTiles: SocialTile[] = [
  { Icon: XIcon, color: "text-white", bg: "bg-black", pos: "top-[9%] left-[38%]", rounded: "rounded-xl" },
  { Icon: BlueskyIcon, color: "text-[#1185FE]", bg: "bg-white", pos: "top-[9%] right-[36%]", rounded: "rounded-xl" },
  { Icon: InstagramIcon, color: "text-white", bg: "bg-gradient-to-br from-[#FEDA75] via-[#FA7E1E] via-[#D62976] to-[#962FBF]", pos: "top-[20%] left-[4%]", rounded: "rounded-xl", mobile: true, mobilePos: "top-[14%] left-[5%]" },
  { Icon: YouTubeIcon, color: "text-white", bg: "bg-[#FF0000]", pos: "top-[36%] left-[12%]", rounded: "rounded-xl" },
  { Icon: LinkedInIcon, color: "text-white", bg: "bg-[#0A66C2]", pos: "top-[56%] left-[3%]", rounded: "rounded-xl" },
  { Icon: TikTokIcon, color: "text-black", bg: "bg-white", pos: "top-[78%] left-[10%]", rounded: "rounded-xl", mobile: true, mobilePos: "top-[86%] left-[6%]" },
  { Icon: PinterestIcon, color: "text-white", bg: "bg-[#E60023]", pos: "top-[20%] right-[5%]", rounded: "rounded-xl", mobile: true, mobilePos: "top-[14%] right-[5%]" },
  { Icon: ThreadsIcon, color: "text-black", bg: "bg-white", pos: "top-[36%] right-[14%]", rounded: "rounded-xl" },
  { Icon: FacebookIcon, color: "text-white", bg: "bg-[#1877F2]", pos: "top-[64%] right-[3%]", rounded: "rounded-xl" },
  { Icon: YouTubeIcon, color: "text-white", bg: "bg-[#FF0000]", pos: "top-[78%] right-[14%]", rounded: "rounded-xl", mobile: true, mobilePos: "top-[86%] right-[6%]" },
  { Icon: TikTokIcon, color: "text-black", bg: "bg-white", pos: "top-[91%] left-[44%]", rounded: "rounded-xl" },
  { Icon: InstagramIcon, color: "text-white", bg: "bg-gradient-to-br from-[#FEDA75] via-[#FA7E1E] via-[#D62976] to-[#962FBF]", pos: "top-[91%] right-[42%]", rounded: "rounded-xl" },
];

const GHOST_SIZE = "w-9 h-9";
type GhostTileDef = {
  bg: string;
  tint: string;
  pos: string;
  Icon: LucideIcon;
  mobile?: boolean;
  mobilePos?: string;
};
const ghostTiles: GhostTileDef[] = [
  { bg: "bg-[#FFE4E1]", tint: "text-[#E87A87]", pos: "top-[12%] left-[3%]", Icon: Heart, mobile: true, mobilePos: "top-[8%] left-[3%]" },
  { bg: "bg-[#E6E6FA]", tint: "text-[#8A7BB8]", pos: "top-[22%] left-[20%]", Icon: MessageCircle },
  { bg: "bg-[#E0F7FA]", tint: "text-[#4FB8C4]", pos: "top-[30%] left-[7%]", Icon: Share2 },
  { bg: "bg-[#FFF8DC]", tint: "text-[#C9A83A]", pos: "top-[46%] left-[22%]", Icon: Play },
  { bg: "bg-[#F0E6FF]", tint: "text-[#8C6FC9]", pos: "top-[58%] left-[11%]", Icon: Bookmark },
  { bg: "bg-[#D5F5EC]", tint: "text-[#3FB58A]", pos: "top-[70%] left-[22%]", Icon: Send },
  { bg: "bg-[#FFE5EC]", tint: "text-[#D55F8E]", pos: "top-[86%] left-[6%]", Icon: ThumbsUp, mobile: true, mobilePos: "top-[78%] left-[4%]" },
  { bg: "bg-[#E6F7FF]", tint: "text-[#4AA8E0]", pos: "top-[48%] left-[8%]", Icon: Repeat2 },
  { bg: "bg-[#FFF0E5]", tint: "text-[#D18A5C]", pos: "top-[14%] right-[16%]", Icon: Heart, mobile: true, mobilePos: "top-[8%] right-[3%]" },
  { bg: "bg-[#E0F2FE]", tint: "text-[#4A9CD6]", pos: "top-[28%] right-[4%]", Icon: MessageCircle },
  { bg: "bg-[#F5E6FF]", tint: "text-[#9A6FCB]", pos: "top-[44%] right-[18%]", Icon: Share2 },
  { bg: "bg-[#E6FFF0]", tint: "text-[#3FB58A]", pos: "top-[52%] right-[10%]", Icon: Bookmark },
  { bg: "bg-[#FFF4D6]", tint: "text-[#C9A83A]", pos: "top-[68%] right-[22%]", Icon: Play },
  { bg: "bg-[#FFE5F0]", tint: "text-[#D55F8E]", pos: "top-[82%] right-[10%]", Icon: Send, mobile: true, mobilePos: "top-[78%] right-[4%]" },
  { bg: "bg-[#E6F7FF]", tint: "text-[#4AA8E0]", pos: "top-[86%] right-[26%]", Icon: ThumbsUp },
  { bg: "bg-[#F0E6FF]", tint: "text-[#8C6FC9]", pos: "top-[5%] left-[26%]", Icon: Repeat2 },
  { bg: "bg-[#FFE4E1]", tint: "text-[#E87A87]", pos: "top-[4%] right-[22%]", Icon: Heart },
  { bg: "bg-[#D5F5EC]", tint: "text-[#3FB58A]", pos: "top-[94%] left-[28%]", Icon: MessageCircle },
  { bg: "bg-[#E0F2FE]", tint: "text-[#4A9CD6]", pos: "top-[94%] right-[28%]", Icon: Share2 },
  { bg: "bg-[#FFF0E5]", tint: "text-[#D18A5C]", pos: "top-[95%] left-[60%]", Icon: Play },
];

function FloatingSocialTile({ Icon, color, bg, pos, rounded, index, mobile, mobilePos }: SocialTile & { index: number }) {
  const className = mobile
    ? `${mobilePos} flex lg:hidden z-[5] pointer-events-none`
    : `${pos} hidden lg:flex z-[5] pointer-events-none`;
  return (
    <FloatingIcon
      className={className}
      innerClassName={`${mobile ? "w-9 h-9" : TILE_SIZE} ${bg} ${color} ${rounded} shadow-md shadow-black/[0.08] ring-1 ring-black/5 [&_svg]:size-5`}
      index={index}
      float={false}
    >
      <Icon />
    </FloatingIcon>
  );
}

function GhostTile({ bg, tint, pos, Icon, mobile, mobilePos }: GhostTileDef) {
  const className = mobile
    ? `${mobilePos} flex lg:hidden`
    : `${pos} hidden lg:flex`;
  return (
    <div
      aria-hidden
      className={`${className} ${mobile ? "w-7 h-7" : GHOST_SIZE} ${bg} absolute z-[2] pointer-events-none rounded-xl opacity-35 items-center justify-center`}
    >
      <Icon className={`${mobile ? "size-3.5" : "size-4"} ${tint}`} strokeWidth={2} />
    </div>
  );
}

export function Hero() {
  const { t, dir } = useI18n();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <>
      <section
        ref={ref}
        dir={dir}
        className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 bg-white"
      >
        <FluidCanvas />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(102,79,161,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(102,79,161,0.04) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        {ghostTiles.map((tile, i) => (
          <GhostTile key={`ghost-d-${i}`} {...tile} mobile={false} />
        ))}
        {ghostTiles.filter((t) => t.mobile).map((tile, i) => (
          <GhostTile key={`ghost-m-${i}`} {...tile} />
        ))}

        {socialTiles.map((tile, i) => (
          <FloatingSocialTile key={`social-d-${i}`} {...tile} index={i} mobile={false} />
        ))}
        {socialTiles.filter((t) => t.mobile).map((tile, i) => (
          <FloatingSocialTile key={`social-m-${i}`} {...tile} index={i} />
        ))}

        <motion.div
          style={{ y, opacity }}
          className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6 pointer-events-none"
        >
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <motion.h1
              variants={itemVariants}
              className="mb-7 text-[2.5rem] font-extrabold leading-[1.05] tracking-[-0.02em] text-[#484848] sm:mb-8 sm:text-6xl md:text-7xl lg:text-[5rem] drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]"
            >
              {t(
                "Your social media command center",
                "مركز قيادة وسائل التواصل الاجتماعي"
              )}
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-gray-600 sm:mb-12 sm:text-xl md:text-2xl"
            >
              {t(
                "Grow consistently without the chaos",
                "انمو باستمرار دون فوضى"
              )}
            </motion.p>

            <motion.div variants={itemVariants}>
              <div className="mx-auto flex max-w-xl flex-col items-stretch justify-center gap-3 sm:flex-row sm:gap-4">
                <Link to="/features/audience" className="w-full sm:w-auto">
                  <motion.span
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    className="block"
                  >
                    <Button className="pointer-events-auto h-14 w-full rounded-full border border-gray-300 bg-white px-10 text-base font-semibold text-[#484848] hover:bg-gray-50 cursor-pointer flex items-center justify-center gap-2 shadow-sm sm:w-56 md:w-60">
                      {t("Learn more", "اعرف المزيد")}
                    </Button>
                  </motion.span>
                </Link>
                <Link to="/register" className="w-full sm:w-auto">
                  <motion.span
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    className="block"
                  >
                    <Button className="pointer-events-auto h-14 w-full rounded-full bg-[#664FA1] px-10 text-base font-semibold text-white hover:bg-[#5A4590] cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#664FA1]/25 sm:w-56 md:w-60">
                      {t("Start for free", "ابدأ مجاناً")}
                      <ArrowRight className="size-4 rtl:rotate-180" />
                    </Button>
                  </motion.span>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>
    </>
  );
}
