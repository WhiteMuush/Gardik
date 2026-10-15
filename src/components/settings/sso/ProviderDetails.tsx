"use client"

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Action, DnsRecord, SsoProvider } from "./types"

type Props = {
  provider: SsoProvider
  canConfigure: boolean
  record: DnsRecord | null
  action: Action
  onRequestRecord: () => void
  onVerify: () => void
}

export function ProviderDetails({
  provider,
  canConfigure,
  record,
  action,
  onRequestRecord,
  onVerify,
}: Props) {
  return (
    <>
      <div className="rounded-lg border border-border px-3 py-3 text-xs">
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Issuer</dt>
            <dd className="truncate text-foreground">{provider.issuer}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email domain</dt>
            <dd className="text-foreground">{provider.domain}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Discovery endpoint</dt>
            <dd className="truncate text-foreground">{provider.discoveryEndpoint ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Client ID</dt>
            <dd className="text-foreground">
              {provider.clientIdLastFour ? `...${provider.clientIdLastFour}` : "-"}
            </dd>
          </div>
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
          {provider.domainVerified ? (
            <>
              <CheckCircle2 className="size-3.5 shrink-0 text-severity-ok" />
              <span className="font-medium text-severity-ok">Domain verified</span>
              <span className="text-muted-foreground">
                Members of {provider.domain} can sign in through this provider.
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="size-3.5 shrink-0 text-severity-critical" />
              <span className="font-medium text-severity-critical">Domain not verified</span>
              <span className="text-muted-foreground">
                Sign-in through this provider is disabled until it is.
              </span>
            </>
          )}
        </div>
      </div>

      {!provider.domainVerified && canConfigure && (
        <div className="rounded-lg border border-border px-3 py-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Publish a DNS TXT record proving ownership of {provider.domain}, then verify it. DNS propagation
            can take up to an hour.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRequestRecord}
              disabled={action !== null}
            >
              {action === "record" && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Get DNS record
            </Button>
            <Button type="button" size="sm" onClick={onVerify} disabled={action !== null}>
              {action === "verify" && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Verify domain
            </Button>
          </div>
          {record && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-foreground">DNS TXT record</p>
              <code className="block overflow-x-auto rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">
                TXT {record.name} {record.value}
              </code>
            </div>
          )}
        </div>
      )}

      {!provider.domainVerified && !canConfigure && (
        <p className="text-xs text-muted-foreground">
          Ask an administrator with SSO configuration access to publish the DNS record and verify the domain.
        </p>
      )}
    </>
  )
}
