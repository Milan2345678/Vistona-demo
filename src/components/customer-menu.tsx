"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Minus, Plus, ShoppingBag, Utensils } from "lucide-react";

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
    setPlacing(true);
    try {
      const response = await fetch(
        `/api/qr/${encodeURIComponent(restaurantSlug)}/orders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableToken,
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
          <strong>Order #{orderNumber} sent to the kitchen.</strong>
          <span>Table {tableNumber}</span>
          <button
            className="secondary-button"
            onClick={() => setOrderNumber(null)}
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
              orderNumber !== null
            }
          >
            {placing ? "Sending order..." : "Place order"}
          </button>
          <p className="customer-cart-note">
            Your order will be sent to the kitchen.
          </p>
        </aside>
      </div>
    </main>
  );
}
