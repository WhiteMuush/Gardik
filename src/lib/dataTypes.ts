export const DATA_TYPE_GROUPS = ["Identity", "Financial", "Contact and account", "Health and HR"] as const

export const PRESET_DATA_TYPES = [
  { key: "credit_card", label: "Credit Card", group: "Financial" },
  { key: "bank_account", label: "Bank Account", group: "Financial" },
  { key: "ssn", label: "SSN", group: "Identity" },
  { key: "national_id", label: "National ID", group: "Identity" },
  { key: "passport", label: "Passport", group: "Identity" },
  { key: "tax_id", label: "Tax ID", group: "Identity" },
  { key: "health_records", label: "Health Records", group: "Health and HR" },
  { key: "salary", label: "Salary", group: "Financial" },
  { key: "contracts", label: "Contracts", group: "Health and HR" },
  { key: "ip_address", label: "IP Address", group: "Contact and account" },
  { key: "date_of_birth", label: "Date of Birth", group: "Identity" },
  { key: "biometric_data", label: "Biometric Data", group: "Identity" },
  { key: "geolocation", label: "Geolocation", group: "Contact and account" },
  { key: "email", label: "Email", group: "Contact and account" },
  { key: "password", label: "Password", group: "Contact and account" },
  { key: "phone", label: "Phone", group: "Contact and account" },
  { key: "username", label: "Username", group: "Contact and account" },
  { key: "address", label: "Address", group: "Contact and account" },
] as const
