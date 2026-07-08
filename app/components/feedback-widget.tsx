"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 20, right: window.innerWidth - rect.right });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current && buttonRef.current.contains(target)) return;
      if (panelRef.current && !panelRef.current.contains(target)) {
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
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-normal transition-colors ${
          open
            ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25"
            : "text-foreground/70 hover:bg-white/50 dark:hover:bg-white/10 hover:text-foreground"
        }`}
        aria-label="Share feedback"
      >
        <MessageCircle size={14} />
        Feedback
      </button>

      {coords &&
        createPortal(
          <>
            <div
              className={`fixed inset-x-0 top-14 bottom-0 z-[9998] bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
                open ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              aria-hidden="true"
            />

            <div
              ref={panelRef}
              style={{ top: coords.top, right: coords.right }}
              className={`glass-nav fixed z-[9999] w-[calc(100vw-3rem)] max-w-sm p-6 transition-all duration-200 ease-out ${
                open ? "translate-y-0 opacity-100 scale-100" : "translate-y-1 opacity-0 scale-95 pointer-events-none"
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
          </>,
          document.body,
        )}
    </div>
  );
}
