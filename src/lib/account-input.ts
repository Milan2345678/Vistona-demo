import { z } from "zod";
import { PASSWORD_POLICY } from "./password-rules";

export { PASSWORD_RULES } from "./password-rules";

export const nameSchema = z.string().trim().min(2).max(80);
export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());

export const passwordSchema = z
  .string({ error: "Password is required" })
  .min(
    PASSWORD_POLICY.minLength,
    `Password must be at least ${PASSWORD_POLICY.minLength} characters`,
  )
  .max(
    PASSWORD_POLICY.maxCharacters,
    `Password must be at most ${PASSWORD_POLICY.maxCharacters} characters`,
  )
  .regex(
    PASSWORD_POLICY.checks[0].pattern,
    PASSWORD_POLICY.checks[0].message,
  )
  .regex(
    PASSWORD_POLICY.checks[1].pattern,
    PASSWORD_POLICY.checks[1].message,
  )
  .regex(
    PASSWORD_POLICY.checks[2].pattern,
    PASSWORD_POLICY.checks[2].message,
  )
  .regex(
    PASSWORD_POLICY.checks[3].pattern,
    PASSWORD_POLICY.checks[3].message,
  )
  .refine(
    (password) =>
      new TextEncoder().encode(password).length <= PASSWORD_POLICY.maxUtf8Bytes,
    `Password must be at most ${PASSWORD_POLICY.maxUtf8Bytes} UTF-8 bytes`,
  );
