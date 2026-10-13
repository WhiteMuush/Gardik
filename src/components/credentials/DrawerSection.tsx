import { cn } from "@/lib/utils"

export const inputClass = cn(
  "h-8 rounded-md border border-border bg-background px-2.5 text-xs",
  "text-foreground outline-none focus:ring-1 focus:ring-ring"
)

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border p-5 last:border-b-0">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}
