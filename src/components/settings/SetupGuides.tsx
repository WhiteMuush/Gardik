"use client"

import { useState } from "react"
import { Building2, Globe, Network, Cloud, Shield, Link } from "lucide-react"
import { cn } from "@/lib/utils"
import { AzureGuide } from "./setup-guides/AzureGuide"
import { GoogleGuide } from "./setup-guides/GoogleGuide"
import { LdapGuide } from "./setup-guides/LdapGuide"
import { AWSGuide } from "./setup-guides/AWSGuide"
import { OktaGuide } from "./setup-guides/OktaGuide"
import { SCIMGuide } from "./setup-guides/SCIMGuide"

type Tab = "AZURE_AD" | "GOOGLE_WORKSPACE" | "LDAP" | "AWS_DIRECTORY" | "OKTA" | "SCIM"

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "AZURE_AD", label: "Azure AD / Entra ID", icon: <Building2 className="size-3.5" /> },
  { id: "GOOGLE_WORKSPACE", label: "Google Workspace", icon: <Globe className="size-3.5" /> },
  { id: "LDAP", label: "LDAP", icon: <Network className="size-3.5" /> },
  { id: "AWS_DIRECTORY", label: "AWS Identity Center", icon: <Cloud className="size-3.5" /> },
  { id: "OKTA", label: "Okta", icon: <Shield className="size-3.5" /> },
  { id: "SCIM", label: "SCIM 2.0", icon: <Link className="size-3.5" /> },
]

export function SetupGuides() {
  const [active, setActive] = useState<Tab>("AZURE_AD")

  return (
    <section>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Setup guides</h3>
        <p className="text-xs text-muted-foreground">
          Prerequisites to configure outside Gardik before a sync can succeed.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="flex border-b border-border bg-muted/40">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors",
                active === tab.id
                  ? "border-b-2 border-primary text-foreground bg-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {active === "AZURE_AD" && <AzureGuide />}
          {active === "GOOGLE_WORKSPACE" && <GoogleGuide />}
          {active === "LDAP" && <LdapGuide />}
          {active === "AWS_DIRECTORY" && <AWSGuide />}
          {active === "OKTA" && <OktaGuide />}
          {active === "SCIM" && <SCIMGuide />}
        </div>
      </div>
    </section>
  )
}
