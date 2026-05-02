import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ProfileProvider } from "@/lib/profile-context";
import Navbar from "./components/navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SG Retirement Dashboard",
  description: "The #1 retirement projection tool for young adults in Singapore",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-R2YV0686Q1"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-R2YV0686Q1');
        `}
      </Script>
      <body className="min-h-full flex flex-col">
        <ProfileProvider>
          <Navbar />
          <div className="flex-1">{children}</div>
        </ProfileProvider>
      </body>
    </html>
  );
}
