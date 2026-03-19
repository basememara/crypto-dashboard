import type { Metadata } from "next";
import AppProviders from "@/contexts/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "BTC / XAU",
  description: "Bitcoin to Gold ratio dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
