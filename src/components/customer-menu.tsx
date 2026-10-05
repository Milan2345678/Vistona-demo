"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Droplets,
  FileDown,
  Minus,
  Plus,
  ReceiptText,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import PayButton from "@/components/PayButton";

type PublicMenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  vegetarian: boolean;
  available: boolean;
  imageUrl: string | null;
  category: string;
};

type Cart = Record<string, number>;

type CustomerOrder = {
  id: string;
  number: number;
  status: "new" | "preparing" | "ready" | "served" | "completed" | "cancelled";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  amount: number;
  createdAt: string;
  estimatedReadyAt: string;
  checkedAt: number;
};

const orderStatusLabels: Record<CustomerOrder["status"], string> = {
  new: "Received by restaurant",
  preparing: "Being prepared in the kitchen",
  ready: "Ready to serve",
  served: "Served at your table",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function CustomerMenu({
  restaurantSlug,
  tableToken,
}: {
  restaurantSlug: string;
  tableToken: string;
}) {
  const [restaurantName, setRestaurantName] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [menu, setMenu] = useState<PublicMenuItem[]>([]);
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<Cart>({});
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<CustomerOrder | null>(null);
  const [trackingError, setTrackingError] = useState("");
  const [payAtRestaurant, setPayAtRestaurant] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [preferences, setPreferences] = useState<string[]>([]);
  const [requestPending, setRequestPending] = useState<"BILL" | "WATER" | null>(
    null,
  );
  const [serviceMessages, setServiceMessages] = useState<
    Partial<Record<"BILL" | "WATER", string>>
  >({});
  const [serviceError, setServiceError] = useState("");
  const [downloadingBill, setDownloadingBill] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch(
      `/api/qr/${encodeURIComponent(restaurantSlug)}/menu?tableToken=${encodeURIComponent(tableToken)}`,
    )
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(body.error ?? "Menu could not be loaded");
        return body;
      })
      .then((body) => {
        if (!mounted) return;
        setRestaurantName(body.restaurant.name);
        setTableNumber(body.table.number);
        setMenu(body.menu);
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
  }, [restaurantSlug, tableToken]);

  const refreshOrderStatus = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(
          `/api/qr/${encodeURIComponent(restaurantSlug)}/orders/${encodeURIComponent(id)}?tableToken=${encodeURIComponent(tableToken)}`,
          { cache: "no-store" },
        );
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(body.error ?? "Order status could not be loaded");
        setTracking({ ...body.order, checkedAt: Date.now() });
        setTrackingError("");
      } catch (cause) {
        setTrackingError(
          cause instanceof Error
            ? cause.message
            : "Order status could not be loaded",
        );
      }
    },
    [restaurantSlug, tableToken],
  );

  useEffect(() => {
    if (!orderId) return;
    const interval = window.setInterval(
      () => void refreshOrderStatus(orderId),
      10_000,
    );
    return () => window.clearInterval(interval);
  }, [orderId, refreshOrderStatus]);

  const categories = ["All", ...new Set(menu.map((item) => item.category))];
  const visibleMenu = menu.filter(
    (item) => category === "All" || item.category === category,
  );
  const selectedItems = Object.entries(cart)
    .map(([id, quantity]) => ({
      item: menu.find((entry) => entry.id === id),
      quantity,
    }))
    .filter((entry): entry is { item: PublicMenuItem; quantity: number } =>
      Boolean(entry.item && entry.quantity > 0),
    );
  const total = selectedItems.reduce(
    (sum, entry) => sum + entry.item.price * entry.quantity,
    0,
  );
  const itemCount = selectedItems.reduce(
    (sum, entry) => sum + entry.quantity,
    0,
  );
  const estimateMinutesRemaining = tracking
    ? Math.ceil(
        (new Date(tracking.estimatedReadyAt).getTime() - tracking.checkedAt) /
          60_000,
      )
    : 0;

  async function sendTableRequest(type: "BILL" | "WATER") {
    setRequestPending(type);
    setServiceError("");
    try {
      const response = await fetch(
        `/api/qr/${encodeURIComponent(restaurantSlug)}/requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableToken, type }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Request could not be sent");
      setServiceMessages((current) => ({
        ...current,
        [type]:
          type === "BILL"
            ? "The team has been asked to bring your bill."
            : "The team has been asked to bring a water bottle.",
      }));
    } catch (cause) {
      setServiceError(
        cause instanceof Error ? cause.message : "Request could not be sent",
      );
    } finally {
      setRequestPending(null);
    }
  }

  async function downloadBill() {
    if (!orderId) return;
    setDownloadingBill(true);
    setServiceError("");
    try {
      const response = await fetch(
        `/api/qr/${encodeURIComponent(restaurantSlug)}/orders/${encodeURIComponent(orderId)}/bill?tableToken=${encodeURIComponent(tableToken)}`,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Bill could not be downloaded");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `vistona-order-${orderNumber}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setServiceError(
        cause instanceof Error ? cause.message : "Bill could not be downloaded",
      );
    } finally {
      setDownloadingBill(false);
    }
  }

  function changeQuantity(item: PublicMenuItem, delta: number) {
    if (!item.available) return;
    setCart((current) => {
      const next = Math.max(0, Math.min(99, (current[item.id] ?? 0) + delta));
      const updated = { ...current };
      if (next === 0) delete updated[item.id];
      else updated[item.id] = next;
      return updated;
    });
  }

  async function placeOrder() {
    if (!selectedItems.length || placing) return;
    setError("");
    if (customerName.trim().length < 2) {
      setError("Enter your name so the restaurant can identify your order.");
      return;
    }
    if (!/^\+?[1-9]\d{7,14}$/.test(customerPhone.trim())) {
      setError("Enter a valid mobile number, including country code if needed.");
      return;
    }
    setPlacing(true);
    try {
      const response = await fetch(
        `/api/qr/${encodeURIComponent(restaurantSlug)}/orders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableToken,
            customerName,
            customerPhone,
            specialInstructions,
            preferences,
            items: selectedItems.map(({ item, quantity }) => ({
              menuItemId: item.id,
              quantity,
            })),
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Order could not be placed");
      setOrderNumber(body.order.number);
      setOrderId(body.order.id);
      setTracking(null);
      setPayAtRestaurant(false);
      setServiceMessages({});
      void refreshOrderStatus(body.order.id);
      setCart({});
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Order could not be placed",
      );
    } finally {
      setPlacing(false);
    }
  }

  return (
    <main className="customer-menu-page">
      <header className="customer-menu-header">
        <a
          className="customer-menu-brand"
          href={`/menu/${encodeURIComponent(restaurantSlug)}/table/${encodeURIComponent(tableToken)}`}
        >
          <span className="brand-mark">V</span>
          <span>
            <strong>VISTONA</strong>
            <small>RESTAURANT MENU</small>
          </span>
        </a>
        <span className="customer-table-label">
          {tableNumber ? `TABLE ${tableNumber}` : "TABLE QR"}
        </span>
      </header>

      <section className="customer-menu-intro">
        <span className="eyebrow">{restaurantName || "RESTAURANT"}</span>
        <h1>{restaurantName || "Restaurant menu"}</h1>
        {tableNumber && (
          <p className="customer-order-table">
            You are ordering for <strong>Table {tableNumber}</strong>
          </p>
        )}
      </section>

      {error && (
        <div className="customer-menu-error" role="alert">
          {error}
        </div>
      )}
      {orderNumber !== null && (
        <div className="customer-menu-success" role="status">
          <div className="customer-order-tracking">
            <strong>Order #{orderNumber}</strong>
            <span>Table {tableNumber}</span>
            <p>
              Order status:{" "}
              <strong>
                {tracking
                  ? orderStatusLabels[tracking.status] ?? tracking.status
                  : "Loading status..."}
              </strong>
            </p>
            {tracking && !["ready", "served", "completed", "cancelled"].includes(tracking.status) && (
              <p>
                Estimated ready by{" "}
                <strong>
                  {new Date(tracking.estimatedReadyAt).toLocaleTimeString(
                    "en-IN",
                    { hour: "numeric", minute: "2-digit" },
                  )}
                </strong>
                {estimateMinutesRemaining > 0
                  ? ` (about ${estimateMinutesRemaining} min)`
                  : " — taking longer than estimated"}
              </p>
            )}
            {tracking?.status === "ready" && (
              <p>Your order is ready. Please ask the restaurant staff.</p>
            )}
            {trackingError && (
              <p className="customer-menu-error" role="alert">
                {trackingError}
              </p>
            )}
            {tracking?.status === "cancelled" ? (
              <p className="customer-order-payment">
                This order was cancelled. Please contact the restaurant about
                any payment already made.
              </p>
            ) : tracking?.paymentStatus === "paid" ? (
              <p className="customer-order-payment customer-order-paid">
                Online payment complete
              </p>
            ) : (
              <div className="customer-order-payment">
                <p>
                  Payment:{" "}
                  {payAtRestaurant
                    ? "Pay at the restaurant"
                    : "Choose online payment or pay at the restaurant"}
                </p>
                <div className="customer-order-payment-actions">
                  {orderId && (
                    <PayButton
                      orderId={orderId}
                      tableToken={tableToken}
                      label="Pay online"
                      onPaid={() => void refreshOrderStatus(orderId)}
                    />
                  )}
                  <button
                    className="secondary-button"
                    onClick={() => setPayAtRestaurant(true)}
                  >
                    Pay at restaurant
                  </button>
                </div>
              </div>
            )}
            {tracking?.status !== "cancelled" && orderId && (
              <div className="customer-table-services">
                <h3>Need anything at the table?</h3>
                <div className="customer-service-actions">
                  <button
                    className="secondary-button"
                    onClick={() => void sendTableRequest("BILL")}
                    disabled={requestPending !== null}
                  >
                    {serviceMessages.BILL ? (
                      <Check size={16} />
                    ) : (
                      <ReceiptText size={16} />
                    )}
                    {serviceMessages.BILL ? "Bill requested" : "Bring my bill"}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void sendTableRequest("WATER")}
                    disabled={requestPending !== null}
                  >
                    {serviceMessages.WATER ? (
                      <Check size={16} />
                    ) : (
                      <Droplets size={16} />
                    )}
                    {serviceMessages.WATER
                      ? "Water requested"
                      : "Need a water bottle"}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void downloadBill()}
                    disabled={downloadingBill}
                  >
                    <FileDown size={16} />
                    {downloadingBill ? "Preparing bill..." : "Download PDF bill"}
                  </button>
                </div>
                {serviceMessages.BILL && (
                  <p className="customer-service-success" role="status">
                    {serviceMessages.BILL}
                  </p>
                )}
                {serviceMessages.WATER && (
                  <p className="customer-service-success" role="status">
                    {serviceMessages.WATER}
                  </p>
                )}
                {serviceError && (
                  <p className="customer-menu-error" role="alert">
                    {serviceError}
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            className="secondary-button"
            onClick={() => {
              setOrderNumber(null);
              setOrderId(null);
              setTracking(null);
              setTrackingError("");
            }}
          >
            Place another order
          </button>
        </div>
      )}

      <div className="customer-menu-layout">
        <section className="customer-menu-list" aria-label="Restaurant menu">
          <div className="customer-category-tabs">
            {categories.map((item) => (
              <button
                className={category === item ? "selected" : ""}
                key={item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="customer-menu-empty">Loading menu...</div>
          ) : !menu.length ? (
            <div className="customer-menu-empty">
              <h2>Menu is being prepared</h2>
              <p>Please check again soon.</p>
            </div>
          ) : !visibleMenu.length ? (
            <div className="customer-menu-empty">
              No dishes in this category.
            </div>
          ) : (
            visibleMenu.map((item) => (
              <article
                className={`customer-dish ${!item.available ? "out-of-stock" : ""}`}
                key={item.id}
              >
                {item.imageUrl ? (
                  <div className="customer-dish-image">
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      unoptimized
                      sizes="(max-width: 700px) 100vw, 260px"
                    />
                  </div>
                ) : (
                  <div
                    className={`customer-dish-art ${item.vegetarian ? "veg" : "nonveg"}`}
                  >
                    <Utensils size={20} />
                  </div>
                )}
                <div className="customer-dish-copy">
                  <span className="customer-dish-category">
                    {item.category}
                  </span>
                  <h2>{item.name}</h2>
                  <p>{item.description}</p>
                  <div className="customer-dish-price">
                    ₹{item.price.toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="customer-dish-action">
                  {item.available ? (
                    <>
                      <span className="stock-label in-stock">IN STOCK</span>
                      <div className="customer-quantity">
                        <button
                          aria-label={`Remove one ${item.name}`}
                          onClick={() => changeQuantity(item, -1)}
                          disabled={!cart[item.id]}
                        >
                          <Minus size={14} />
                        </button>
                        <strong>{cart[item.id] ?? 0}</strong>
                        <button
                          aria-label={`Add one ${item.name}`}
                          onClick={() => changeQuantity(item, 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <span className="stock-label out-stock">OUT OF STOCK</span>
                  )}
                </div>
              </article>
            ))
          )}
        </section>

        <aside className="customer-cart">
          <div className="customer-cart-heading">
            <ShoppingBag size={17} />
            <h2>Your order</h2>
            <span>{itemCount}</span>
          </div>
          <p className="customer-cart-table">Table {tableNumber || "--"}</p>
          {!selectedItems.length ? (
            <p className="customer-cart-empty">
              Add an available dish to start your order.
            </p>
          ) : (
            <div className="customer-cart-lines">
              {selectedItems.map(({ item, quantity }) => (
                <div className="customer-cart-line" key={item.id}>
                  <span>
                    {item.name} <small>×{quantity}</small>
                  </span>
                  <strong>
                    ₹{(item.price * quantity).toLocaleString("en-IN")}
                  </strong>
                </div>
              ))}
            </div>
          )}
          {selectedItems.length > 0 && (
            <div className="customer-order-details">
              <h3>Order details</h3>
              <label>
                Your name
                <input
                  autoComplete="name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Name for your order"
                />
              </label>
              <label>
                Mobile number
                <input
                  autoComplete="tel"
                  type="tel"
                  inputMode="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  required
                  pattern="\+?[1-9][0-9]{7,14}"
                  title="Enter a valid phone number with country code if needed"
                  placeholder="e.g. 9876543210"
                />
              </label>
              <fieldset className="customer-preferences">
                <legend>Kitchen preferences</legend>
                {["Less spicy", "No onion", "Pack separately"].map((item) => (
                  <label
                    className={`customer-preference-chip ${preferences.includes(item) ? "selected" : ""}`}
                    key={item}
                  >
                    <input
                      type="checkbox"
                      checked={preferences.includes(item)}
                      onChange={() =>
                        setPreferences((current) =>
                          current.includes(item)
                            ? current.filter((preference) => preference !== item)
                            : [...current, item],
                        )
                      }
                    />
                    {item}
                  </label>
                ))}
              </fieldset>
              <label>
                Other special instructions
                <textarea
                  value={specialInstructions}
                  onChange={(event) =>
                    setSpecialInstructions(event.target.value)
                  }
                  maxLength={400}
                  rows={2}
                  placeholder="Tell the kitchen anything else..."
                />
              </label>
            </div>
          )}
          <div className="customer-cart-total">
            <span>Total</span>
            <strong>₹{total.toLocaleString("en-IN")}</strong>
          </div>
          <button
            className="primary-button full"
            onClick={() => void placeOrder()}
            disabled={
              !selectedItems.length ||
              placing ||
              loading ||
              orderNumber !== null ||
              customerName.trim().length < 2 ||
              !/^\+?[1-9]\d{7,14}$/.test(customerPhone.trim())
            }
          >
            {placing ? "Sending order..." : "Place order"}
          </button>
          <p className="customer-cart-note">
            Add your name and a valid mobile number to send your order to the
            kitchen.
          </p>
        </aside>
      </div>
    </main>
  );
}
