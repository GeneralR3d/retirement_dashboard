import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ProfileProvider } from "@/lib/profile-context";
import Navbar from "./components/navbar";
import Footer from "./components/footer";
import OnboardingOverlay from "./components/onboarding-overlay";
import MobileBlocker from "./components/mobile-blocker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "%s | Retirement.sg",
  description: "The #1 financial projection and retirement plannning tool for young adults in Singapore",
  openGraph: {
    title: "Retirement.sg",
    description: "The #1 financial projection and retirement planning tool for young adults in Singapore",
    url: "https://www.retirement.sg",
    type: "website",
    locale: "en_SG",
    siteName: "Retirement.sg",
    images: [
      {
        url: "/opengraph-image.png",
      },
    ],
  },
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
      <Script id="clarity" strategy="afterInteractive">
        {`
        (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "x09ww0itw3");
        `}
      </Script>
      <body className="min-h-full flex">
        <ProfileProvider>
          <MobileBlocker />
          <OnboardingOverlay />
          <Navbar />
          <div className="flex-1 min-w-0 flex flex-col">
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </ProfileProvider>
      </body>
    </html>
  );
}
