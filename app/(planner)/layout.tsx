import InputsPanel from "@/app/components/inputs-panel";
import PlannerTabs from "@/app/components/planner-tabs";
import Footer from "@/app/components/footer";

// Double-pane planner shell: the left 1/3 inputs pane persists (and keeps its
// draft state) while the right 2/3 swaps between the projection sub-pages.
// Each pane scrolls independently.
export default function PlannerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-full flex min-h-0">
      <aside className="w-1/3 min-w-[320px] h-full overflow-y-auto thin-scroll border-r border-white/25 dark:border-white/[0.06]">
        <div className="p-4">
          <InputsPanel />
        </div>
      </aside>

      <section className="w-2/3 flex-1 h-full min-w-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto thin-scroll flex flex-col">
          <PlannerTabs />
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
      </section>
    </div>
  );
}
