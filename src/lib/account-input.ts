import { z } from "zod";

export const nameSchema = z.string().trim().min(2).max(80);
export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());

export const passwordSchema = z
  .string()
  .min(12)
  .max(72)
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol")
  .refine(
    (password) => new TextEncoder().encode(password).length <= 72,
    "Password must be at most 72 UTF-8 bytes",
  );
