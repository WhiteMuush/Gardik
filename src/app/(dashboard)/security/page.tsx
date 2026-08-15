import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { hasValidStepUp } from "@/lib/rbac/step-up"
import { SecuritySettings } from "@/components/settings/SecuritySettings"
import { StepUpGate } from "@/components/settings/StepUpGate"

// The account section. Deliberately not /settings: next.config.ts keeps a
// permanent redirect from that path to /data-sources, and a 308 already cached
// by a browser would keep sending users away from here.
export default async function SecurityPage() {
  const session = await getSession()
  const userId = session!.user.id

  const [stepUp, credential] = await Promise.all([
    hasValidStepUp(prisma, userId),
    prisma.account.findFirst({
      where: { userId, providerId: "credential" },
      select: { id: true },
    }),
  ])

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">My account</h2>
        <p className="text-sm text-muted-foreground">
          Your sign-in methods, and the authentication policy this company enforces.
        </p>
      </div>
      <div className="max-w-3xl space-y-4">
        {stepUp ? (
          <SecuritySettings />
        ) : (
          <StepUpGate
            hasPassword={credential !== null}
            hasTwoFactor={session!.user.twoFactorEnabled === true}
          />
        )}
      </div>
    </div>
  )
}
