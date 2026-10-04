import { redirect } from "next/navigation";
import Home from "@/app/page";
import { getSession } from "@/lib/tenant";
import type { AppRole } from "@/lib/auth";
import { dashboardPath } from "@/lib/user-roles";

export default async function ProtectedDashboard({ role }: { role: AppRole }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== role) redirect(dashboardPath(session.role));
  return <Home />;
}
