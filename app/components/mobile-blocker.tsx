"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function MobileBlocker() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!isMobile) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-md bg-background/80">
      <div className="mx-6 max-w-sm border border-border bg-card p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center">
          <Image src="/icon.png" alt="SG Retirement Dashboard" width={64} height={64} />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          Desktop recommended
        </h2>
        <p className="text-sm leading-relaxed text-foreground/60">
          Retirement.sg is designed for larger screens. Open it on a desktop or laptop for the best experience!
        </p>
      </div>
    </div>
  );
}
