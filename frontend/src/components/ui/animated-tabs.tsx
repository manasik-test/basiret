import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface AnimatedTabsProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
  panelClassName?: string;
  tabBarClassName?: string;
}

export function AnimatedTabs({
  tabs,
  defaultTab,
  className,
  panelClassName,
  tabBarClassName,
}: AnimatedTabsProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab || tabs[0]?.id);

  if (!tabs?.length) return null;

  return (
    <div className={cn("w-full flex flex-col gap-y-3", className)}>
      <div
        className={cn(
          "flex gap-2 flex-wrap bg-[#4A3A7A]/70 backdrop-blur-sm p-1.5 rounded-2xl ring-1 ring-white/10",
          tabBarClassName
        )}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="relative px-5 py-2.5 text-sm sm:text-base font-medium rounded-xl text-white/80 outline-none transition-colors hover:text-white cursor-pointer"
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="animated-tab-pill"
                className="absolute inset-0 bg-white/15 shadow-[0_0_20px_rgba(191,73,155,0.35)] backdrop-blur-sm !rounded-xl ring-1 ring-white/20"
                transition={{ type: "spring", duration: 0.6 }}
              />
            )}
            <span
              className={cn(
                "relative z-10",
                activeTab === tab.id && "text-white"
              )}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      <div
        className={cn(
          "p-8 sm:p-12 bg-gradient-to-br from-[#664FA1] to-[#4A3A7A] shadow-[0_30px_80px_-20px_rgba(102,79,161,0.5)] text-white rounded-3xl border border-white/10 min-h-[22rem] sm:min-h-[26rem]",
          panelClassName
        )}
      >
        {tabs.map(
          (tab) =>
            activeTab === tab.id && (
              <motion.div
                key={tab.id}
                initial={{
                  opacity: 0,
                  scale: 0.97,
                  x: -8,
                  filter: "blur(8px)",
                }}
                animate={{ opacity: 1, scale: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.97, x: -8, filter: "blur(8px)" }}
                transition={{
                  duration: 0.45,
                  ease: "circInOut",
                  type: "spring",
                }}
              >
                {tab.content}
              </motion.div>
            )
        )}
      </div>
    </div>
  );
}
