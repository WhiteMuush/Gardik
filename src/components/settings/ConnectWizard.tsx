"use client"

import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PROVIDERS, type DirectoryType } from "./connect-wizard/providers"
import { ChooseStep } from "./connect-wizard/ChooseStep"
import { FIELDS } from "./connect-wizard/fields"
import { ConfigureStep } from "./connect-wizard/ConfigureStep"
import { DoneStep, TestStep, type TestResult } from "./connect-wizard/ResultSteps"

type Props = {
  onClose: () => void
  onCreated: (conn: unknown) => void
}

export function ConnectWizard({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<"choose" | "configure" | "test" | "done">("choose")
  const [selectedType, setSelectedType] = useState<DirectoryType | null>(null)
  const [name, setName] = useState("")
  const [fields, setFields] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [scimToken, setScimToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set())

  function toggleReveal(key: string) {
    setRevealedFields((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const fieldDefs = selectedType ? FIELDS[selectedType] : []

  function handleFieldChange(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  function buildConfig() {
    const cfg: Record<string, unknown> = {}
    for (const def of fieldDefs) {
      if (def.type === "number") cfg[def.key] = parseInt(fields[def.key] ?? "0", 10)
      else if (def.key === "ssl") cfg[def.key] = fields[def.key] === "true"
      else cfg[def.key] = fields[def.key] ?? ""
    }
    return cfg
  }

  async function handleSave() {
    if (!selectedType || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedType, name: name.trim(), config: buildConfig() }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const conn = await res.json()
      setCreatedId(conn.id)
      if (selectedType === "SCIM") {
        setScimToken(conn.bearerToken ?? null)
        setStep("done")
      } else {
        setStep("test")
      }
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!createdId) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/directory/${createdId}/test`, { method: "POST" })
      const result = await res.json()
      setTestResult(result)
      if (result.ok) setStep("done")
    } finally {
      setTesting(false)
    }
  }

  function handleFinish() {
    onCreated({ id: createdId, type: selectedType, name, status: testResult?.ok ? "ACTIVE" : "PENDING" })
    onClose()
  }

  const provider = PROVIDERS.find((p) => p.type === selectedType)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-xl border border-border/60 bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            {step === "choose" && "Connect a directory"}
            {step === "configure" && `Configure ${provider?.label}`}
            {step === "test" && "Test connection"}
            {step === "done" && "Connection successful"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {step === "choose" && (
            <ChooseStep
              onChoose={(type) => {
                setSelectedType(type)
                setFields({})
                setName("")
                setStep("configure")
              }}
            />
          )}

          {step === "configure" && selectedType && (
            <ConfigureStep
              selectedType={selectedType}
              provider={provider}
              fieldDefs={fieldDefs}
              name={name}
              onNameChange={setName}
              fields={fields}
              onFieldChange={handleFieldChange}
              revealedFields={revealedFields}
              onToggleReveal={toggleReveal}
              error={error}
            />
          )}

          {step === "test" && <TestStep testResult={testResult} />}

          {step === "done" && (
            <DoneStep
              isScim={selectedType === "SCIM"}
              testResult={testResult}
              createdId={createdId}
              scimToken={scimToken}
            />
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={
              step === "choose" ? onClose : () => setStep(step === "configure" ? "choose" : "configure")
            }
            disabled={step === "done"}
          >
            {step === "choose" ? "Cancel" : "Back"}
          </Button>

          <div className="flex gap-2">
            {step === "configure" && (
              <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
                {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Save
              </Button>
            )}
            {step === "test" && !testResult?.ok && (
              <Button size="sm" onClick={handleTest} disabled={testing}>
                {testing && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Test connection
              </Button>
            )}
            {step === "test" && testResult && !testResult.ok && (
              <Button variant="outline" size="sm" onClick={handleFinish}>
                Skip and finish
              </Button>
            )}
            {step === "done" && (
              <Button size="sm" onClick={handleFinish}>
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
