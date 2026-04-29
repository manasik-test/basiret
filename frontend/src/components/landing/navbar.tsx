import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  Globe,
  ChevronDown,
  Users,
  Sparkles,
  Calendar,
  Radar,
  Bot,
  Music2,
  Store,
  UserCircle,
  Briefcase,
  Building2,
  BookOpen,
  LayoutTemplate,
  Wrench,
  Compass,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { Button } from "@/components/ui/button";
import {
  InstagramIcon,
  FacebookIcon,
  LinkedInIcon,
  XIcon as TwitterIcon,
} from "@/components/ui/social-icons";
import { useI18n } from "@/lib/marketing-i18n";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

type NavItem = {
  en: string;
  ar: string;
  href: string;
  desc?: { en: string; ar: string };
  icon?: LucideIcon;
  soon?: boolean;
};

type NavGroup = {
  en: string;
  ar: string;
  items: NavItem[];
};

const featuresGroup: NavGroup = {
  en: "Features",
  ar: "المميزات",
  items: [
    {
      en: "Audience insights",
      ar: "رؤى الجمهور",
      href: "/features/audience",
      desc: { en: "Who follows you, personas, signals", ar: "من يتابعك، الشخصيات، الإشارات" },
      icon: Users,
    },
    {
      en: "Action plan",
      ar: "خطة العمل",
      href: "/features/action-plan",
      desc: { en: "Daily 3 actions, why they matter", ar: "3 إجراءات يومية ولماذا تهم" },
      icon: Sparkles,
    },
    {
      en: "Content planner",
      ar: "مخطط المحتوى",
      href: "/features/content-planner",
      desc: { en: "What to post, when, calendar view", ar: "ماذا تنشر، ومتى، وعرض التقويم" },
      icon: Calendar,
    },
    {
      en: "Competitor tracking",
      ar: "تتبع المنافسين",
      href: "/features/competitors",
      desc: { en: "Watch what rivals are doing", ar: "راقب ما يفعله المنافسون" },
      icon: Radar,
      soon: true,
    },
    {
      en: "AI advisor",
      ar: "مستشار الذكاء الاصطناعي",
      href: "/features/ai-advisor",
      desc: { en: "Ask Basiret anything", ar: "اسأل بصيرة أي شيء" },
      icon: Bot,
      soon: true,
    },
  ],
};

const channelsGroup: NavGroup = {
  en: "Channels",
  ar: "المنصات",
  items: [
    { en: "Instagram", ar: "انستقرام", href: "/channels/instagram", icon: InstagramIcon },
    { en: "Facebook", ar: "فيسبوك", href: "/channels/facebook", icon: FacebookIcon },
    { en: "TikTok", ar: "تيك توك", href: "/channels/tiktok", icon: Music2 },
    { en: "LinkedIn", ar: "لينكدإن", href: "/channels/linkedin", icon: LinkedInIcon, soon: true },
    { en: "X / Twitter", ar: "إكس / تويتر", href: "/channels/x", icon: TwitterIcon, soon: true },
  ],
};

const forGroup: NavGroup = {
  en: "Made for",
  ar: "مصمم لـ",
  items: [
    {
      en: "Small businesses",
      ar: "الشركات الصغيرة",
      href: "/for/small-business",
      desc: { en: "Grow your business online", ar: "نمِّ أعمالك على الإنترنت" },
      icon: Store,
    },
    {
      en: "Creators",
      ar: "المبدعون",
      href: "/for/creators",
      desc: { en: "Built for content creators", ar: "مصمم لصنّاع المحتوى" },
      icon: UserCircle,
    },
    {
      en: "Agencies",
      ar: "الوكالات",
      href: "/for/agencies",
      desc: { en: "Manage multiple clients with ease", ar: "أدِر عملاء متعددين بسهولة" },
      icon: Briefcase,
    },
    {
      en: "Enterprise",
      ar: "المؤسسات",
      href: "/for/enterprise",
      desc: { en: "Scale, security, custom setup", ar: "التوسع والأمان والإعداد المخصص" },
      icon: Building2,
    },
  ],
};

const resourcesGroup: NavGroup = {
  en: "Resources",
  ar: "الموارد",
  items: [
    {
      en: "Blog",
      ar: "المدونة",
      href: "/blog",
      desc: { en: "Guides, insights, case studies", ar: "أدلة، رؤى، دراسات حالة" },
      icon: BookOpen,
    },
    {
      en: "Templates",
      ar: "قوالب",
      href: "/resources/templates",
      desc: { en: "Ready-made content templates", ar: "قوالب محتوى جاهزة" },
      icon: LayoutTemplate,
      soon: true,
    },
    {
      en: "Free tools",
      ar: "أدوات مجانية",
      href: "/resources/free-tools",
      desc: { en: "Bio generator, hashtag finder", ar: "مولد السيرة الذاتية، باحث الهاشتاقات" },
      icon: Wrench,
      soon: true,
    },
    {
      en: "Guides",
      ar: "أدلة",
      href: "/resources/guides",
      desc: { en: "Deep dives into growth topics", ar: "غوص عميق في مواضيع النمو" },
      icon: Compass,
      soon: true,
    },
  ],
};

const navGroups: NavGroup[] = [featuresGroup, channelsGroup, forGroup, resourcesGroup];

function DesktopDropdown({
  group,
  open,
  onHover,
  onLeave,
}: {
  group: NavGroup;
  open: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const { t, lang } = useI18n();
  return (
    <div
      className="relative"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <button
        className={`flex items-center gap-1 text-sm transition-colors cursor-pointer ${
          open ? "text-[#484848]" : "text-gray-500 hover:text-[#484848]"
        }`}
      >
        {t(group.en, group.ar)}
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[340px] rounded-2xl border border-gray-200 bg-white p-2 shadow-xl shadow-black/5"
          >
            <div className="flex flex-col">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-[#F5F3FF] group"
                  >
                    {Icon && (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#5433c2]/10 text-[#5433c2] transition-colors group-hover:bg-[#5433c2]/15">
                        <Icon className="size-4" />
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#484848]">
                          {t(item.en, item.ar)}
                        </span>
                        {item.soon && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5433c2] bg-[#5433c2]/10 px-1.5 py-0.5 rounded">
                            {t("Soon", "قريباً")}
                          </span>
                        )}
                      </div>
                      {item.desc && (
                        <p className="mt-0.5 text-xs text-gray-500 leading-snug">
                          {lang === "en" ? item.desc.en : item.desc.ar}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileAccordion({
  group,
  onItemClick,
}: {
  group: NavGroup;
  onItemClick: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { t, lang } = useI18n();
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-3 text-sm text-gray-600 cursor-pointer"
      >
        {t(group.en, group.ar)}
        <ChevronDown
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1 pb-3 ps-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={onItemClick}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-gray-600 transition-colors hover:bg-[#F5F3FF]"
                  >
                    {Icon && <Icon className="size-4 text-[#5433c2]" />}
                    <span>{t(item.en, item.ar)}</span>
                    {item.soon && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5433c2] bg-[#5433c2]/10 px-1.5 py-0.5 rounded">
                        {t("Soon", "قريباً")}
                      </span>
                    )}
                    {item.desc && (
                      <span className="sr-only">{lang === "en" ? item.desc.en : item.desc.ar}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Navbar() {
  const { t, toggle, lang, dir } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleHover = (key: string) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setOpenGroup(key);
  };
  const handleLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setOpenGroup(null), 120);
  };

  return (
    <motion.nav
      dir={dir}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-gray-200 bg-white/90 backdrop-blur-xl shadow-sm"
          : "bg-[#F5F3FF]/80 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-xl font-bold text-[#484848] transition-colors">
            Basiret <span className="text-[#5433c2] group-hover:text-[#4527a8] transition-colors">|</span>{" "}
            <span className="font-tajawal">بصيرة</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navGroups.map((group) => (
            <DesktopDropdown
              key={group.en}
              group={group}
              open={openGroup === group.en}
              onHover={() => handleHover(group.en)}
              onLeave={handleLeave}
            />
          ))}
          <Link
            to="/pricing"
            className="relative text-sm text-gray-500 transition-colors hover:text-[#484848] group"
          >
            {t("Pricing", "الأسعار")}
          </Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <button
            onClick={toggle}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-500 transition-all hover:bg-gray-100 hover:text-[#484848] cursor-pointer"
          >
            <Globe className="size-4" />
            {lang === "en" ? "عربي" : "EN"}
          </button>
          <Link
            to="/login"
            className="text-sm text-gray-500 hover:text-[#484848] transition-colors cursor-pointer"
          >
            {t("Log in", "تسجيل الدخول")}
          </Link>
          <Link to="/register">
            <Button className="bg-[#5433c2] text-white font-semibold hover:bg-[#4527a8] transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]">
              {t("Start free", "ابدأ مجاناً")}
            </Button>
          </Link>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-[#484848] md:hidden cursor-pointer p-1"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="overflow-hidden border-t border-gray-200 bg-white/95 backdrop-blur-xl md:hidden max-h-[calc(100vh-4rem)] overflow-y-auto"
          >
            <div className="flex flex-col px-4 py-4">
              {navGroups.map((group) => (
                <MobileAccordion
                  key={group.en}
                  group={group}
                  onItemClick={() => setMobileOpen(false)}
                />
              ))}
              <Link
                to="/pricing"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between border-b border-gray-100 py-3 text-sm text-gray-600"
              >
                {t("Pricing", "الأسعار")}
              </Link>
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between border-b border-gray-100 py-3 text-sm text-gray-600"
              >
                {t("Log in", "تسجيل الدخول")}
              </Link>
              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={toggle}
                  className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer"
                >
                  <Globe className="size-4" />
                  {lang === "en" ? "عربي" : "EN"}
                </button>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="ml-auto">
                  <Button className="bg-[#5433c2] text-white font-semibold hover:bg-[#4527a8] cursor-pointer">
                    {t("Start free", "ابدأ مجاناً")}
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
