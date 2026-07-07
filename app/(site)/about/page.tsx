import Link from "next/link";
import PayNowQr from "@/app/components/paynow-qr";

export const metadata = {
  title: "About — Retirement.SG",
};

// TODO: replace with your actual Buy Me a Coffee URL
const BMC_URL = "https://www.buymeacoffee.com/generalr3d";

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="space-y-10 text-foreground/85 dark:text-foreground/70">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-black text-foreground mb-3">About Retirement.SG</h1>
        </div>

        <hr className="border-foreground/10" />

        {/* What this is */}
        <section className="space-y-4">
          <p className="leading-relaxed">
            Retirement.SG is a free collection of projection and planning tools designed to help young working adults in Singapore think through their financial future. It covers CPF projections, BTO flat purchases, SRS contributions, income tax estimates, tax reliefs, retirement drawdown scenarios, and more — all in one place, with no sign-up required.
          </p>
        </section>

        {/* Who made it */}
        <section className="space-y-4">
          <p className="leading-relaxed">
            This site was built by an independent developer based in Singapore. Like many people navigating their careers and thinking ahead about housing, CPF, and retirement, I wanted to map out my own cashflows and understand exactly where I stood financially at each stage of life. No tool quite did what I needed, so I built one.
          </p>
          <p className="leading-relaxed">
            If you&rsquo;re curious about the person behind it, you can find out more at{" "}
            <a
              href="https://www.dingrentuan.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
            >
              dingrentuan.com
            </a>
            .
          </p>
        </section>

        <hr className="border-foreground/10" />

        {/* Free to use */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">Free for Everyone</h2>
          <p className="leading-relaxed">
            Retirement.SG is and will remain free to use. There are no paywalls, no premium tiers, and no account required. All data you enter stays in your own browser — it is never sent to any server.
          </p>
          <p className="leading-relaxed">
            The site may carry advertising or sponsored content in the future to help cover running costs, but any such content will always be clearly identified. See the{" "}
            <Link href="/terms" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
              Privacy Policy
            </Link>{" "}
            for full details.
          </p>
        </section>

        <hr className="border-foreground/10" />

        {/* Buy me a coffee */}
                <section id="support" className="space-y-4 scroll-mt-8">
          <h2 className="text-xl font-bold text-foreground">Buy Me a Kopi-O Kosong</h2>
          <p className="leading-relaxed">
            If you found Retirement.SG useful, buy me a kopi-o-kosong! It helps cover the server and domain costs of keeping this site running and free for everyone.
          </p>
          <div className="flex items-center gap-4">
            <PayNowQr />
            <span className="text-foreground/25 text-sm select-none">or</span>
            <a
              href={BMC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 rounded-lg bg-[#FFDD00] hover:bg-[#FFD000] text-[#000000] font-semibold text-sm px-5 py-2.5 transition-colors shadow-sm"
            >
              <span className="text-base">☕</span>
              Buy me a kopi-o kosong
            </a>
          </div>
          <p className="text-xs text-foreground/40">
            No obligation whatsoever, the tool will always be free.
          </p>
        </section>

        <hr className="border-foreground/10" />



        {/* Disclaimer */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">Important Disclaimer</h2>
            <p>
              <strong className="text-foreground">Retirement.SG is an independent project.</strong> It is not affiliated with, endorsed by, or connected to any Singapore government agency or statutory board, including:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-foreground/75 dark:text-foreground/60">
              <li>Central Provident Fund Board (CPF Board)</li>
              <li>Housing Development Board (HDB)</li>
              <li>Inland Revenue Authority of Singapore (IRAS)</li>
              <li>Monetary Authority of Singapore (MAS)</li>
            </ul>
            <p>
              All projections and calculations are illustrative estimates based on publicly available information and the assumptions you provide. They are <strong className="text-foreground">not</strong> financial, legal, or tax advice, and should not be treated as a substitute for official CPF statements, HDB eligibility checks, IRAS tax assessments, or advice from a qualified professional.
            </p>
            <p>
              Please read the full{" "}
              <Link href="/terms" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
                Terms of Use
              </Link>{" "}
              before relying on any output from this site.
            </p>
        </section>

      </div>
    </div>
  );
}
