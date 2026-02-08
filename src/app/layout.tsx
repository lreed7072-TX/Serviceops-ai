import type { Metadata, Viewport } from "next";
import "@fontsource/space-grotesk/index.css";
import "@fontsource/jetbrains-mono/index.css";
import "./globals.css";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "ServiceOpsIQ",
  description: "AI-powered field service management platform",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ServiceOpsIQ",
  },
  formatDetection: {
    telephone: false,
  },
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
