"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ONBOARDING_KEY = "retirement_onboarding_seen";

export default function OnboardingOverlay() {
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage blocked (private mode, etc.) — skip onboarding
    }
  }, []);

  function handleGetStarted() {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
    router.push("/config");
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative w-full max-w-lg border border-border bg-background shadow-2xl overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400" />

        <div className="px-8 py-8">
          {/* Brand name */}
          <div className="mb-6">
            <span className="text-3xl font-black text-foreground">
              Retirement.sg
            </span>
          </div>

          {/* Description */}
          <p className="text-sm font-semibold text-foreground/75 mb-6 leading-relaxed">
            Welcome to Singapore&rsquo;s{" "}
            <span className="text-emerald-600 dark:text-emerald-400">#1</span>{" "}
            financial projection &amp; retirement planning tool.
          </p>
          <p className="text-sm font-semibold text-foreground/75 mb-6 leading-relaxed">
          Retirement.sg was designed for young
            working adults at the start of their careers, ready to take retirement
            planning seriously, and too shy or too scared to engage your financial advisor friends. 
          </p>
          <p className="text-sm font-semibold text-foreground/75 mb-6 leading-relaxed">
          Built for Singaporeans, in Singapore, and 100% free, forever.
          </p>

          {/* Divider */}
          <div className="border-t border-border mb-6" />

          {/* Configuration guidance */}
          <div className="flex gap-3 mb-8">
            <div className="mt-0.5 flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="2"
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground/90 mb-1">
                Take your time with the configurations
              </p>
              <p className="text-sm font-semibold text-foreground/65 dark:text-foreground/55 leading-relaxed">
                Envision yourself going through each life milestone at those ages. Think carefully about your
                expected salary, expenses, and retirement timeline. Don&rsquo;t rush, the more realistic your inputs are, the more
                accurate your projections will be.
              </p>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleGetStarted}
            className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold py-3 px-6 transition-colors duration-150 text-sm"
          >
            Get started →
          </button>
        </div>
      </div>
    </div>
  );
}
