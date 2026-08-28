"use client"

import { useWidgetTitle } from "@/hooks/useWidgetTitle"

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function ringPath(
  cx: number, cy: number,
  ro: number, ri: number,
  fromDeg: number, toDeg: number
): string {
  if (Math.abs(toDeg - fromDeg) < 0.01) return ""
  const clampedTo = Math.min(toDeg, fromDeg + 179.99)
  const large = toDeg - fromDeg >= 180 ? 1 : 0
  const os = polarToCartesian(cx, cy, ro, fromDeg)
  const oe = polarToCartesian(cx, cy, ro, clampedTo)
  const is_ = polarToCartesian(cx, cy, ri, fromDeg)
  const ie = polarToCartesian(cx, cy, ri, clampedTo)
  return `M${os.x} ${os.y} A${ro} ${ro} 0 ${large} 1 ${oe.x} ${oe.y} L${ie.x} ${ie.y} A${ri} ${ri} 0 ${large} 0 ${is_.x} ${is_.y}Z`
}

function scoreColor(score: number) {
  if (score >= 76) return "oklch(var(--severity-critical))"
  if (score >= 51) return "oklch(var(--severity-high))"
  if (score >= 26) return "oklch(var(--severity-medium))"
  return "oklch(var(--severity-low))"
}

function scoreLabel(score: number) {
  if (score >= 76) return "Critical Risk"
  if (score >= 51) return "High Risk"
  if (score >= 26) return "Medium Risk"
  return "Low Risk"
}

export function RiskGauge({ riskScore }: { riskScore: number }) {
  const { title } = useWidgetTitle("risk-gauge", "Risk Score")

  const cx = 100, cy = 100
  const ro = 78, ri = 56
  const scoreDeg = 180 + (Math.min(riskScore, 100) / 100) * 180
  const color = scoreColor(riskScore)
  const label = scoreLabel(riskScore)

  const bgPath = ringPath(cx, cy, ro, ri, 180, 360)
  const fgPath = riskScore > 0 ? ringPath(cx, cy, ro, ri, 180, scoreDeg) : ""

  // Tick marks at 0, 25, 50, 75, 100 -> angles 180, 225, 270, 315, 360
  const ticks = [180, 225, 270, 315, 360].map((deg) => {
    const outer = polarToCartesian(cx, cy, ro + 6, deg)
    const inner = polarToCartesian(cx, cy, ro + 2, deg)
    return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y }
  })

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-1 shrink-0">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
      </div>
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <svg viewBox="0 0 200 112" className="w-full max-w-[280px]">
          {/* Background ring */}
          <path d={bgPath} fill="oklch(var(--muted))" />
          {/* Foreground ring */}
          {fgPath && <path d={fgPath} fill={color} />}
          {/* Tick marks */}
          {ticks.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke="oklch(var(--border))" strokeWidth="1.5" strokeLinecap="round" />
          ))}
          {/* Score number */}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="30" fontWeight="700"
            fill="oklch(var(--foreground))" fontFamily="inherit">
            {riskScore}
          </text>
          {/* Label */}
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="11" fontWeight="600"
            fill={color} fontFamily="inherit">
            {label}
          </text>
          {/* Scale labels */}
          <text x="18" y="108" fontSize="9" fill="oklch(var(--muted-foreground))" fontFamily="inherit">0</text>
          <text x="178" y="108" fontSize="9" fill="oklch(var(--muted-foreground))" fontFamily="inherit" textAnchor="end">100</text>
        </svg>
      </div>
    </div>
  )
}
