"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";

const WEB3FORMS_ACCESS_KEY = "16ccbad0-7534-41df-a67e-51903548c411";

type Status = "idle" | "sending" | "success" | "error";

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [botcheck, setBotcheck] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  function resetAndClose() {
    setOpen(false);
    setTimeout(() => {
      setStatus("idle");
      setEmail("");
      setMessage("");
      setBotcheck("");
    }, 300);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (botcheck) {
      // Honeypot triggered — silently pretend success without hitting the API.
      setStatus("success");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          subject: "New feedback — Retirement.SG",
          email,
          message,
          botcheck,
        }),
      });
      const data = await res.json();
      setStatus(data.success ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-emerald-600/30 transition-all hover:bg-emerald-500 hover:shadow-emerald-600/40 ${
          open ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100"
        }`}
        aria-label="Share feedback"
      >
        <MessageCircle size={16} />
        Feedback
      </button>

      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <div
        ref={panelRef}
        className={`glass-popover fixed bottom-6 right-6 z-50 w-[calc(100vw-3rem)] max-w-sm p-6 transition-all duration-200 ease-out ${
          open ? "translate-y-0 opacity-100 scale-100" : "translate-y-3 opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-foreground">Share feedback</h2>
          <button
            onClick={resetAndClose}
            className="text-foreground/40 hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {status === "success" ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-emerald-600 dark:text-emerald-400 font-semibold">Thanks for your feedback!</p>
            <p className="text-sm text-foreground/85 dark:text-foreground/60">We read every message.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-sm text-foreground/85 dark:text-foreground/60 mb-3">
              Found a bug, have an idea, or want something different?
            </p>

            {/* Honeypot: hidden from sighted users, real bots that fill every field trip it */}
            <input
              type="text"
              name="botcheck"
              value={botcheck}
              onChange={(e) => setBotcheck(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              className="absolute -left-[9999px] w-px h-px opacity-0"
              aria-hidden="true"
            />

            <label className="block">
              <span className="block text-xs text-foreground/85 dark:text-foreground/60 mb-1">Email</span>
              <div className="glass-field">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent px-3 py-2 outline-none text-sm"
                />
              </div>
            </label>

            <label className="block">
              <span className="block text-xs text-foreground/85 dark:text-foreground/60 mb-1">
                What could we do better?
              </span>
              <div className="glass-field">
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Missing features, confusing sections, bugs, ideas..."
                  className="w-full resize-none bg-transparent px-3 py-2 outline-none text-sm"
                />
              </div>
            </label>

            {status === "error" && (
              <p className="text-xs text-red-500">Something went wrong — please try again.</p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/25 transition-colors hover:bg-emerald-500 disabled:opacity-60"
            >
              {status === "sending" ? "Sending..." : "Send feedback"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
