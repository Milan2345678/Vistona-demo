import { redirect } from "next/navigation";
import AccountSettings from "@/components/account-settings";
import { getSession } from "@/lib/tenant";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <AccountSettings />;
}
