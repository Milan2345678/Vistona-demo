"use client";

import { useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { Download, Plus, QrCode, X } from "lucide-react";
import Image from "next/image";

type TableStatus = "AVAILABLE" | "OCCUPIED" | "BILLING";
type TableRow = {
  id: string;
  databaseId?: string;
  publicQrToken?: string;
  active?: boolean;
  seats: number;
  status:
    | "Available"
    | "Occupied"
    | "Billing"
    | "Ordering"
    | "Preparing"
    | "Served"
    | "Inactive";
  order: string | null;
  waiter: string;
  elapsed: string;
};
type TableResponse = {
  id: string;
  number: string;
  seats: number;
  status: string;
  active?: boolean;
  publicQrToken?: string;
};

function displayStatus(status: string, active?: boolean) {
  if (active === false) return "Inactive";
  if (status === "AVAILABLE") return "Available";
  if (status === "BILLING") return "Billing";
  return "Occupied";
}

function tableFromResponse(table: TableResponse): TableRow {
  return {
    id: table.number,
    databaseId: table.id,
    publicQrToken: table.publicQrToken,
    active: table.active !== false,
    seats: table.seats,
    status: displayStatus(table.status, table.active),
    order: null,
    waiter: "-",
    elapsed: "",
  };
}

function databaseStatus(status: string): TableStatus {
  if (status === "Available") return "AVAILABLE";
  if (status === "Billing") return "BILLING";
  return "OCCUPIED";
}

export default function TableManagement({
  tables,
  canManage,
  restaurantSlug,
  loading,
  error,
  onSelect,
  onStartOrder,
  onTableChanged,
}: {
  tables: TableRow[];
  canManage: boolean;
  restaurantSlug: string;
  loading: boolean;
  error: string;
  onSelect: (table: TableRow) => void;
  onStartOrder: () => void;
  onTableChanged: (table: TableRow) => void;
}) {
  const [filter, setFilter] = useState("All");
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<TableRow | null>(null);
  const [tableNumber, setTableNumber] = useState("");
  const [seats, setSeats] = useState("2");
  const [status, setStatus] = useState<TableStatus>("AVAILABLE");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [qrPreview, setQrPreview] = useState<{
    table: string;
    dataUrl: string;
    url: string;
  } | null>(null);

  const visible = tables.filter((table) => {
    if (filter === "All") return true;
    if (filter === "Inactive") return table.active === false;
    return table.active !== false && table.status === filter;
  });

  function startCreate() {
    setEditing(null);
    setTableNumber("");
    setSeats("2");
    setStatus("AVAILABLE");
    setActive(true);
    setActionError("");
    setNotice("");
    setDialog("create");
  }

  function startEdit(table: TableRow) {
    setEditing(table);
    setTableNumber(table.id);
    setSeats(String(table.seats));
    setStatus(databaseStatus(table.status));
    setActive(table.active !== false);
    setActionError("");
    setNotice("");
    setDialog("edit");
  }

  async function saveTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    setNotice("");
    const seatCount = Number(seats);
    if (
      !tableNumber.trim() ||
      !Number.isInteger(seatCount) ||
      seatCount < 1 ||
      seatCount > 100
    ) {
      setActionError("Enter a table number and a seat count from 1 to 100.");
      return;
    }

    setSaving(true);
    try {
      const isCreate = dialog === "create";
      const response = await fetch(
        isCreate
          ? "/api/restaurant/tables"
          : `/api/restaurant/tables/${editing?.databaseId}`,
        {
          method: isCreate ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: tableNumber.trim(),
            seats: seatCount,
            ...(isCreate ? {} : { status, active }),
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Table could not be saved");
      onTableChanged(tableFromResponse(body.table));
      setDialog(null);
      setNotice(
        isCreate
          ? `Table ${body.table.number} added`
          : `Table ${body.table.number} updated`,
      );
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Table could not be saved",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeTable(table: TableRow) {
    if (!table.databaseId) return;
    if (!window.confirm(`Are you sure you want to remove Table ${table.id}?`))
      return;
    setActionError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/restaurant/tables/${table.databaseId}`,
        { method: "DELETE" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Table could not be removed");
      onTableChanged(tableFromResponse(body.table));
      setNotice(`Table ${table.id} deactivated`);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Table could not be removed",
      );
    }
  }

  function qrUrl(table: TableRow) {
    if (!table.publicQrToken || !restaurantSlug) return "";
    return `${window.location.origin}/menu/${encodeURIComponent(restaurantSlug)}/table/${encodeURIComponent(table.publicQrToken)}`;
  }

  async function showQr(table: TableRow) {
    const url = qrUrl(table);
    if (!url) {
      setActionError(
        "This table does not have a QR token. Apply the table management migration, then reload.",
      );
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1 });
      setQrPreview({ table: table.id, dataUrl, url });
      setActionError("");
    } catch {
      setActionError("QR code could not be generated");
    }
  }

  async function downloadQr(table: TableRow) {
    const url = qrUrl(table);
    if (!url) {
      setActionError(
        "This table does not have a QR token. Apply the table management migration, then reload.",
      );
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 640, margin: 2 });
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `vistona-table-${table.id}-qr.png`;
      anchor.click();
      setActionError("");
      setNotice(`QR downloaded for Table ${table.id}`);
    } catch {
      setActionError("QR code could not be downloaded");
    }
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TABLES</span>
          <h1>Floor overview</h1>
          <p>
            {canManage
              ? "Manage tables for this restaurant."
              : "Active tables in your restaurant."}
          </p>
        </div>
        <div className="table-heading-actions">
          {canManage && (
            <button className="primary-button" onClick={startCreate}>
              <Plus size={16} /> Add New Table
            </button>
          )}
          {canManage && (
            <a className="secondary-button" href="/manager/staff">
              Staff management
            </a>
          )}
          {!canManage && (
            <button
              className="primary-button"
              onClick={onStartOrder}
              disabled={!tables.some((table) => table.active !== false)}
            >
              <Plus size={16} /> Start order
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p className="table-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="table-error" role="alert">
          <strong>Tables could not be loaded.</strong>
          <span>{error}</span>
        </div>
      )}
      {actionError && (
        <p className="auth-error" role="alert">
          {actionError}
        </p>
      )}

      <div className="filter-bar">
        {(canManage
          ? ["All", "Available", "Occupied", "Billing", "Inactive"]
          : ["All", "Available", "Occupied", "Billing"]
        ).map((item) => (
          <button
            className={filter === item ? "selected" : ""}
            key={item}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="table-empty-state" role="status">
          Loading restaurant tables...
        </div>
      ) : !error && visible.length === 0 ? (
        <div className="table-empty-state">
          <h2>
            {tables.length === 0 ? "No tables yet" : "No tables in this view"}
          </h2>
          <p>
            {canManage && tables.length === 0
              ? "Add a table to get the restaurant floor started."
              : "Try another status filter."}
          </p>
          {canManage && tables.length === 0 && (
            <button className="primary-button" onClick={startCreate}>
              <Plus size={16} /> Add New Table
            </button>
          )}
        </div>
      ) : (
        <div className="manager-table-grid">
          {visible.map((table) => (
            <article
              className={`manager-table-card ${table.active === false ? "inactive" : ""}`}
              key={table.databaseId ?? table.id}
            >
              <div className="manager-table-card-head">
                <div>
                  <span className="eyebrow">TABLE</span>
                  <h2>{table.id}</h2>
                </div>
                <span
                  className={`status-pill ${table.active === false ? "status-inactive" : table.status === "Available" ? "status-available" : table.status === "Billing" ? "status-billing" : "status-ordering"}`}
                >
                  {table.status}
                </span>
              </div>
              <div className="manager-table-meta">
                <span>{table.seats} seats</span>
                {table.order && <span>{table.order}</span>}
              </div>
              {canManage && table.active !== false && (
                <div className="manager-table-qr-actions">
                  <button
                    className="secondary-button"
                    onClick={() => void showQr(table)}
                  >
                    <QrCode size={15} /> QR
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void downloadQr(table)}
                  >
                    <Download size={15} /> Download QR
                  </button>
                </div>
              )}
              <div className="manager-table-actions">
                {table.active !== false && (
                  <button
                    className="secondary-button"
                    onClick={() => onSelect(table)}
                  >
                    Details
                  </button>
                )}
                {canManage && (
                  <button
                    className="secondary-button"
                    onClick={() => startEdit(table)}
                  >
                    Edit
                  </button>
                )}
                {canManage && table.active !== false && (
                  <button
                    className="text-button"
                    onClick={() => void removeTable(table)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {dialog && (
        <div className="table-modal-backdrop" onClick={() => setDialog(null)}>
          <section
            className="table-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="table-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="table-modal-head">
              <div>
                <span className="eyebrow">TABLE MANAGEMENT</span>
                <h2 id="table-modal-title">
                  {dialog === "create"
                    ? "Add New Table"
                    : `Edit Table ${editing?.id}`}
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
              onSubmit={(event) => void saveTable(event)}
              className="table-form"
            >
              <label>
                Table number/name
                <input
                  autoFocus
                  value={tableNumber}
                  onChange={(event) => setTableNumber(event.target.value)}
                  required
                  maxLength={20}
                />
              </label>
              <label>
                Number of seats
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={seats}
                  onChange={(event) => setSeats(event.target.value)}
                  required
                />
              </label>
              {dialog === "edit" && (
                <>
                  <label>
                    Status
                    <select
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as TableStatus)
                      }
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="OCCUPIED">Occupied</option>
                      <option value="BILLING">Billing</option>
                    </select>
                  </label>
                  <label className="table-active-toggle">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(event) => setActive(event.target.checked)}
                    />{" "}
                    Active
                  </label>
                </>
              )}
              {actionError && (
                <p className="auth-error" role="alert">
                  {actionError}
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
                      ? "Create table"
                      : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {qrPreview && (
        <div
          className="table-modal-backdrop"
          onClick={() => setQrPreview(null)}
        >
          <section
            className="table-modal qr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="table-modal-head">
              <div>
                <span className="eyebrow">CUSTOMER QR</span>
                <h2 id="qr-modal-title">Table {qrPreview.table}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close QR preview"
                onClick={() => setQrPreview(null)}
              >
                <X size={18} />
              </button>
            </div>
            <Image
              src={qrPreview.dataUrl}
              alt={`QR code for Table ${qrPreview.table}`}
              width={280}
              height={280}
              unoptimized
            />
            <p>Scan to order at Table {qrPreview.table}</p>
            <code>{qrPreview.url}</code>
            <button
              className="primary-button full"
              onClick={() => {
                const anchor = document.createElement("a");
                anchor.href = qrPreview.dataUrl;
                anchor.download = `vistona-table-${qrPreview.table}-qr.png`;
                anchor.click();
              }}
            >
              Download QR
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
