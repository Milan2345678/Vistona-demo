import test from "node:test";
import assert from "node:assert/strict";

import { parseMenuCsv } from "./menu-csv";

test("parses dishes with quoted commas, quotes, and optional fields", () => {
  const dishes = parseMenuCsv(
    'name,description,category,price,vegetarian,available,imageUrl\r\n' +
      '"Paneer, tikka","Smoky ""special"" paneer",Starters,280,yes,1,\r\n' +
      "Chicken curry,,Mains,350,no,0,https://example.com/curry.jpg",
  );

  assert.deepEqual(dishes, [
    {
      name: "Paneer, tikka",
      description: 'Smoky "special" paneer',
      category: "Starters",
      price: 280,
      vegetarian: true,
      available: true,
      imageUrl: null,
    },
    {
      name: "Chicken curry",
      description: "",
      category: "Mains",
      price: 350,
      vegetarian: false,
      available: false,
      imageUrl: "https://example.com/curry.jpg",
    },
  ]);
});

test("applies defaults and accepts only the required columns", () => {
  const [dish] = parseMenuCsv("\uFEFFname,category,price\nSoup,Starters,120");

  assert.equal(dish.vegetarian, false);
  assert.equal(dish.available, true);
  assert.equal(dish.description, "");
});

test("accepts up to 100 dishes and rejects larger imports", () => {
  const dishes = Array.from({ length: 100 }, (_, index) => `Dish ${index + 1},Mains,100`);
  assert.equal(parseMenuCsv(`name,category,price\n${dishes.join("\n")}`).length, 100);
  assert.throws(
    () => parseMenuCsv(`name,category,price\n${[...dishes, "Dish 101,Mains,100"].join("\n")}`),
    /up to 100 dishes/,
  );
});

test("rejects missing headers, invalid rows, and malformed quotes", () => {
  assert.throws(() => parseMenuCsv("dish,category,price\nSoup,Starters,120"), /missing the required "name" column/);
  assert.throws(() => parseMenuCsv("name,category,price\nSoup,Starters,0"), /CSV row 2/);
  assert.throws(() => parseMenuCsv('name,category,price\n"Soup,Starters,120'), /unclosed quoted field/);
});
