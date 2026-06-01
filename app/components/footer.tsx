import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-foreground/10 px-6 py-5 mt-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-foreground/40">
        <span>© 2026 Retirement.SG. All rights reserved.</span>
        <nav className="flex flex-wrap gap-5">
          <Link href="/terms" className="hover:text-foreground/70 transition-colors">
            Terms of Use
          </Link>
          <Link href="/privacy" className="hover:text-foreground/70 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/about" className="hover:text-foreground/70 transition-colors">
            About Us
          </Link>
        </nav>
      </div>
    </footer>
  );
}
