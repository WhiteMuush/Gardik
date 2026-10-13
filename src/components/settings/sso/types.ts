export type SsoProvider = {
  providerId: string
  issuer: string
  domain: string
  domainVerified: boolean
  discoveryEndpoint: string | null
  clientIdLastFour: string | null
}

export type DnsRecord = { name: string; value: string }

export type StatusMessage = { kind: "error" | "success"; text: string } | null

export type FormState = {
  issuer: string
  domain: string
  clientId: string
  clientSecret: string
  discoveryEndpoint: string
}

export const EMPTY_FORM: FormState = {
  issuer: "",
  domain: "",
  clientId: "",
  clientSecret: "",
  discoveryEndpoint: "",
}

export type Action = "save" | "record" | "verify" | "remove" | null
