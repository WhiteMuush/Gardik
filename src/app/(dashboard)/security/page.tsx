import { SecuritySettings } from "@/components/settings/SecuritySettings"

// Deliberately not /settings: next.config.ts keeps a permanent redirect from
// that path to /data-sources, and a 308 already cached by a browser would keep
// sending users away from here even after the config changed.
export default function SecurityPage() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Security</h2>
        <p className="text-sm text-muted-foreground">
          Your sign-in methods, and the authentication policy this company enforces.
        </p>
      </div>
      <div className="max-w-3xl space-y-4">
        <SecuritySettings />
      </div>
    </div>
  )
}
