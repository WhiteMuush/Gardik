import { getSession } from "@/lib/auth/session"
import { listRegister } from "@/lib/register"
import { ExposureRegister } from "@/components/register/ExposureRegister"

export default async function RegisterPage() {
  const session = await getSession()
  const isAdmin = session!.user.role === "ADMIN"
  const entries = await listRegister(session!.user.companyId)

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Exposure Register</h2>
        <p className="text-sm text-muted-foreground">
          GDPR Article 33/30 record of confirmed exposures, with a 72-hour notification countdown.
        </p>
      </div>
      <ExposureRegister initial={entries} isAdmin={isAdmin} />
    </div>
  )
}
