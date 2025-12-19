import type { Metadata } from "next";
import "@fontsource/space-grotesk/index.css";
import "@fontsource/jetbrains-mono/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Field Service AI",
  description: "AI-backed field service management MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="app-body">
        {children}
      </body>
    </html>
  );
}
