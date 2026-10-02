import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Smart Basket Planner",
  description: "Turn a shopping mission into an editable, availability-aware grocery basket. Independent prototype.",
  appleWebApp: { capable: true, title: "Basket Planner", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fc8019" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-app text-foreground">{children}</body>
    </html>
  );
}
