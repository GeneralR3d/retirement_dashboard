import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Footer from "./components/footer";

export default function Home() {
  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <div className="flex-1 flex items-start justify-center px-6 pt-24 pb-12">
        <div className="w-full max-w-4xl text-center space-y-5">
          <h1 className="text-5xl font-semibold tracking-tighter text-foreground sm:text-7xl">
            Retirement<span className="text-emerald-600">.sg</span>
          </h1>

          <p className="text-smnet text-foreground/80 dark:text-foreground/70">
            Singapore’s #1 financial projection &amp; retirement planning tool.

          </p>

          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-foreground/60 dark:text-foreground/50">
            Designed for young working adults at the start of their careers, ready
            to take retirement planning seriously, and too shy or too scared to
            engage your financial advisor friends (we've all been there).
          </p>

          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-foreground/60 dark:text-foreground/50">
          Built for Singaporeans, in Singapore, and 100% free.
          </p>

          <div className="pt-4">
            <Link
              href="/main"
              className="group inline-flex items-center gap-2 rounded-full bg-transparent px-8 py-3 text-sm font-normal text-foreground/80 transition-colors hover:bg-emerald-600 hover:text-white hover:shadow-sm hover:shadow-emerald-600/25"
            >
              Get started
              <ArrowRight
                className="opacity-80 transition-transform group-hover:translate-x-0.5"
                size={16}
                strokeWidth={2}
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
