import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vistona Restaurant OS",
  description: "Restaurant operations, from floor to kitchen.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
