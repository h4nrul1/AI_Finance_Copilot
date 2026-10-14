import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { FinanceProvider } from "@/components/providers/finance-provider";

export const metadata: Metadata = {
  title: "AI Financial Copilot",
  description: "Semester-first financial planning demo for college students"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <FinanceProvider>
          <AppShell>{children}</AppShell>
        </FinanceProvider>
      </body>
    </html>
  );
}
