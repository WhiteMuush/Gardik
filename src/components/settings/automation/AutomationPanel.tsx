import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type Feature = { icon: LucideIcon; title: string; text: string }

type Props = {
  title: string
  description: string
  status: { on: boolean; label: string }
  action?: React.ReactNode
  features: Feature[]
  children: React.ReactNode
}

export function AutomationPanel({ title, description, status, action, features, children }: Props) {
  return (
    <div className="py-8">
      <div className="mx-auto max-w-2xl text-center">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              status.on
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            <span
              aria-hidden
              className={cn("size-1.5 rounded-full", status.on ? "bg-green-500" : "bg-muted-foreground/50")}
            />
            {status.label}
          </span>
          {action}
        </div>
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-8 sm:grid-cols-3">
        {features.map(({ icon: Icon, title: featureTitle, text }) => (
          <div key={featureTitle}>
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-foreground">{featureTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-4xl space-y-4">{children}</div>
    </div>
  )
}
