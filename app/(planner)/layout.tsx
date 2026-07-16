import PlannerShell from "@/app/components/planner-shell";

// Planner shell: double-pane on desktop, single-pane with a bottom tab bar on
// mobile. All layout logic lives in the client PlannerShell component because
// pane visibility depends on the current route (/inputs on mobile).
export default function PlannerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <PlannerShell>{children}</PlannerShell>;
}
