function pdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapBillLines(lines: string[]) {
  return lines.flatMap((line) => {
    if (line.length <= 76) return [line];
    const wrapped: string[] = [];
    let remaining = line;
    while (remaining.length > 76) {
      const breakAt = remaining.lastIndexOf(" ", 76);
      const splitAt = breakAt > 0 ? breakAt : 76;
      wrapped.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }
    if (remaining) wrapped.push(remaining);
    return wrapped;
  });
}

export function createBillPdf(lines: string[]) {
  const wrappedLines = wrapBillLines(lines);
  const pageLines = Array.from(
    { length: Math.max(1, Math.ceil(wrappedLines.length / 34)) },
    (_, index) => wrappedLines.slice(index * 34, (index + 1) * 34),
  );
  const objects = new Map<number, string>();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageReferences: string[] = [];

  for (const [pageIndex, entries] of pageLines.entries()) {
    const pageObjectId = 4 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    pageReferences.push(`${pageObjectId} 0 R`);
    const commands = ["BT"];
    let y = 790;
    for (const [lineIndex, line] of entries.entries()) {
      const isTitle = pageIndex === 0 && lineIndex === 0;
      const size = isTitle ? 18 : 11;
      commands.push(
        `/F1 ${size} Tf 1 0 0 1 48 ${y} Tm (${pdfText(line)}) Tj`,
      );
      y -= isTitle ? 34 : 21;
    }
    commands.push("ET");
    const stream = commands.join("\n");
    objects.set(
      pageObjectId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.set(
      contentObjectId,
      `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
    );
  }

  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageReferences.join(" ")}] /Count ${pageLines.length} >>`,
  );
  let document = "%PDF-1.4\n";
  const maxObjectId = Math.max(...objects.keys());
  const offsets = Array<number>(maxObjectId + 1).fill(0);
  for (let id = 1; id <= maxObjectId; id += 1) {
    const object = objects.get(id);
    if (!object) continue;
    offsets[id] = Buffer.byteLength(document, "ascii");
    document += `${id} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document, "ascii");
  document += `xref\n0 ${maxObjectId + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    document += offset
      ? `${String(offset).padStart(10, "0")} 00000 n \n`
      : "0000000000 00000 f \n";
  }
  document += `trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document, "ascii");
}
