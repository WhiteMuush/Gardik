import Link from "next/link"
import {
  CheckCircle2,
  Circle,
  Database,
  KeyRound,
  ScanSearch,
  ArrowRight,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Step = {
  icon: typeof Database
  title: string
  description: string
  href: string
  cta: string
  done: boolean
}

export function SetupChecklist({
  hasEmployees,
  hasApiKey,
  visible,
  children,
}: {
  hasEmployees: boolean
  hasApiKey: boolean
  /**
   * Paths this role may open, resolved server-side from the same map the
   * layout enforces. A step whose target is not in here keeps its title and
   * description and loses only its link: the person should still learn what
   * the company is missing, which is what the "managed by admins" note below
   * then accounts for.
   */
  visible: string[]
  children?: React.ReactNode
}) {
  const steps: Step[] = [
    {
      icon: Database,
      title: "Add employees to monitor",
      description: "Connect a corporate directory (Azure AD, Google Workspace, LDAP...) to import the people you want to watch.",
      href: "/data-sources",
      cta: "Connect a data source",
      done: hasEmployees,
    },
    {
      icon: KeyRound,
      title: "Add a breach intelligence key",
      description: "A provider key (HIBP, Dehashed...) lets Gardik look your employees up against known breaches.",
      href: "/data-api",
      cta: "Add an API key",
      done: hasApiKey,
    },
    {
      icon: ScanSearch,
      title: "Run your first scan",
      description: "Once people and a key are in place, scan to detect exposures and generate alerts.",
      href: "/employees",
      cta: "Go to employees",
      done: false,
    },
  ]

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground">Welcome to Gardik</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Self-hosted monitoring of your employees exposure in known data breaches. Complete
            these steps to start monitoring.
          </p>
        </div>

        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li
              key={step.href}
              className={cn(
                "flex items-start gap-4 rounded-xl border border-border/60 bg-card p-4",
                step.done && "opacity-60"
              )}
            >
              <div className="mt-0.5 shrink-0">
                {step.done ? (
                  <CheckCircle2 className="size-5 text-severity-ok" />
                ) : (
                  <Circle className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <step.icon className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-foreground">
                    {i + 1}. {step.title}
                  </h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                {!step.done && visible.includes(step.href) && (
                  <Link
                    href={step.href}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-sidebar-primary hover:underline"
                  >
                    {step.cta}
                    <ArrowRight className="size-3.5" />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>

        {/* The explanation for the buttons that are not there, so it appears
            exactly when one is missing. It used to be keyed on users:manage,
            which governs neither the steps nor their links: a role holding it
            without connectors:read saw stripped steps and no account of why. */}
        {steps.some((step) => !step.done && !visible.includes(step.href)) && (
          <p className="mt-4 text-xs text-muted-foreground">
            Data sources and API keys are managed by admins. Ask an admin to complete the setup.
          </p>
        )}

        <div className="mt-8 rounded-xl border border-border/60 bg-muted/30 p-4">
          <p className="text-sm text-foreground">Thanks for trying Gardik.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            It is an open-source project built to make breach exposure visible and actionable.
            Found a bug or have an idea? Your feedback genuinely helps it grow.
          </p>
          <a
            href="https://github.com/WhiteMuush/Gardik/issues"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sidebar-primary hover:underline"
          >
            Open an issue or share feedback
            <ExternalLink className="size-3" />
          </a>
        </div>

        {children && <div className="mt-8">{children}</div>}
      </div>
    </div>
  )
}
