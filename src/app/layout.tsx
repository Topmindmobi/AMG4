import type { Metadata, Viewport } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart";
import { PwaManager } from "@/components/pwa/PwaManager";
import { SiteFooter } from "@/components/shop/SiteFooter";
import { SiteHeader } from "@/components/shop/SiteHeader";
import "./globals.css";

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700", "900"],
});

export const metadata: Metadata = {
  title: "AMG Stores — Kenya's Nationwide Marketplace",
  description:
    "Shop electronics, appliances, farm produce, hardware and more. Nationwide delivery across Nairobi, Mombasa, Kisumu, Homa Bay and beyond.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AMG Stores",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FF7417",
};

/** Inline so native controls stay light before CSS bundles parse (OS dark mode FOUC). */
const CRITICAL_FORM_CSS = `
html{color-scheme:light}
select,select option,.amg-select,.amg-select option{
  background-color:#fff!important;
  color:#101a3d!important;
  color-scheme:light;
}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${workSans.variable} ${fraunces.variable} h-full`}
      style={{ colorScheme: "light" }}
    >
      <head>
        <meta name="color-scheme" content="light" />
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_FORM_CSS }} />
      </head>
      <body className="flex min-h-full flex-col antialiased">
        <AuthProvider>
          <CartProvider>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <PwaManager />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
