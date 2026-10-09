import { redirect } from "next/navigation";
import RestaurantBranding from "@/components/restaurant-branding";
import { getSession } from "@/lib/tenant";
import { dashboardPath } from "@/lib/user-roles";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "manager") redirect(dashboardPath(session.role));
  return <RestaurantBranding />;
}
