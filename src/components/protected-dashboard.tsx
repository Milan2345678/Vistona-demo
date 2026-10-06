import { redirect } from "next/navigation";
import Home from "@/app/page";
import { resolveSession } from "@/lib/tenant";
import type { AppRole } from "@/lib/auth";
import { dashboardPath } from "@/lib/user-roles";

export default async function ProtectedDashboard({ role }: { role: AppRole }) {
  const result = await resolveSession();
  if (result.status === "unavailable") {
    return (
      <main className="session-loading">
        Service temporarily unavailable, please refresh.
      </main>
    );
  }
  if (result.status === "invalid") redirect("/login");
  const session = result.session;
  if (session.role !== role) redirect(dashboardPath(session.role));
  return <Home />;
}
