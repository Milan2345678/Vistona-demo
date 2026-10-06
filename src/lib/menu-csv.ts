export type MenuImportDish = {
  name: string;
  description: string;
  category: string;
  price: number;
  vegetarian: boolean;
  available: boolean;
  imageUrl: string | null;
};

export const MAX_MENU_IMPORT_ITEMS = 100;

const allowedColumns = new Set([
  "name",
  "description",
  "category",
  "price",
  "vegetarian",
  "available",
  "imageurl",
]);

function readCsvRows(input: string) {
  const source = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (afterQuote && character !== "," && character !== "\r" && character !== "\n") {
      if (!/\s/.test(character)) throw new Error("The CSV contains invalid quotes.");
      continue;
    }

    if (character === '"') {
      if (field.trim()) throw new Error("The CSV contains invalid quotes.");
      field = "";
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
      afterQuote = false;
    } else if (character === "\r" || character === "\n") {
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
      afterQuote = false;
      if (character === "\r" && source[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseBoolean(value: string, fallback: boolean, rowNumber: number, column: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  throw new Error(`CSV row ${rowNumber}: ${column} must be true/false, yes/no, or 1/0.`);
}

export function parseMenuCsv(input: string): MenuImportDish[] {
  const rows = readCsvRows(input);
  if (rows.length < 2) {
    throw new Error("The CSV must include a header row and at least one dish.");
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  for (const required of ["name", "category", "price"]) {
    if (!headers.includes(required)) {
      throw new Error(`The CSV is missing the required "${required}" column.`);
    }
  }
  if (headers.some((header) => !header || !allowedColumns.has(header))) {
    throw new Error(
      "Use only these CSV columns: name, description, category, price, vegetarian, available, imageUrl.",
    );
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error("The CSV cannot contain duplicate column names.");
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_MENU_IMPORT_ITEMS) {
    throw new Error(`Import up to ${MAX_MENU_IMPORT_ITEMS} dishes at a time.`);
  }

  return dataRows.map((cells, index) => {
    const rowNumber = index + 2;
    if (cells.length !== headers.length) {
      throw new Error(`CSV row ${rowNumber}: the number of values does not match the headers.`);
    }
    const values = Object.fromEntries(headers.map((header, i) => [header, cells[i].trim()]));
    const price = Number(values.price);
    if (!Number.isFinite(price) || price <= 0 || price > 100000) {
      throw new Error(`CSV row ${rowNumber}: price must be greater than 0 and at most 100000.`);
    }

    return {
      name: values.name,
      description: values.description ?? "",
      category: values.category,
      price,
      vegetarian: parseBoolean(values.vegetarian ?? "", false, rowNumber, "vegetarian"),
      available: parseBoolean(values.available ?? "", true, rowNumber, "available"),
      imageUrl: values.imageurl || null,
    };
  });
}
