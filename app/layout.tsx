import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TopNav } from "@/components/layout/TopNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nano Manana",
  description: "Colorize and translate manga pages with AI. Transform black and white manga into vibrant color, and translate text to any language.",
  keywords: ["manga", "colorization", "translation", "AI", "comic", "anime", "Gemini"],
  authors: [{ name: "Nano Manana Team" }],
  icons: {
    icon: "/nano_manana_logo.ico",
    shortcut: "/nano_manana_logo.ico",
    apple: "/nano_manana_logo.png",
  },
  openGraph: {
    title: "Nano Manana",
    description: "Colorize and translate manga pages with AI. Transform black and white manga into vibrant color.",
    url: "https://nano-manana.vercel.app",
    siteName: "Nano Manana",
    images: [
      {
        url: "/nano_manana_og_image.png",
        width: 1200,
        height: 630,
        alt: "Nano Manana - Colorize and translate manga with AI",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nano Manana",
    description: "Colorize and translate manga pages with AI.",
    images: ["/nano_manana_og_image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <div className="min-h-screen flex flex-col">
            <TopNav />
            <main className="flex-1">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
