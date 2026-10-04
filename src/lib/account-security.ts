import { createHash, randomBytes } from "node:crypto";

export function createScopedSlug(value: string) {
  const base =
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "restaurant";
  return `${base}-${randomBytes(4).toString("hex")}`;
}

export function createInviteCode() {
  return randomBytes(16).toString("hex").toUpperCase();
}

export function hashInviteCode(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
