import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { FinanceProvider } from "@/components/providers/finance-provider";
import { THEME_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "AI Financial Copilot",
  description: "Semester-first financial planning demo for college students"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme (or the device's setting) before the first paint, so there's no flash of the wrong one. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        <FinanceProvider>
          <AppShell>{children}</AppShell>
        </FinanceProvider>
      </body>
    </html>
  );
}
