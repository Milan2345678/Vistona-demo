import assert from "node:assert/strict";
import test from "node:test";
import { calculateTax } from "./tax";

test("calculates tax-exclusive GST in paise", () => {
  assert.deepEqual(calculateTax(10_000, 5, false), {
    subtotalCents: 10_000,
    taxCents: 500,
    totalCents: 10_500,
  });
});

test("extracts GST from a tax-inclusive price", () => {
  assert.deepEqual(calculateTax(10_500, 5, true), {
    subtotalCents: 10_000,
    taxCents: 500,
    totalCents: 10_500,
  });
});

test("rejects invalid amounts and rates", () => {
  assert.throws(() => calculateTax(-1, 5, false), RangeError);
  assert.throws(() => calculateTax(100, 29, false), RangeError);
});
