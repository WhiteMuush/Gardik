import Image from "next/image"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RecommendationLevel } from "@/lib/credentials/providers"
import type { SourceHealth } from "@/lib/credentials/health"

export function SourceAvatar({
  initials,
  logo,
  size = "md",
}: {
  initials: string
  logo: string | null
  size?: "md" | "lg"
}) {
  const box = size === "md" ? "size-10" : "size-12"
  if (logo) {
    return (
      <span aria-hidden className={cn("shrink-0 overflow-hidden rounded-lg border border-border/60 bg-white", box)}>
        {/* unoptimized: the image ships without sharp, and these are small static icons */}
        <Image src={logo} alt="" width={48} height={48} unoptimized className="size-full object-contain p-1" />
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary",
        box,
        size === "md" ? "text-sm" : "text-base"
      )}
    >
      {initials}
    </span>
  )
}

export function LevelBadge({ level, className }: { level: RecommendationLevel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        level === "Recommended" && "bg-primary/10 text-primary",
        level === "Additional" && "bg-muted text-muted-foreground",
        level === "Free or limited" && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
        className
      )}
    >
      {level === "Recommended" && <Star className="size-3 fill-current" />}
      {level}
    </span>
  )
}

export function HealthPill({ health }: { health: SourceHealth }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-[60%] items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-xs font-medium",
        health.status === "CONNECTED" && "bg-green-500/10 text-green-700 dark:text-green-400",
        health.status === "NEEDS_ACTION" && "bg-destructive/10 text-destructive",
        health.status === "NOT_SCANNED" && "bg-blue-500/10 text-blue-700 dark:text-blue-400",
        health.status === "NOT_CONNECTED" && "bg-muted text-muted-foreground"
      )}
      title={health.label}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          health.status === "CONNECTED" && "bg-green-500",
          health.status === "NEEDS_ACTION" && "bg-destructive",
          health.status === "NOT_SCANNED" && "bg-blue-500",
          health.status === "NOT_CONNECTED" && "bg-muted-foreground/50"
        )}
      />
      <span className="truncate">{health.label}</span>
    </span>
  )
}
