import test from "node:test";
import assert from "node:assert/strict";
import { emailSchema, nameSchema, passwordSchema } from "./account-input";

test("normalizes valid account emails", () => {
  assert.equal(emailSchema.parse("  Rahul@example.com "), "rahul@example.com");
});

test("validates account names and password strength", () => {
  assert.equal(nameSchema.parse(" Rahul "), "Rahul");
  assert.equal(passwordSchema.safeParse("SecurePassword123!").success, true);
  assert.equal(passwordSchema.safeParse("short").success, false);
  assert.equal(passwordSchema.safeParse("NoDigitsHere!!").success, false);
});
