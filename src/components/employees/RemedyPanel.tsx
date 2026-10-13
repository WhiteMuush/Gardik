import Link from "next/link"
import { ExternalLink } from "lucide-react"
import type { Remedy, RemedyStep } from "@/lib/scan/remedies"

function StepLink({ step }: { step: RemedyStep }) {
  if (!step.href) return null
  const className = "ml-1 inline-flex items-center gap-1 text-primary hover:underline"
  if (step.href.startsWith("/")) {
    return (
      <Link href={step.href} className={className}>
        {step.linkLabel}
      </Link>
    )
  }
  return (
    <a href={step.href} target="_blank" rel="noopener noreferrer" className={className}>
      {step.linkLabel} <ExternalLink className="size-3" />
    </a>
  )
}

export function RemedyPanel({ remedy }: { remedy: Remedy }) {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">{remedy.title}</p>
      <p>{remedy.explanation}</p>
      <p className="font-medium text-foreground">How to fix it</p>
      <ol className="list-decimal space-y-1 pl-4">
        {remedy.steps.map((step) => (
          <li key={step.text}>
            {step.text}
            <StepLink step={step} />
          </li>
        ))}
      </ol>
    </div>
  )
}
