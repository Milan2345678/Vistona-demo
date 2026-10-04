import { redirect } from "next/navigation";
import MenuManagement from "@/components/menu-management";
import { getSession } from "@/lib/tenant";
import { dashboardPath } from "@/lib/user-roles";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "manager") redirect(dashboardPath(session.role));
  return <MenuManagement />;
}
