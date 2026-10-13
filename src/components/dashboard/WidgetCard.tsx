import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { WidgetDef } from "@/lib/widgetRegistry"

const PREVIEW_SCALE = 0.42
const PREVIEW_H = 200

function WidgetPreview({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-t-xl border-b border-border transition-all duration-300"
      style={{
        height: `${PREVIEW_H}px`,
        filter: enabled ? "none" : "grayscale(1) opacity(0.35)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${(1 / PREVIEW_SCALE) * 100}%`,
          height: `${(1 / PREVIEW_SCALE) * 100}%`,
          transform: `scale(${PREVIEW_SCALE})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        {children}
      </div>
    </div>
  )
}

type Props = {
  widget: WidgetDef
  enabled: boolean
  saving: boolean
  preview: ReactNode
  onToggle: () => void
}

export function WidgetCard({ widget, enabled, saving, preview, onToggle }: Props) {
  return (
    <div
      className={cn(
        "group overflow-hidden rounded-xl border transition-all duration-200",
        enabled
          ? "border-primary/40 shadow-sm hover:border-primary/60"
          : "border-border/60 hover:border-muted-foreground/40"
      )}
    >
      {/* Preview */}
      <WidgetPreview enabled={enabled}>{preview}</WidgetPreview>

      {/* Footer */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 p-3 transition-colors",
          enabled ? "bg-primary/5" : "bg-card"
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-xs font-semibold",
              enabled ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {widget.defaultTitle}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {widget.defaultSize.w}x{widget.defaultSize.h} cells
          </p>
        </div>

        {/* Toggle */}
        <button
          onClick={onToggle}
          disabled={saving}
          className={cn(
            "relative flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-200",
            enabled ? "border-primary bg-primary" : "border-border bg-muted"
          )}
          title={enabled ? "Remove from dashboard" : "Add to dashboard"}
        >
          <span
            className={cn(
              "absolute flex size-4 items-center justify-center rounded-full bg-white shadow transition-all duration-200",
              enabled ? "left-[18px]" : "left-[1px]"
            )}
          >
            {saving && (
              <span className="size-2.5 animate-spin rounded-full border border-primary border-t-transparent" />
            )}
          </span>
        </button>
      </div>
    </div>
  )
}
