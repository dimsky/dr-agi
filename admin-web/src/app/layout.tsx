import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { AdminNavigation } from "@/components/layout/admin-navigation";
import { AdminFooter } from "@/components/layout/admin-footer";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "AI 医疗服务平台 - 管理端",
  description: "DR.Agent AI 医学服务平台管理系统，为医生提供营养方案制定、健康管理、临床研究等七大核心服务",
  keywords: ["微信", "医疗平台", "管理系统", "AI医疗", "健康管理"],
  authors: [{ name: "DR.Agent团队" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <QueryProvider>
          <AuthProvider>
            <AdminNavigation />
            <main className="flex-1">
              {children}
            </main>
            <AdminFooter />
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
