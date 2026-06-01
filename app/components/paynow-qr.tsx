"use client";

import { useState } from "react";
import Image from "next/image";

export default function PayNowQr() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col items-center gap-1.5 group"
        title="Click to enlarge PayNow QR"
      >
        <Image
          src="/paynow.png"
          alt="PayNow QR code"
          width={72}
          height={72}
          className="rounded-md border border-foreground/10 group-hover:border-foreground/30 transition-colors"
        />
        <span className="text-[10px] text-foreground/40 group-hover:text-foreground/60 transition-colors">
          PayNow
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-2xl max-w-sm w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-foreground">Scan to pay via PayNow</p>
            <Image
              src="/paynow.png"
              alt="PayNow QR code"
              width={280}
              height={280}
              className="rounded-lg"
            />
            <p className="text-xs text-foreground/40 text-center">
              Any amount appreciated — thank you!
            </p>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-foreground/50 hover:text-foreground/80 transition-colors mt-1"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
