import { Users, ShieldAlert, Database, Activity } from "lucide-react"
import { StatCard } from "@/components/dashboard/StatCard"
import { getRiskLevel } from "@/lib/risk"
import { ReportSection } from "./ReportSection"
import type { ExposureSummary } from "@/lib/reports/types"

export function ExposureSection({ data }: { data: ExposureSummary }) {
  const riskVariant = getRiskLevel(data.riskScore).variant

  return (
    <ReportSection
      title="Company exposure"
      description="Overall breach exposure across the workforce"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Employees" value={data.totalEmployees} icon={Users} />
        <StatCard
          label="Exposed"
          value={data.exposedEmployees}
          description={`${data.exposureRate}% of workforce`}
          icon={ShieldAlert}
          variant="high"
        />
        <StatCard label="Breaches" value={data.totalBreaches} icon={Database} />
        <StatCard
          label="Risk score"
          value={data.riskScore}
          description={data.riskLabel}
          icon={Activity}
          variant={riskVariant}
        />
      </div>

      {data.topBreaches.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Most impactful breaches
          </h4>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Breach</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 text-right font-medium">Affected</th>
                </tr>
              </thead>
              <tbody>
                {data.topBreaches.map((b) => (
                  <tr key={b.name} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">{b.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{b.source}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {b.affectedEmployees}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ReportSection>
  )
}
