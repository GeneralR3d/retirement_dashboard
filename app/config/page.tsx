import { redirect } from "next/navigation";

// The old Calculator page is folded into the planner shell — its inputs now
// live in the persistent left pane. Keep the route for old bookmarks.
export default function ConfigRedirect() {
  redirect("/main");
}
