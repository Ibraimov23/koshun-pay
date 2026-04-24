import "./globals.css";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

export const metadata = {
  title: "Koshun Pay",
  description: "Koshun Pay — токенизация туризма"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
