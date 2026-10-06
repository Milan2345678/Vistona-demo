"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  MAX_MENU_IMPORT_ITEMS,
  parseMenuCsv,
  type MenuImportDish,
} from "@/lib/menu-csv";

type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryId: string;
  price: number;
  vegetarian: boolean;
  available: boolean;
  active: boolean;
  imageUrl: string | null;
};

type MenuForm = {
  name: string;
  description: string;
  category: string;
  price: string;
  vegetarian: boolean;
  available: boolean;
  imageUrl: string;
};

const emptyForm: MenuForm = {
  name: "",
  description: "",
  category: "Starters",
  price: "",
  vegetarian: false,
  available: true,
  imageUrl: "",
};

export default function MenuManagement() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<MenuForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [bulkDialog, setBulkDialog] = useState(false);
  const [bulkItems, setBulkItems] = useState<MenuImportDish[]>([]);
  const [bulkFile, setBulkFile] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [importing, setImporting] = useState(false);

  async function loadMenu() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/restaurant/menu");
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Menu could not be loaded");
      setMenu(body.items);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Menu could not be loaded",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    fetch("/api/restaurant/menu")
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(body.error ?? "Menu could not be loaded");
        return body.items as MenuItem[];
      })
      .then((items) => {
        if (mounted) setMenu(items);
      })
      .catch((cause) => {
        if (mounted)
          setError(
            cause instanceof Error ? cause.message : "Menu could not be loaded",
          );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const categories = ["All", ...new Set(menu.map((item) => item.category))];
  const filtered = menu.filter(
    (item) =>
      item.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (categoryFilter === "All" || item.category === categoryFilter),
  );

  function startCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialog("create");
    setError("");
    setNotice("");
  }

  function startEdit(item: MenuItem) {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description,
      category: item.category,
      price: String(item.price),
      vegetarian: item.vegetarian,
      available: item.available,
      imageUrl: item.imageUrl ?? "",
    });
    setDialog("edit");
    setError("");
    setNotice("");
  }

  async function saveDish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const price = Number(form.price);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Price must be greater than zero.");
      return;
    }
    setSaving(true);
    try {
      const create = dialog === "create";
      const response = await fetch(
        create ? "/api/restaurant/menu" : `/api/restaurant/menu/${editing?.id}`,
        {
          method: create ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            category: form.category,
            price,
            vegetarian: form.vegetarian,
            available: form.available,
            imageUrl: form.imageUrl.trim() || null,
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Dish could not be saved");
      setDialog(null);
      setNotice(
        create
          ? `${body.item.name} added to the menu`
          : `${body.item.name} updated`,
      );
      await loadMenu();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Dish could not be saved",
      );
    } finally {
      setSaving(false);
    }
  }

  function startBulkImport() {
    setBulkItems([]);
    setBulkFile("");
    setBulkError("");
    setBulkDialog(true);
    setError("");
    setNotice("");
  }

  async function selectCsvFile(file: File | undefined) {
    setBulkItems([]);
    setBulkFile("");
    setBulkError("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setBulkError("Choose a .csv file.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setBulkError("CSV files must be smaller than 1 MB.");
      return;
    }

    try {
      const items = parseMenuCsv(await file.text());
      setBulkItems(items);
      setBulkFile(file.name);
    } catch (cause) {
      setBulkError(
        cause instanceof Error
          ? cause.message
          : "The CSV file could not be read.",
      );
    }
  }

  async function importDishes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBulkError("");
    if (!bulkItems.length) {
      setBulkError("Choose a valid CSV file before importing.");
      return;
    }
    setImporting(true);
    try {
      const response = await fetch("/api/restaurant/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: bulkItems }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Dishes could not be imported");
      setBulkDialog(false);
      setNotice(`${body.items.length} dishes imported to the menu`);
      await loadMenu();
    } catch (cause) {
      setBulkError(
        cause instanceof Error ? cause.message : "Dishes could not be imported",
      );
    } finally {
      setImporting(false);
    }
  }

  function downloadCsvTemplate() {
    const csv =
      "name,description,category,price,vegetarian,available,imageUrl\r\n";
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "vistona-menu-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function toggleAvailability(item: MenuItem) {
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/restaurant/menu/${item.id}/availability`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ available: !item.available }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Availability could not be changed");
      setMenu((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, available: body.item.available }
            : entry,
        ),
      );
      setNotice(
        `${item.name} marked ${body.item.available ? "IN STOCK" : "OUT OF STOCK"}`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Availability could not be changed",
      );
    }
  }

  async function removeDish(item: MenuItem) {
    if (!window.confirm("Are you sure you want to remove this dish?")) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/restaurant/menu/${item.id}`, {
        method: "DELETE",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Dish could not be removed");
      setMenu((current) => current.filter((entry) => entry.id !== item.id));
      setNotice(`${item.name} removed from the active menu`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Dish could not be removed",
      );
    }
  }

  return (
    <main className="page manager-menu-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">RESTAURANT MENU</span>
          <h1>Menu management</h1>
          <p>
            One menu powers waiter ordering, QR ordering, and kitchen tickets.
          </p>
        </div>
        <div className="manager-menu-heading-actions">
          <button className="secondary-button" onClick={startBulkImport}>
            Import CSV
          </button>
          <button className="primary-button" onClick={startCreate}>
            <Plus size={16} /> Add New Dish
          </button>
        </div>
      </div>
      {notice && (
        <p className="menu-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="table-error" role="alert">
          <strong>Menu request failed.</strong>
          <span>{error}</span>
        </div>
      )}
      <div className="menu-toolbar manager-menu-toolbar">
        <input
          className="manager-menu-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search dishes"
          aria-label="Search menu"
        />
        <div className="filter-bar">
          {categories.map((item) => (
            <button
              className={categoryFilter === item ? "selected" : ""}
              key={item}
              onClick={() => setCategoryFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="manager-menu-table">
        <div className="manager-menu-header">
          <span>Dish</span>
          <span>Category</span>
          <span>Price</span>
          <span>Availability</span>
          <span>Actions</span>
        </div>
        {loading ? (
          <div className="table-empty-state">Loading restaurant menu...</div>
        ) : !filtered.length ? (
          <div className="table-empty-state">
            <h2>{menu.length ? "No matching dishes" : "Menu is empty"}</h2>
            <p>
              {menu.length
                ? "Try another search or category."
                : "Add the first dish to make it available to your team and customers."}
            </p>
            {!menu.length && (
              <button className="primary-button" onClick={startCreate}>
                <Plus size={16} /> Add New Dish
              </button>
            )}
          </div>
        ) : (
          filtered.map((item) => (
            <article className="manager-menu-row" key={item.id}>
              <div className="manager-menu-dish">
                {item.imageUrl ? (
                  <div className="manager-menu-image">
                    <Image
                      src={item.imageUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="64px"
                    />
                  </div>
                ) : (
                  <div className="menu-thumb">
                    <ImagePlus size={17} />
                  </div>
                )}
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </div>
              </div>
              <span className="manager-menu-category">{item.category}</span>
              <strong>₹{item.price.toLocaleString("en-IN")}</strong>
              <button
                className={`stock-toggle ${item.available ? "in-stock" : "out-stock"}`}
                onClick={() => void toggleAvailability(item)}
              >
                {item.available ? "IN STOCK" : "OUT OF STOCK"}
              </button>
              <div className="manager-menu-actions">
                <button
                  className="icon-button"
                  aria-label={`Edit ${item.name}`}
                  title="Edit dish"
                  onClick={() => startEdit(item)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button menu-remove-button"
                  aria-label={`Remove ${item.name}`}
                  title="Remove dish"
                  onClick={() => void removeDish(item)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {dialog && (
        <div className="table-modal-backdrop" onClick={() => setDialog(null)}>
          <section
            className="table-modal menu-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="table-modal-head">
              <div>
                <span className="eyebrow">MENU MANAGEMENT</span>
                <h2 id="menu-modal-title">
                  {dialog === "create"
                    ? "Add New Dish"
                    : `Edit ${editing?.name}`}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close"
                onClick={() => setDialog(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form
              className="table-form"
              onSubmit={(event) => void saveDish(event)}
            >
              <label>
                Dish name
                <input
                  autoFocus
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Description
                <textarea
                  maxLength={1000}
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Category
                <input
                  list="restaurant-menu-categories"
                  required
                  maxLength={80}
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                />
                <datalist id="restaurant-menu-categories">
                  {categories
                    .filter((item) => item !== "All")
                    .map((item) => (
                      <option key={item} value={item} />
                    ))}
                </datalist>
              </label>
              <label>
                Price (₹)
                <input
                  type="number"
                  min="0.01"
                  max="100000"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Image URL (optional)
                <input
                  type="url"
                  maxLength={2048}
                  value={form.imageUrl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      imageUrl: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="menu-checkbox">
                <input
                  type="checkbox"
                  checked={form.vegetarian}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      vegetarian: event.target.checked,
                    }))
                  }
                />{" "}
                Vegetarian
              </label>
              <label className="menu-checkbox">
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      available: event.target.checked,
                    }))
                  }
                />{" "}
                In stock
              </label>
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              <div className="table-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </button>
                <button className="primary-button" disabled={saving}>
                  {saving
                    ? "Saving..."
                    : dialog === "create"
                      ? "Save dish"
                      : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {bulkDialog && (
        <div
          className="table-modal-backdrop"
          onClick={() => {
            if (!importing) setBulkDialog(false);
          }}
        >
          <section
            className="table-modal menu-modal menu-import-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-import-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="table-modal-head">
              <div>
                <span className="eyebrow">MENU MANAGEMENT</span>
                <h2 id="menu-import-title">Import dishes from CSV</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close"
                onClick={() => setBulkDialog(false)}
                disabled={importing}
              >
                <X size={18} />
              </button>
            </div>
            <form className="table-form" onSubmit={importDishes}>
              <p className="menu-import-help">
                Upload up to {MAX_MENU_IMPORT_ITEMS} dishes at once. Required
                columns: name, category, price. Optional columns: description,
                vegetarian, available, imageUrl.
              </p>
              <button
                type="button"
                className="secondary-button menu-template-button"
                onClick={downloadCsvTemplate}
              >
                Download CSV template
              </button>
              <label>
                CSV file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) =>
                    void selectCsvFile(event.currentTarget.files?.[0])
                  }
                />
              </label>
              {bulkFile && (
                <p className="menu-import-summary" role="status">
                  {bulkFile}: {bulkItems.length} dishes ready to import.
                </p>
              )}
              <p className="menu-import-help">
                Use true/false, yes/no, or 1/0 for vegetarian and available.
                CSV values containing commas should be enclosed in double
                quotes. Each import is all-or-nothing.
              </p>
              {bulkError && (
                <p className="auth-error" role="alert">
                  {bulkError}
                </p>
              )}
              <div className="table-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setBulkDialog(false)}
                  disabled={importing}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  disabled={importing || !bulkItems.length}
                >
                  {importing ? "Importing..." : "Import dishes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
