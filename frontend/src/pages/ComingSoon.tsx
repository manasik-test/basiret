import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface ComingSoonProps {
  titleKey: string
  questionKey: string
  icon?: LucideIcon
}

export default function ComingSoon({ titleKey, questionKey, icon: Icon }: ComingSoonProps) {
  const { t } = useTranslation()
  const HeadIcon = Icon ?? Sparkles

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="glass rounded-2xl p-10 max-w-lg w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-5">
          <HeadIcon className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2" dir="auto">
          {t(titleKey)}
        </h2>
        <p className="text-sm text-muted-foreground mb-6" dir="auto">
          {t(questionKey)}
        </p>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/30 text-primary text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          {t('comingSoon.badge')}
        </span>
      </div>
    </div>
  )
}
