// Mobile-only route: on small screens the planner shell shows the inputs pane
// full-width for this path. On desktop the inputs pane is always visible on
// the left, so this page just points there.
export default function InputsPage() {
  return (
    <main className="px-4 sm:px-8 py-16 max-w-2xl mx-auto w-full text-center">
      <h1 className="text-xl font-semibold tracking-tight">Inputs</h1>
      <p className="text-sm text-foreground/85 dark:text-foreground/60 mt-2">
        Your inputs live in the panel on the left. This page is used on smaller
        screens, where the panel becomes its own tab.
      </p>
    </main>
  );
}
