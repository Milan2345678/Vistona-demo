import CustomerMenu from "@/components/customer-menu";

export default async function Page({
  params,
}: {
  params: Promise<{ restaurantSlug: string; tableToken: string }>;
}) {
  const { restaurantSlug, tableToken } = await params;
  return (
    <CustomerMenu restaurantSlug={restaurantSlug} tableToken={tableToken} />
  );
}
