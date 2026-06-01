export const PRESET_DATA_TYPES = [
  { key: "credit_card",    label: "Credit Card" },
  { key: "bank_account",   label: "Bank Account" },
  { key: "ssn",            label: "SSN" },
  { key: "national_id",    label: "National ID" },
  { key: "passport",       label: "Passport" },
  { key: "tax_id",         label: "Tax ID" },
  { key: "health_records", label: "Health Records" },
  { key: "salary",         label: "Salary" },
  { key: "contracts",      label: "Contracts" },
  { key: "ip_address",     label: "IP Address" },
  { key: "date_of_birth",  label: "Date of Birth" },
  { key: "biometric_data", label: "Biometric Data" },
  { key: "geolocation",    label: "Geolocation" },
  { key: "email",          label: "Email" },
  { key: "password",       label: "Password" },
  { key: "phone",          label: "Phone" },
  { key: "username",       label: "Username" },
  { key: "address",        label: "Address" },
] as const

export type PresetDataType = typeof PRESET_DATA_TYPES[number]["key"]
