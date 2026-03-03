import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/providers/Providers";
import { AppShell } from "@/components/layout/AppShell";
import { GoogleAnalytics } from "@next/third-parties/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AFCrashpad CRM",
  description: "Custom GoHighLevel-style CRM for Air Force Crashpad",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} h-screen bg-background antialiased overflow-hidden flex`}>
        <Providers>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <AppShell>{children}</AppShell>
          </ThemeProvider>
        </Providers>
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
      </body>
    </html>
  );
}
