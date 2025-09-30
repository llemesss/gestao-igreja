import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: "Sistema de Gestão - Igreja",
  description: "Sistema de gestão de membros e células da igreja",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className="antialiased"
      >
        {children}
        <ToastProvider />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
