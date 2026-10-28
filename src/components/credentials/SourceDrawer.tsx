"use client"

import { ExternalLink, X } from "lucide-react"
import { ScanButton } from "@/components/employees/ScanButton"
import { priceLabel } from "@/lib/credentials/providers"
import { remedyFor } from "@/lib/scan/remedies"
import { RemedyPanel } from "@/components/employees/RemedyPanel"
import type { SourceView } from "./source-view"
import { HealthPill, LevelBadge, SourceAvatar } from "./SourceBadges"
import { Section } from "./DrawerSection"
import { CatalogDrawer } from "./CatalogDrawer"
import { SourceConfiguration } from "./SourceConfiguration"

const LEVEL_WHY = {
  Recommended: "Reliable data with few false positives. Start here.",
  Additional: "Wider coverage, with more noise. Useful next to a recommended source.",
  "Free or limited": "Free or limited access to start, with less precise results.",
} as const

type Props = {
  source: SourceView | null
  isAdmin: boolean
  canScan: boolean
  onClose: () => void
}

export function SourceDrawer({ source, isAdmin, canScan, onClose }: Props) {
  return (
    <CatalogDrawer
      open={source !== null}
      label={source ? `${source.meta.label} details` : undefined}
      onClose={onClose}
    >
      {source && (
        <SourceDetails
          key={source.meta.id}
          source={source}
          isAdmin={isAdmin}
          canScan={canScan}
          onClose={onClose}
        />
      )}
    </CatalogDrawer>
  )
}

// Keyed by source in the drawer, so drafts and errors never leak from one source to the next.
function SourceDetails({ source, isAdmin, canScan, onClose }: Props & { source: SourceView }) {
  const cred = source.credential
  const remedy =
    source.health.status === "NEEDS_ACTION"
      ? remedyFor(source.meta.id, source.coverage?.lastFailureReason ?? null, "source")
      : null

  return (
    <>
      <div className="flex items-start gap-3 border-b border-border p-5">
        <SourceAvatar initials={source.meta.initials} logo={source.meta.logo} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{source.meta.label}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <LevelBadge level={source.level} />
            <HealthPill health={source.health} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Section title="Overview">
          <p className="text-sm text-foreground">{source.meta.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">{LEVEL_WHY[source.level]}</p>
        </Section>

        {cred && (
          <Section title="Health">
            <p className="text-sm text-foreground">{source.health.label}</p>
            {source.health.detail && source.health.status !== "NEEDS_ACTION" && (
              <p className="mt-1 text-xs text-muted-foreground">{source.health.detail}</p>
            )}
            {source.coverage && (
              <p className="mt-2 text-xs text-muted-foreground">
                {source.coverage.checked} checked - {source.coverage.failed} failed -{" "}
                {source.coverage.neverChecked} never checked
              </p>
            )}
            {remedy && (
              <div className="mt-3">
                <RemedyPanel remedy={remedy} />
              </div>
            )}
            {canScan && source.health.status !== "CONNECTED" && (
              <div className="mt-3">
                <ScanButton onlyIncomplete label="Scan unchecked" />
              </div>
            )}
          </Section>
        )}

        <SourceConfiguration source={source} isAdmin={isAdmin} />

        <Section title="Pricing">
          <p className="text-sm text-foreground">{priceLabel(source.meta)}</p>
          {source.meta.pricing.freeTier && (
            <p className="mt-1 text-xs text-muted-foreground">Free tier: {source.meta.pricing.freeTier}</p>
          )}
          {source.meta.pricing.note && (
            <p className="mt-1 text-xs text-muted-foreground">{source.meta.pricing.note}</p>
          )}
          <a
            href={source.meta.pricing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            See pricing <ExternalLink className="size-3" />
          </a>
        </Section>
      </div>
    </>
  )
}
