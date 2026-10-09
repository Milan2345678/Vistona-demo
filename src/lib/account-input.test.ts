import test from "node:test";
import assert from "node:assert/strict";
import {
  emailSchema,
  nameSchema,
  PASSWORD_RULES,
  passwordSchema,
} from "./account-input";

test("normalizes valid account emails", () => {
  assert.equal(emailSchema.parse("  Rahul@example.com "), "rahul@example.com");
});

test("validates account names and password strength", () => {
  assert.equal(nameSchema.parse(" Rahul "), "Rahul");
  assert.equal(passwordSchema.safeParse("SecurePassword123!").success, true);
  assert.equal(passwordSchema.safeParse("short").success, false);
  assert.equal(passwordSchema.safeParse("NoDigitsHere!!").success, false);
});

test("password validation messages describe the shared password rules", () => {
  assert.deepEqual(PASSWORD_RULES, [
    "At least 12 characters",
    "At most 72 UTF-8 bytes",
    "One lowercase letter",
    "One uppercase letter",
    "One number",
    "One symbol",
  ]);
  assert.equal(
    passwordSchema.safeParse("short").error?.issues[0]?.message,
    "Password must be at least 12 characters",
  );
  assert.equal(
    passwordSchema.safeParse("NoDigitsHere!!").error?.issues[0]?.message,
    "Password must include a number",
  );
  assert.equal(
    passwordSchema.safeParse("SecurePassword123").error?.issues[0]?.message,
    "Password must include a symbol",
  );
});
