import { Lock } from "lucide-react"

// Shown in place of a page the caller's role does not open. Deliberately not a
// redirect: bouncing to the dashboard hides whether the page exists at all, and
// a user who typed the address deserves to know their role is the reason rather
// than wonder whether the link is broken. It says nothing about what the page
// contains.
export function NoAccess() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <Lock className="mx-auto size-6 text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold text-foreground">Not available to your role</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask an administrator if you need access to this section.
        </p>
      </div>
    </div>
  )
}
