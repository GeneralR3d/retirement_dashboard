"use client";

import { usePathname } from "next/navigation";
import InputsPanel from "./inputs-panel";
import PlannerTabs from "./planner-tabs";
import Footer from "./footer";

// Double-pane planner shell. Desktop (md+): persistent left 1/3 inputs pane +
// right 2/3 sub-pages with the top tab pill. Mobile (<md): single pane — the
// inputs pane becomes its own "page" at /inputs, and navigation moves to a
// thumb-reachable bottom tab bar. The InputsPanel is mounted exactly once and
// never unmounts (only CSS-hidden), so its local draft state survives every
// navigation on both breakpoints.
export default function PlannerShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const onInputs = pathname === "/inputs";

  return (
    <div className="h-full flex min-h-0">
      <aside
        className={`${
          onInputs ? "block w-full" : "hidden"
        } md:block md:w-1/3 md:min-w-[320px] h-full overflow-y-auto thin-scroll md:border-r border-white/25 dark:border-white/[0.06]`}
      >
        <div className="p-4 pb-28 md:pb-4">
          <InputsPanel />
        </div>
      </aside>

      <section
        className={`${
          onInputs ? "hidden md:flex" : "flex"
        } w-full md:w-2/3 flex-1 h-full min-w-0 flex-col`}
      >
        <div className="flex-1 min-h-0 overflow-y-auto thin-scroll flex flex-col pb-24 md:pb-0">
          <PlannerTabs variant="top" />
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
      </section>

      <PlannerTabs variant="bottom" />
    </div>
  );
}
