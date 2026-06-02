"use client";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ONBOARDING_KEY = "retirement_onboarding_seen";

const STEP_IMAGES = [
  "https://images.unsplash.com/photo-1565967511849-76a60a516170?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=800&auto=format&fit=crop&q=80",
];

const STEP_CONTENT = [
  {
    title: "Retirement.sg",
    description:
      "Welcome to Singapore’s #1 financial projection & retirement planning tool.",
  },
  {
    title: "Retirement.sg",
    description:
      "Retirement.sg was designed for young working adults at the start of their careers, ready to take retirement planning seriously, and too shy or too scared to engage your financial advisor friends. \n Built for Singaporeans, in Singapore, and 100% free, forever.",
  },
  {
    title: "Take your time with the configurations",
    description:
      "Envision yourself going through each life milestone at those ages. Think carefully about your expected salary, expenses, and retirement timeline. Don’t rush, the more realistic your inputs are, the more accurate your projections will be.",
  },
];

const TOTAL_STEPS = STEP_CONTENT.length;

export default function OnboardingOverlay() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const router = useRouter();

  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) {
        setOpen(true);
      }
    } catch {
      // localStorage blocked (private mode, etc.) — skip onboarding
    }
  }, []);

  function handleFinish() {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
    router.push("/config");
  }

  function handleContinue() {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="gap-0 p-0 [&>button:last-child]:hidden border-foreground/15 dark:border-foreground/20 rounded-none sm:rounded-none sm:max-w-[480px]"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="p-4">
          <img
            className="w-full object-cover"
            src={STEP_IMAGES[step - 1]}
            width={448}
            height={240}
            alt="onboarding illustration"
            style={{ height: 240 }}
          />
        </div>
        <div className="space-y-6 px-8 pb-8 pt-4">
          {/* Progress bar */}
          <div className="h-1 w-full rounded-full overflow-hidden bg-foreground/10">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>

          <DialogHeader>
            <DialogTitle className="text-foreground">{STEP_CONTENT[step - 1].title}</DialogTitle>
            <DialogDescription className="text-foreground/80">
              {STEP_CONTENT[step - 1].description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            {/* Step dots */}
            <div className="flex justify-center space-x-1.5 max-sm:order-1">
              {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-colors",
                    index + 1 === step ? "bg-emerald-500" : "bg-foreground/20",
                  )}
                />
              ))}
            </div>

            <DialogFooter>
              {step < TOTAL_STEPS ? (
                <button
                  type="button"
                  onClick={handleContinue}
                  className="group inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 active:bg-emerald-700 transition-colors"
                >
                  Next
                  <ArrowRight
                    className="opacity-70 transition-transform group-hover:translate-x-0.5"
                    size={15}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 active:bg-emerald-700 transition-colors"
                >
                  Get started
                </button>
              )}
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
