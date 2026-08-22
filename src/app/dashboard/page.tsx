import { redirect } from "next/navigation";

// Consolidated into home (/) — dashboard content now serves as landing.
export default function DashboardRedirect() {
  redirect("/");
}
