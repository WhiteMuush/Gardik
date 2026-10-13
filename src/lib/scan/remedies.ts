import { providerMeta } from "@/lib/credentials/providers"
import type { ApiProvider } from "@prisma/client"

export type RemedyStep = { text: string; href?: string; linkLabel?: string }
export type Remedy = { title: string; explanation: string; steps: RemedyStep[] }

const RETRY: RemedyStep = { text: "Click Scan unchecked to check only the employees that were missed." }

// "elsewhere": read from a page that links to Data API (the scan banner).
// "source": read inside the source's own panel, where the settings sit below.
export type RemedyPlace = "elsewhere" | "source"

// Matches the reasons written by failureReason() in ./errors.
export function remedyFor(
  provider: ApiProvider,
  reason: string | null,
  place: RemedyPlace = "elsewhere"
): Remedy {
  const settings = (elsewhere: string, here: string): RemedyStep =>
    place === "source" ? { text: here } : { text: elsewhere, href: "/data-api", linkLabel: "Open Data API" }
  const meta = providerMeta(provider)
  const name = meta?.label ?? provider
  const account = { href: meta?.docsUrl, linkLabel: `Open ${name}` }

  if (reason === null) {
    return {
      title: `${name} has not checked these employees yet`,
      explanation: "They were added, or the key was saved, after the last scan. Nothing went wrong.",
      steps: [RETRY],
    }
  }
  if (reason === "API key rejected") {
    return {
      title: `${name} rejected the API key`,
      explanation: `${name} answered that the key is invalid, revoked, or not allowed to use this feed. Gardik stopped calling it for the rest of the scan.`,
      steps: [
        {
          text: `Check on your ${name} account that the subscription is active and includes this feed.`,
          ...account,
        },
        {
          text: "Copy the key again in full: a missing character or a trailing space is enough to break it.",
        },
        settings(
          "Paste it on the Data API page and click Replace.",
          "Paste it in Configuration below and click Replace."
        ),
        RETRY,
      ],
    }
  }
  if (reason === "Rate limited by the source") {
    return {
      title: `${name} refused calls over your plan's limit`,
      explanation: `Gardik sent more requests than your ${name} plan allows, or the plan's daily quota is used up. Gardik retried, then stopped calling it for the rest of the scan.`,
      steps: [
        { text: `Check the request limit of your plan on your ${name} account.`, ...account },
        settings(
          "On the Data API page, set the rate to that limit, never above it.",
          "In Configuration below, set the rate to that limit, never above it."
        ),
        { text: "If the daily quota is spent, wait until it resets." },
        RETRY,
      ],
    }
  }
  if (reason.startsWith("Source unavailable")) {
    return {
      title: `${name} is unavailable`,
      explanation: `${name} answered with a server error (${reason.replace("Source unavailable ", "")}). The problem is on their side.`,
      steps: [{ text: "Wait a few minutes." }, RETRY],
    }
  }
  if (reason === "Network error") {
    return {
      title: `Gardik could not reach ${name}`,
      explanation: "The request never got an answer: the server running Gardik has no route to the provider.",
      steps: [
        { text: "Check that the server running Gardik can reach the internet." },
        { text: `Check that no firewall or proxy blocks ${name}.` },
        RETRY,
      ],
    }
  }
  if (reason === "Search did not finish in time") {
    return {
      title: `${name} did not finish the search in time`,
      explanation: `${name} runs searches in the background and did not complete them while Gardik was waiting. It is often busy.`,
      steps: [{ text: "Wait a few minutes." }, RETRY],
    }
  }
  return {
    title: `${name} returned an unexpected answer`,
    explanation: `Gardik did not recognize the answer (${reason}).`,
    steps: [
      RETRY,
      {
        text: "If it fails again, check the Gardik server logs and report the error with the message above.",
      },
    ],
  }
}
