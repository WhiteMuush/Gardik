import type { Metadata } from "next";
import "./globals.css";

// Statically prerendered pages cannot carry the per-request CSP nonce, so
// their script tags get blocked under strict-dynamic. Force dynamic rendering
// globally; only /login was static anyway.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DataShield",
  description: "Self-hosted employee data breach monitoring",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="font-sans">
      <body>{children}</body>
    </html>
  );
}
