import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import { Providers } from "@/components/providers"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <Providers>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          companyName={session.user.name ?? ""}
          userEmail={session.user.email ?? ""}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </Providers>
  )
}
