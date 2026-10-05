import test from "node:test";
import assert from "node:assert/strict";

import { createBillPdf } from "./bill-pdf";

test("creates a valid single-page PDF bill with escaped text", () => {
  const pdf = createBillPdf(["Vistona Cafe", "Paneer (special)", "INR 250.00"]);
  const content = pdf.toString("ascii");
  const startXref = Number(content.match(/startxref\n(\d+)/)?.[1]);

  assert.equal(content.startsWith("%PDF-1.4"), true);
  assert.match(content, /\/Type \/Catalog/);
  assert.equal(content.includes("Paneer \\(special\\)"), true);
  assert.match(content, /1 0 0 1 48 790 Tm/);
  assert.equal(content.slice(startXref, startXref + 4), "xref");
  assert.match(content, /%%EOF$/);
});

test("paginates long bills without dropping line items", () => {
  const lines = Array.from({ length: 70 }, (_, index) => `Dish ${index + 1}`);
  const content = createBillPdf(lines).toString("ascii");

  assert.match(content, /\/Count 3/);
  assert.match(content, /Dish 1\)/);
  assert.match(content, /Dish 70\)/);
});
