import { Fingerprint, KeyRound, MonitorSmartphone, ShieldCheck, UserRound } from "lucide-react"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { hasValidStepUp } from "@/lib/rbac/step-up"
import { listAccountSessions } from "@/lib/account/sessions"
import { StepUpGate } from "@/components/settings/StepUpGate"
import { TwoFactorSetup } from "@/components/settings/TwoFactorSetup"
import { PasskeySetup } from "@/components/settings/PasskeySetup"
import { CompanySecuritySettings } from "@/components/settings/CompanySecuritySettings"
import { AccountSection } from "@/components/account/AccountSection"
import { ProfileSection } from "@/components/account/ProfileSection"
import { PasswordSection } from "@/components/account/PasswordSection"
import { SessionsSection } from "@/components/account/SessionsSection"

// Not /settings, since next.config.ts permanently redirects it and browsers cache the 308.
export default async function SecurityPage() {
  const session = await getSession()
  const userId = session!.user.id
  const twoFactorEnabled = session!.user.twoFactorEnabled === true

  const [stepUp, credential] = await Promise.all([
    hasValidStepUp(prisma, userId),
    prisma.account.findFirst({ where: { userId, providerId: "credential" }, select: { id: true } }),
  ])

  if (!stepUp) {
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto p-4 sm:p-6">
        <StepUpGate hasPassword={credential !== null} hasTwoFactor={twoFactorEnabled} />
      </div>
    )
  }

  const [user, sessions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        role: { select: { name: true } },
        company: { select: { name: true, allowedAuthMethods: true } },
      },
    }),
    listAccountSessions(prisma, userId, session!.session.token),
  ])
  const methods = user.company.allowedAuthMethods

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="mb-2">
          <h2 className="text-lg font-semibold text-foreground">My account</h2>
          <p className="text-sm text-muted-foreground">
            Your profile, how you sign in, and where you are signed in.
          </p>
        </div>

        <AccountSection
          icon={UserRound}
          title="Profile"
          description="How you appear to the rest of your team."
        >
          <ProfileSection
            name={user.name}
            email={user.email}
            role={user.role?.name ?? "No role"}
            company={user.company.name}
          />
        </AccountSection>

        <AccountSection
          icon={KeyRound}
          title="Password"
          description="Changing it signs out every other session."
        >
          <PasswordSection
            hasPassword={credential !== null}
            twoFactorEnabled={twoFactorEnabled}
            canEnrollTwoFactor={methods.includes("TOTP")}
          />
        </AccountSection>

        {methods.includes("TOTP") && (
          <AccountSection
            icon={ShieldCheck}
            title="Two-factor authentication"
            description="A code from an authenticator app on top of your password."
          >
            <TwoFactorSetup enabled={twoFactorEnabled} />
          </AccountSection>
        )}

        {methods.includes("PASSKEY") && (
          <AccountSection
            icon={Fingerprint}
            title="Passkeys"
            description="Sign in with Face ID, Windows Hello or a security key instead of a password."
          >
            <PasskeySetup />
          </AccountSection>
        )}

        <AccountSection
          icon={MonitorSmartphone}
          title="Active sessions"
          description="Every browser where you are signed in. Sign out the ones you do not recognize."
        >
          <SessionsSection
            sessions={sessions.map((s) => ({
              id: s.id,
              device: s.device,
              ipAddress: s.ipAddress,
              signedIn: s.createdAt.toISOString(),
              lastRefreshed: s.updatedAt.toISOString(),
              current: s.current,
            }))}
          />
        </AccountSection>

        <CompanySecuritySettings heading />
      </div>
    </div>
  )
}
