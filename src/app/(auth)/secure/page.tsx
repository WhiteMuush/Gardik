import { redirect } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { needsTwoFactorEnrollment } from "@/lib/auth/two-factor-gate"
import { PasswordChange } from "@/components/settings/PasswordChange"
import { TwoFactorSetup } from "@/components/settings/TwoFactorSetup"

// Everything a user is required to do before the dashboard opens, on its own
// screen outside the dashboard shell. Deliberately not a page inside the
// application: there is no navigation, no sidebar and nothing else to click,
// because none of it is available to them yet anyway.
//
// Steps run in order and the page re-evaluates after each one, so a user who
// owes both a password rotation and a second factor sees them one at a time.
export default async function SecurePage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [company, credential] = await Promise.all([
    prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { require2fa: true, allowedAuthMethods: true },
    }),
    prisma.account.findFirst({
      where: { userId: session.user.id, providerId: "credential" },
      select: { id: true },
    }),
  ])

  const mustChangePassword = session.user.mustChangePassword === true && credential !== null
  const mustEnrollTwoFactor = needsTwoFactorEnrollment({
    companyRequires2fa: company?.require2fa ?? false,
    userHasTwoFactor: session.user.twoFactorEnabled ?? false,
    userHasPassword: credential !== null,
  })

  // Nothing owed: this page has no reason to exist for this user.
  if (!mustChangePassword && !mustEnrollTwoFactor) redirect("/dashboard")

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <span className="text-base font-semibold text-foreground">DataShield</span>
        </div>

        {mustChangePassword ? (
          <>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Choose a new password</h1>
              <p className="text-sm text-muted-foreground">
                An administrator requires it before you continue.
              </p>
            </div>
            <PasswordChange required continueTo="/secure" />
          </>
        ) : (
          <>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Set up two-factor authentication
              </h1>
              <p className="text-sm text-muted-foreground">
                This company requires a second factor before the dashboard opens.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <TwoFactorSetup enabled={false} continueTo="/dashboard" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
