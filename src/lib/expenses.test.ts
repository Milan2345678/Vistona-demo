import assert from "node:assert/strict";
import test from "node:test";
import { isExpenseDate } from "./expenses";

test("accepts valid ISO expense dates", () => {
  assert.equal(isExpenseDate("2024-02-29"), true);
  assert.equal(isExpenseDate("2026-10-09"), true);
});

test("rejects invalid or non-ISO expense dates", () => {
  assert.equal(isExpenseDate("2026-02-29"), false);
  assert.equal(isExpenseDate("2026-13-01"), false);
  assert.equal(isExpenseDate("09-10-2026"), false);
});
