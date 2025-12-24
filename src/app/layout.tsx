import type { Metadata } from "next";
import "@fontsource/space-grotesk/index.css";
import "@fontsource/jetbrains-mono/index.css";
import "./globals.css";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth";

export const metadata: Metadata = {
  title: "Field Service AI",
  description: "AI-backed field service management MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const devBypassActive = isDevAuthBypassEnabled();

  return (
    <html lang="en">
      <body className="app-body">
        {devBypassActive && (
          <div className="dev-auth-banner">DEV AUTH BYPASS ACTIVE</div>
        )}
        {children}
      </body>
    </html>
  );
}
