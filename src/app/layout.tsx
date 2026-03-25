import type { Metadata, Viewport } from "next";
import "@fontsource/space-grotesk/index.css";
import "@fontsource/jetbrains-mono/index.css";
import "./globals.css";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth";
import { ServiceWorkerRegistration } from "@/components/common/ServiceWorkerRegistration";
import { InstallPrompt } from "@/components/common/InstallPrompt";
import { ToastProvider } from "@/components/ui/Toast";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1f2937",
};

export const metadata: Metadata = {
  title: "ServiceOpsIQ",
  description: "AI-powered field service management platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ServiceOpsIQ",
  },
  icons: {
    apple: "/apple-touch-icon.png",
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
        <ServiceWorkerRegistration />
        <InstallPrompt />
        {devBypassActive && (
          <div className="dev-auth-banner">DEV AUTH BYPASS ACTIVE</div>
        )}
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
