"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import TableManagement from "@/components/table-management";
import {
  Bell,
  ChefHat,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Plus,
  QrCode,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  UserRound,
  Users,
  Utensils,
  X,
} from "lucide-react";

type Role = "Manager" | "Waiter" | "Kitchen";
type Status =
  | "Available"
  | "Occupied"
  | "Billing"
  | "Ordering"
  | "Preparing"
  | "Served"
  | "Inactive";
type OrderStatus = "New" | "Preparing" | "Ready" | "Served" | "Completed";
type OrderSource = "QR" | "Waiter" | "POS";
type Tenant = {
  id?: string;
  name: string;
  city: string;
  cuisine?: string;
  plan?: "Enterprise" | "Growth";
  live?: boolean;
};
type View =
  | "Dashboard"
  | "Tables"
  | "Orders"
  | "Waiter Mode"
  | "QR Orders"
  | "Kitchen"
  | "Menu"
  | "Customers"
  | "Reports"
  | "Settings";

type Table = {
  id: string;
  databaseId?: string;
  publicQrToken?: string;
  active?: boolean;
  seats: number;
  status: Status;
  order: string | null;
  waiter: string;
  elapsed: string;
};
function tableFromApi(table: {
  id: string;
  number: string;
  seats: number;
  status: string;
  active?: boolean;
  publicQrToken?: string;
}): Table {
  const active = table.active !== false;
  return {
    id: table.number,
    databaseId: table.id,
    publicQrToken: table.publicQrToken,
    active,
    seats: table.seats,
    status: !active
      ? "Inactive"
      : table.status === "AVAILABLE"
        ? "Available"
        : table.status === "BILLING"
          ? "Billing"
          : "Occupied",
    order: null,
    waiter: "-",
    elapsed: "",
  };
}
type Order = {
  id: string;
  table: string;
  waiter: string;
  items: string[];
  amount: number;
  status: OrderStatus;
  time: string;
  source: OrderSource;
  tenantId?: string;
  restaurantOrderId?: string;
  menuItemIds?: Record<string, string>;
};
type MenuItem = {
  id?: string;
  name: string;
  description: string;
  category: string;
  price: number;
  veg: boolean;
  available: boolean;
  imageUrl?: string | null;
};
const initialTables: Table[] = [
  {
    id: "T01",
    seats: 2,
    status: "Available",
    order: null,
    waiter: "-",
    elapsed: "",
  },
  {
    id: "T02",
    seats: 4,
    status: "Ordering",
    order: "#1041",
    waiter: "Meera",
    elapsed: "8 min",
  },
  {
    id: "T03",
    seats: 4,
    status: "Preparing",
    order: "#1042",
    waiter: "Rahul",
    elapsed: "12 min",
  },
  {
    id: "T04",
    seats: 6,
    status: "Available",
    order: null,
    waiter: "-",
    elapsed: "",
  },
  {
    id: "T05",
    seats: 2,
    status: "Served",
    order: "#1039",
    waiter: "Meera",
    elapsed: "22 min",
  },
  {
    id: "T06",
    seats: 4,
    status: "Billing",
    order: "#1038",
    waiter: "Rahul",
    elapsed: "31 min",
  },
  {
    id: "T07",
    seats: 6,
    status: "Preparing",
    order: "#1040",
    waiter: "Asha",
    elapsed: "16 min",
  },
  {
    id: "T08",
    seats: 8,
    status: "Available",
    order: null,
    waiter: "-",
    elapsed: "",
  },
  {
    id: "T09",
    seats: 4,
    status: "Available",
    order: null,
    waiter: "-",
    elapsed: "",
  },
  {
    id: "T10",
    seats: 2,
    status: "Served",
    order: "#1037",
    waiter: "Asha",
    elapsed: "26 min",
  },
  {
    id: "T11",
    seats: 4,
    status: "Available",
    order: null,
    waiter: "-",
    elapsed: "",
  },
  {
    id: "T12",
    seats: 6,
    status: "Ordering",
    order: "#1036",
    waiter: "Rahul",
    elapsed: "5 min",
  },
];

const tenantProfiles: Tenant[] = [
  {
    id: "anndham",
    name: "Anndham Family Dhaba",
    city: "Jaipur",
    cuisine: "North Indian",
    plan: "Enterprise",
    live: true,
  },
  {
    id: "harbor-bay",
    name: "Harbor Bay Bistro",
    city: "Pune",
    cuisine: "Continental",
    plan: "Growth",
    live: true,
  },
  {
    id: "saffron-loop",
    name: "Saffron Loop Cafe",
    city: "Bengaluru",
    cuisine: "Modern Indian",
    plan: "Enterprise",
    live: false,
  },
];

const initialOrders: Order[] = [
  {
    id: "#1042",
    table: "T03",
    waiter: "Rahul",
    items: ["Paneer Tikka x1", "Butter Chicken x1", "Butter Naan x4"],
    amount: 880,
    status: "Preparing",
    time: "12 min ago",
    source: "Waiter",
    tenantId: "anndham",
  },
  {
    id: "#1041",
    table: "T02",
    waiter: "Meera",
    items: ["Dal Makhani x1", "Garlic Naan x2"],
    amount: 540,
    status: "Ready",
    time: "8 min ago",
    source: "QR",
    tenantId: "anndham",
  },
  {
    id: "#1040",
    table: "T07",
    waiter: "Asha",
    items: ["Tandoori Chicken x1", "Jeera Rice x1"],
    amount: 760,
    status: "New",
    time: "16 min ago",
    source: "QR",
    tenantId: "anndham",
  },
  {
    id: "#1039",
    table: "T05",
    waiter: "Meera",
    items: ["Kadhai Paneer x1", "Plain Rice x1"],
    amount: 480,
    status: "Served",
    time: "22 min ago",
    source: "POS",
    tenantId: "anndham",
  },
];

const menuSeed: MenuItem[] = [
  {
    name: "Paneer Tikka",
    description: "Charred cottage cheese, peppers and house spices",
    category: "Starters",
    price: 220,
    veg: true,
    available: true,
  },
  {
    name: "Butter Chicken",
    description: "Creamy tomato curry with tandoori chicken",
    category: "Main Course",
    price: 320,
    veg: false,
    available: true,
  },
  {
    name: "Dal Makhani",
    description: "Slow-cooked black lentils finished with butter",
    category: "Main Course",
    price: 220,
    veg: true,
    available: true,
  },
  {
    name: "Kadhai Paneer",
    description: "Paneer, onion and peppers in a robust masala",
    category: "Main Course",
    price: 280,
    veg: true,
    available: true,
  },
  {
    name: "Butter Naan",
    description: "Tandoor-baked naan brushed with cultured butter",
    category: "Breads",
    price: 60,
    veg: true,
    available: true,
  },
  {
    name: "Garlic Naan",
    description: "Soft naan with roasted garlic and coriander",
    category: "Breads",
    price: 80,
    veg: true,
    available: true,
  },
  {
    name: "Masala Chaas",
    description: "Chilled buttermilk with cumin and mint",
    category: "Drinks",
    price: 70,
    veg: true,
    available: false,
  },
  {
    name: "Gulab Jamun",
    description: "Warm khoya dumplings with cardamom syrup",
    category: "Desserts",
    price: 120,
    veg: true,
    available: true,
  },
];

const navItems: { label: View; icon: typeof LayoutDashboard; roles: Role[] }[] =
  [
    { label: "Dashboard", icon: LayoutDashboard, roles: ["Manager"] },
    { label: "Tables", icon: Grid2X2, roles: ["Manager", "Waiter"] },
    {
      label: "Orders",
      icon: ShoppingBag,
      roles: ["Manager", "Waiter", "Kitchen"],
    },
    { label: "QR Orders", icon: QrCode, roles: ["Waiter"] },
    { label: "Waiter Mode", icon: Utensils, roles: ["Manager", "Waiter"] },
    { label: "Kitchen", icon: ChefHat, roles: ["Manager", "Kitchen"] },
    { label: "Menu", icon: MenuIcon, roles: ["Manager", "Waiter"] },
    { label: "Customers", icon: Users, roles: ["Manager", "Waiter"] },
    { label: "Reports", icon: CircleDollarSign, roles: ["Manager"] },
    { label: "Settings", icon: Settings, roles: ["Manager"] },
  ];

const statusTone: Record<string, string> = {
  Available: "status-available",
  Ordering: "status-ordering",
  Preparing: "status-preparing",
  Served: "status-served",
  Occupied: "status-ordering",
  Billing: "status-billing",
  New: "status-new",
  Ready: "status-ready",
  Completed: "status-served",
};
const sourceTone: Record<OrderSource, string> = {
  QR: "source-qr",
  Waiter: "source-waiter",
  POS: "source-pos",
};
const money = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

export default function Home() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [role, setRole] = useState<Role>("Manager");
  const [view, setView] = useState<View>("Dashboard");
  const [tables, setTables] = useState<Table[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [tablesError, setTablesError] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [orderingTable, setOrderingTable] = useState<Table | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantCity, setRestaurantCity] = useState("");
  const [restaurantSlug, setRestaurantSlug] = useState("");
  const [userName, setUserName] = useState("Manager");
  const [toast, setToast] = useState("");
  const [orderItems, setOrderItems] = useState<Record<string, number>>({});
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategory, setMenuCategory] = useState("All");
  const [orderFilter, setOrderFilter] = useState("All");
  const [orderSourceFilter, setOrderSourceFilter] = useState("All");

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/session")
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (!mounted) return;
        if (!data?.user) {
          router.replace("/login");
          return;
        }
        const nextRole = (data.user.role[0].toUpperCase() +
          data.user.role.slice(1)) as Role;
        setRole(nextRole);
        setUserName(data.user.name ?? data.user.email);
        setSignedIn(true);
        setView(
          nextRole === "Kitchen"
            ? "Kitchen"
            : nextRole === "Waiter"
              ? "Tables"
              : "Dashboard",
        );
      })
      .catch(() => {
        if (mounted) router.replace("/login");
      })
      .finally(() => {
        if (mounted) setAuthReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!signedIn) return;
    let mounted = true;
    const loadData = async () => {
      try {
        const restaurantResponse = await fetch("/api/restaurant");
        const restaurantData = await restaurantResponse.json().catch(() => ({}));
        if (!restaurantResponse.ok) {
          throw new Error(restaurantData.error ?? "Restaurant tables could not be loaded");
        }
        if (!mounted) return;
        setRestaurantName(restaurantData.restaurant.name);
        setRestaurantCity(restaurantData.restaurant.city);
        setRestaurantSlug(restaurantData.restaurant.slug);
        setTables(restaurantData.tables.map(tableFromApi));
        setTablesError("");
        setTablesLoading(false);
        setMenu(
          restaurantData.menu.map(
            (item: {
              id: string;
              name: string;
              description: string;
              category: string;
              price: number;
              vegetarian: boolean;
              available: boolean;
              imageUrl: string | null;
            }) => ({
              ...item,
              veg: item.vegetarian,
            }),
          ),
        );
        if (restaurantData.menuAvailable === false) {
          setToast("Menu data is unavailable. Tables are still available.");
        }

        try {
          const ordersResponse = await fetch("/api/orders");
          const orderData = await ordersResponse.json().catch(() => ({}));
          if (!ordersResponse.ok) {
            setToast(orderData.error ?? "Orders could not be loaded");
            return;
          }
          if (!mounted) return;
        setOrders(
          orderData.orders.map(
            (order: {
              id: string;
              number: number;
              tableNumber: string | null;
              waiterName: string | null;
              items: { menuItemId: string; name: string; quantity: number }[];
              amount: number;
              status: string;
              createdAt: string;
              source: string;
            }) => ({
              id: `#${order.number}`,
              restaurantOrderId: order.id,
              table: order.tableNumber
                ? `T${order.tableNumber.replace(/^T/, "")}`
                : "QR order",
              waiter: order.waiterName ?? "QR guest",
              items: order.items.map(
                (item) => `${item.name} x${item.quantity}`,
              ),
              amount: order.amount,
              status:
                order.status[0].toUpperCase() +
                order.status.slice(1).toLowerCase(),
              time: new Date(order.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              source:
                order.source.toUpperCase() === "WAITER"
                  ? "Waiter"
                  : order.source.toUpperCase() === "QR"
                    ? "QR"
                    : "POS",
              menuItemIds: Object.fromEntries(
                order.items.map((item) => [item.name, item.menuItemId]),
              ),
            }),
          ),
        );
        } catch {
          if (mounted) setToast("Orders could not be loaded. Tables remain available.");
        }
      } catch (error: unknown) {
        if (mounted) {
          const message = error instanceof Error ? error.message : "Tables could not be loaded";
          setTablesError(message);
          setTablesLoading(false);
          setToast(message);
        }
      }
    };
    void loadData();
    const timer = window.setInterval(() => void loadData(), 5000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [signedIn]);

  if (!authReady || !signedIn)
    return <main className="session-loading">Checking your Vistona session...</main>;

  async function signOut() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        notify("Sign out failed. Please try again.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      notify("Sign out failed. Please try again.");
    }
  }

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };
  const currentTable =
    orderingTable ??
    tables.find((table) => table.active !== false && table.id === "T03") ??
    tables.find((table) => table.active !== false);
  const orderTotal = Object.entries(orderItems).reduce(
    (total, [name, quantity]) =>
      total + (menu.find((item) => item.name === name)?.price ?? 0) * quantity,
    0,
  );
  const filteredMenu = menu.filter(
    (item) =>
      item.name.toLowerCase().includes(menuSearch.toLowerCase()) &&
      (menuCategory === "All" || item.category === menuCategory),
  );
  const filteredOrders = orders.filter(
    (order) =>
      (orderFilter === "All" || order.status === orderFilter) &&
      (orderSourceFilter === "All" || order.source === orderSourceFilter),
  );

  function updateOrder(id: string, status: OrderStatus) {
    const currentOrder = orders.find((order) => order.id === id);
    if (currentOrder?.restaurantOrderId) {
      const apiStatus = status.toUpperCase();
      void fetch(`/api/orders/${currentOrder.restaurantOrderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: apiStatus }),
      }).then(async (response) => {
        if (!response.ok) {
          const data = await response.json();
          notify(data.error ?? "Order update failed");
          return;
        }
        const data = await response.json();
        setOrders((current) =>
          current.map((order) =>
            order.id === id
              ? {
                  ...order,
                  status:
                    data.order.status[0].toUpperCase() +
                    data.order.status.slice(1).toLowerCase(),
                }
              : order,
          ),
        );
      });
      return;
    }
    notify("Order is not available for updates");
  }

  function sendToKitchen() {
    const selectedItems = Object.entries(orderItems).filter(
      ([, quantity]) => quantity > 0,
    );
    const items = selectedItems.map(([name, quantity]) => ({
      menuItemId: menu.find((item) => item.name === name)?.id,
      quantity,
    }));
    if (items.some((item) => !item.menuItemId)) {
      notify("Menu data is still loading");
      return;
    }
    const tableId = (
      currentTable as (Table & { databaseId?: string }) | undefined
    )?.databaseId;
    if (!tableId) {
      notify("Select a table before sending the order");
      return;
    }
    void fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, items }),
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) {
        notify(data.error ?? "Order could not be sent");
        return;
      }
      const created = data.order;
      setOrders((current) => [
        {
          id: `#${created.number}`,
          restaurantOrderId: created.id,
          table: created.tableNumber
            ? `T${created.tableNumber.replace(/^T/, "")}`
            : "QR order",
          waiter: userName,
          items: created.items.map(
            (item: { name: string; quantity: number }) =>
              `${item.name} x${item.quantity}`,
          ),
          amount: created.amount,
          status: "New",
          time: "Just now",
          source: "Waiter",
        },
        ...current,
      ]);
      setView("Kitchen");
      notify("KOT sent to kitchen");
    });
  }

  function addItem(name: string, delta: number) {
    setOrderItems((current) => ({
      ...current,
      [name]: Math.max(0, (current[name] ?? 0) + delta),
    }));
  }

  async function changeTableStatus(status: Status) {
    if (!selectedTable) return;
    if (!selectedTable.databaseId) {
      notify("Table is not available for updates");
      return;
    }
    const selectedDatabaseId = selectedTable.databaseId;
    const databaseStatus = status.toUpperCase();
    try {
      const response = await fetch(
        `/api/restaurant/tables/${selectedTable.databaseId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: databaseStatus }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        notify(data.error ?? "Table status update failed");
        return;
      }
      setTables((current) =>
        current.map((table) =>
          table.id === selectedTable.id ? { ...table, status } : table,
        ),
      );
      setSelectedTable((table): Table | null =>
        table ? { ...table, status } : null,
      );
      setOrderingTable((table): Table | null =>
        table && table.databaseId === selectedDatabaseId
          ? { ...table, status }
          : table,
      );
      notify(`${selectedTable.id} is now ${status.toLowerCase()}`);
    } catch {
      notify("Table status update failed");
    }
  }

  async function toggleMenuAvailability(item: MenuItem) {
    if (!item.id) {
      notify("Menu item is not available for updates");
      return;
    }
    try {
      const response = await fetch(
        `/api/restaurant/menu/${item.id}/availability`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ available: !item.available }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        notify(data.error ?? "Menu availability update failed");
        return;
      }
      setMenu((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, available: data.item.available }
            : entry,
        ),
      );
    } catch {
      notify("Menu availability update failed");
    }
  }

  const activeTenant = { name: restaurantName, city: restaurantCity };
  const orderSourceMix = {
    QR: orders.filter((order) => order.source === "QR").length,
    Waiter: orders.filter((order) => order.source === "Waiter").length,
    POS: orders.filter((order) => order.source === "POS").length,
  };
  const pageTitle = view === "Waiter Mode" ? "Captain mode" : view;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={16} />
          </div>
          <div>
            <strong>VISTONA</strong>
            <span>Restaurant OS</span>
          </div>
        </div>
        <div className="restaurant-switch">
          <Store size={16} />
          <div>
            <span>Restaurant</span>
            <strong>{restaurantName}</strong>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav className="nav-list">
          {navItems
            .filter((item) => item.roles.includes(role))
            .map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => setView(item.label)}
                  className={`nav-item ${view === item.label ? "active" : ""}`}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                  {item.label === "Kitchen" && <i className="nav-dot" />}
                </button>
              );
            })}
        </nav>
        <div className="sidebar-bottom">
          <div className="shift-note">
            <span className="live-dot" /> <span>Service is live</span>
          </div>
          <div className="user-chip">
            <div className="avatar">{userName.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{userName}</strong>
              <span>{role}</span>
            </div>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <div className="brand-mark">
              <Sparkles size={14} />
            </div>
            <strong>VISTONA</strong>
          </div>
          <div className="breadcrumb">
            <span>{activeTenant.name.toUpperCase()}</span>
            <b>/</b>
            <strong>{pageTitle.toUpperCase()}</strong>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              onClick={() => notify("No new notifications")}
              aria-label="Notifications"
            >
              <Bell size={18} />
              <i />
            </button>
            <div className="role-select">
              <span>Viewing as</span>
              <strong>{role}</strong>
            </div>
            {role === "Manager" && <a className="icon-button" href="/manager/staff" aria-label="Staff management" title="Staff management"><Users size={17} /></a>}
            <a className="icon-button" href="/account" aria-label="Account settings" title="Account settings"><UserRound size={17} /></a>
            <button className="icon-button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
          </div>
        </header>

        {view === "Dashboard" && (
          <Dashboard
            tables={tables}
            orders={orders}
            tenant={activeTenant}
            orderSourceMix={orderSourceMix}
            onTable={setSelectedTable}
            onOrder={setSelectedOrder}
            onNavigate={setView}
          />
        )}
        {view === "Tables" && (
          <TablesView
            tables={tables}
            canManage={role === "Manager"}
            restaurantSlug={restaurantSlug}
            loading={tablesLoading}
            error={tablesError}
            onTable={setSelectedTable}
            onNavigate={setView}
            onTableChanged={(updated) => {
              setTables((current) => {
                const existing = current.some(
                  (table) => table.databaseId === updated.databaseId,
                );
                return existing
                  ? current.map((table) =>
                      table.databaseId === updated.databaseId ? updated : table,
                    )
                  : [...current, updated];
              });
            }}
          />
        )}
        {view === "Orders" && (
          <OrdersView
            orders={filteredOrders}
            filter={orderFilter}
            setFilter={setOrderFilter}
            sourceFilter={orderSourceFilter}
            setSourceFilter={setOrderSourceFilter}
            showSourceFilter={role === "Manager"}
            title="Service, in one view"
            onOrder={setSelectedOrder}
          />
        )}
        {view === "QR Orders" && (
          <OrdersView
            orders={orders.filter((order) => order.source === "QR")}
            filter={orderFilter}
            setFilter={setOrderFilter}
            sourceFilter="QR"
            setSourceFilter={() => undefined}
            showSourceFilter={false}
            title="QR orders"
            onOrder={setSelectedOrder}
          />
        )}
        {view === "Waiter Mode" &&
          (currentTable ? (
            <WaiterView
              currentTable={currentTable}
              menu={menu}
              orderItems={orderItems}
              total={orderTotal}
              onAdd={addItem}
              onSend={sendToKitchen}
              onNavigate={setView}
            />
          ) : (
            <div className="page">
              <div className="empty-state">
                <Utensils size={20} />
                <p>Select a table to start an order.</p>
                <button
                  className="secondary-button"
                  onClick={() => setView("Tables")}
                >
                  View tables
                </button>
              </div>
            </div>
          ))}
        {view === "Kitchen" && (
          <KitchenView
            orders={orders}
            onUpdate={updateOrder}
            restaurantName={restaurantName}
          />
        )}
        {view === "Menu" && (
          <MenuView
            menu={filteredMenu}
            search={menuSearch}
            category={menuCategory}
            canManage={role === "Manager"}
            setSearch={setMenuSearch}
            setCategory={setMenuCategory}
            onToggle={(item) => void toggleMenuAvailability(item)}
            onStartOrder={() => setView("Tables")}
          />
        )}
        {view === "Customers" && <CustomersView />}
        {view === "Reports" && <ReportsView />}
        {view === "Settings" && <SettingsView />}
      </main>

      {selectedTable && (
        <TablePanel
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
          onStatus={changeTableStatus}
          onNavigate={(next) => {
            setSelectedTable(null);
            setView(next);
          }}
        />
      )}
      {selectedOrder && (
        <OrderPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={updateOrder}
        />
      )}
      {toast && (
        <div className="toast">
          <PackageCheck size={17} /> {toast}
        </div>
      )}
    </div>
  );
}

function Dashboard({
  tables,
  orders,
  tenant,
  orderSourceMix,
  onTable,
  onOrder,
  onNavigate,
}: {
  tables: Table[];
  orders: Order[];
  tenant: Tenant;
  orderSourceMix: Record<OrderSource, number>;
  onTable: (table: Table) => void;
  onOrder: (order: Order) => void;
  onNavigate: (view: View) => void;
}) {
  const activeTables = tables.filter((table) => table.active !== false);
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SERVICE OVERVIEW</span>
          <h1>Restaurant overview</h1>
          <p>Everything happening across your floor, kitchen and orders.</p>
        </div>
        <button
          className="primary-button"
          onClick={() => onNavigate("Waiter Mode")}
        >
          <Plus size={16} /> New order
        </button>
      </div>
      <div className="metrics">
        <Metric
          label="Order value"
          value={money(
            orders.reduce((total, order) => total + order.amount, 0),
          )}
          note="From loaded restaurant orders"
        />
        <Metric
          label="Orders"
          value={String(orders.length)}
          note="Loaded restaurant orders"
        />
        <Metric
          label="Active tables"
          value={String(
            activeTables.filter((table) => table.status !== "Available").length,
          )}
          note={`of ${activeTables.length} active tables`}
        />
        <Metric
          label="Pending orders"
          value={String(
            orders.filter((order) =>
              ["New", "Preparing"].includes(order.status),
            ).length,
          )}
          note="Across floor & kitchen"
        />
      </div>
      <div className="dashboard-grid">
        <section className="section-block table-overview">
          <SectionTitle
            title="Table overview"
            action="View floor"
            onClick={() => onNavigate("Tables")}
          />
          <div className="table-grid">
            {activeTables.slice(0, 8).map((table) => (
              <button
                className={`table-tile ${table.status.toLowerCase()}`}
                key={table.id}
                onClick={() => onTable(table)}
              >
                <div>
                  <strong>{table.id}</strong>
                  <span>{table.seats} seats</span>
                </div>
                <span className={`status-pill ${statusTone[table.status]}`}>
                  {table.status}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="section-block">
          <SectionTitle
            title="Active orders"
            action="View all"
            onClick={() => onNavigate("Orders")}
          />
          <div className="compact-list">
            {orders.slice(0, 3).map((order) => (
              <button
                className="list-row"
                key={order.id}
                onClick={() => onOrder(order)}
              >
                <div className="order-symbol">
                  <ShoppingBag size={16} />
                </div>
                <div className="row-main">
                  <strong>
                    {order.id} <span>{order.table}</span>
                  </strong>
                  <small>
                    {order.items.length} items · {order.time}
                  </small>
                </div>
                <span className={`status-pill ${statusTone[order.status]}`}>
                  {order.status}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="section-block tenant-panel">
          <SectionTitle title="Restaurant" action={tenant.city} />
          <div className="tenant-stack">
            <div className="tenant-row">
              <div>
                <span className="eyebrow">Tenant</span>
                <strong>{tenant.name}</strong>
              </div>
              <span className="tenant-status live">Active</span>
            </div>
            <div className="tenant-meta">
              <span>{tenant.city}</span>
            </div>
            <div className="source-grid">
              {(Object.keys(orderSourceMix) as OrderSource[]).map((key) => (
                <div className="source-pill" key={key}>
                  <span className={`source-badge ${sourceTone[key]}`}>
                    {key}
                  </span>
                  <strong>{orderSourceMix[key]}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function TablesView({
  tables,
  canManage,
  restaurantSlug,
  loading,
  error,
  onTable,
  onNavigate,
  onTableChanged,
}: {
  tables: Table[];
  canManage: boolean;
  restaurantSlug: string;
  loading: boolean;
  error: string;
  onTable: (table: Table) => void;
  onNavigate: (view: View) => void;
  onTableChanged: (table: Table) => void;
}) {
  return (
    <TableManagement
      tables={tables}
      canManage={canManage}
      restaurantSlug={restaurantSlug}
      loading={loading}
      error={error}
      onSelect={onTable}
      onStartOrder={() => onNavigate("Waiter Mode")}
      onTableChanged={onTableChanged}
    />
  );
}

function OrdersView({
  orders,
  filter,
  setFilter,
  sourceFilter,
  setSourceFilter,
  showSourceFilter,
  title,
  onOrder,
}: {
  orders: Order[];
  filter: string;
  setFilter: (value: string) => void;
  sourceFilter: string;
  setSourceFilter: (value: string) => void;
  showSourceFilter: boolean;
  title: string;
  onOrder: (order: Order) => void;
}) {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ORDERS</span>
          <h1>{title}</h1>
          <p>Follow every ticket from the floor to the pass.</p>
        </div>
        <div className="heading-stat">
          <strong>{orders.length}</strong>
          <span>visible tickets</span>
        </div>
      </div>
      <div className="filter-bar">
        {["All", "New", "Preparing", "Ready", "Served", "Completed"].map(
          (item) => (
            <button
              className={filter === item ? "selected" : ""}
              key={item}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ),
        )}
      </div>
      {showSourceFilter && <div className="filter-bar order-source-filters" aria-label="Filter orders by source">
        {["All", "QR", "Waiter", "POS"].map((source) => <button className={sourceFilter === source ? "selected" : ""} key={source} onClick={() => setSourceFilter(source)}>{source}</button>)}
      </div>}
      <div className="orders-table">
        <div className="orders-header">
          <span>Ticket</span>
          <span>Table / waiter</span>
          <span>Items</span>
          <span>Amount</span>
          <span>Status</span>
        </div>
        {orders.map((order) => (
          <button
            className="order-line"
            key={order.id}
            onClick={() => onOrder(order)}
          >
            <strong>
              {order.id}
              <small>{order.time} · {order.source}</small>
            </strong>
            <span>
              {order.table}
              <small>{order.waiter}</small>
            </span>
            <span>
              {order.items.length} items<small>{order.items[0]}</small>
            </span>
            <strong>{money(order.amount)}</strong>
            <span className={`status-pill ${statusTone[order.status]}`}>
              {order.status}
            </span>
          </button>
        ))}
      </div>
      <div className="inline-note">
        <Clock3 size={16} /> Orders update in real time as the kitchen moves
        tickets forward.
      </div>
    </div>
  );
}

function WaiterView({
  currentTable,
  menu,
  orderItems,
  total,
  onAdd,
  onSend,
  onNavigate,
}: {
  currentTable: Table;
  menu: MenuItem[];
  orderItems: Record<string, number>;
  total: number;
  onAdd: (name: string, delta: number) => void;
  onSend: () => void;
  onNavigate: (view: View) => void;
}) {
  const [category, setCategory] = useState("All");
  const categories = ["All", ...new Set(menu.map((item) => item.category))];
  const items = menu.filter(
    (item) => category === "All" || item.category === category,
  );
  const count = Object.values(orderItems).reduce((a, b) => a + b, 0);
  return (
    <div className="page waiter-page">
      <div className="waiter-heading">
        <div>
          <span className="eyebrow">CAPTAIN MODE</span>
          <h1>
            {currentTable.id} <span>· {currentTable.seats} guests</span>
          </h1>
          <p>Build the order beside your guests.</p>
        </div>
        <button
          className="secondary-button"
          onClick={() => onNavigate("Tables")}
        >
          Change table
        </button>
      </div>
      <div className="category-tabs">
        {categories.map((item) => (
          <button
            key={item}
            className={category === item ? "selected" : ""}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="menu-order-grid">
        <div className="waiter-menu-grid">
          {items.map((item) => (
            <div className="food-card" key={item.name}>
              {item.imageUrl ? (
                <Image className="food-art-image" src={item.imageUrl} alt={item.name} width={82} height={98} unoptimized />
              ) : (
                <div className={`food-art ${item.veg ? "veg" : "nonveg"}`}>
                  <Utensils size={22} />
                </div>
              )}
              <div className="food-content">
                <span className="veg-label">
                  {item.veg ? "VEG" : "NON-VEG"}
                </span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <strong>{money(item.price)}</strong>
                {item.available ? (
                  <div className="quantity">
                    <button onClick={() => onAdd(item.name, -1)} disabled={!orderItems[item.name]}>-</button>
                    <b>{orderItems[item.name] ?? 0}</b>
                    <button onClick={() => onAdd(item.name, 1)}>+</button>
                  </div>
                ) : <span className="stock-label out-stock">OUT OF STOCK</span>}
              </div>
            </div>
          ))}
        </div>
        <aside className="order-summary">
          <div>
            <span className="eyebrow">CURRENT ORDER</span>
            <h2>Table {currentTable.id.replace("T", "")}</h2>
          </div>
          <div className="summary-items">
            {Object.entries(orderItems)
              .filter(([, quantity]) => quantity > 0)
              .map(([name, quantity]) => (
                <div key={name}>
                  <span>
                    {name} <b>x{quantity}</b>
                  </span>
                  <strong>
                    {money(
                      (menu.find((item) => item.name === name)?.price ?? 0) *
                        quantity,
                    )}
                  </strong>
                </div>
              ))}
          </div>
          <div className="summary-total">
            <span>{count} items</span>
            <strong>{money(total)}</strong>
          </div>
          <div className="order-origin">
            <span className="eyebrow">ORDER SOURCE</span>
            <strong>Manual waiter entry</strong>
            <small>QR ordering is also enabled for table-side checkout.</small>
          </div>
          <button className="primary-button full" onClick={onSend}>
            <ChefHat size={16} /> Send to kitchen
          </button>
          <button
            className="secondary-button full"
            onClick={() => alert("Order preview opened")}
          >
            View full order
          </button>
        </aside>
      </div>
    </div>
  );
}

function KitchenView({
  orders,
  onUpdate,
  restaurantName,
}: {
  orders: Order[];
  onUpdate: (id: string, status: OrderStatus) => void;
  restaurantName: string;
}) {
  const columns: OrderStatus[] = ["New", "Preparing", "Ready"];
  return (
    <div className="kitchen-page">
      <div className="kitchen-header">
        <div>
          <span className="eyebrow">KITCHEN DISPLAY</span>
          <h1>Keep the pass moving.</h1>
        </div>
        <div className="kitchen-live">
          <span className="live-dot" /> {restaurantName || "Kitchen display"} <b>·</b>{" "}
          {new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
      <div className="kitchen-board">
        {columns.map((column) => (
          <section className="kitchen-column" key={column}>
            <div className="column-title">
              <span className={`kitchen-marker ${column.toLowerCase()}`} />
              <h2>{column}</h2>
              <b>{orders.filter((order) => order.status === column).length}</b>
            </div>
            {orders
              .filter((order) => order.status === column)
              .map((order) => (
                <div className="ticket" key={order.id}>
                  <div className="ticket-head">
                    <strong>{order.id}</strong>
                    <span>{order.table}</span>
                  </div>
                  <p>{order.time} · <span className={`source-badge ${sourceTone[order.source]}`}>{order.source} ORDER</span></p>
                  <ul>
                    {order.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {column === "New" && (
                    <button
                      className="kitchen-button preparing"
                      onClick={() => onUpdate(order.id, "Preparing")}
                    >
                      Start <ChevronDown size={15} />
                    </button>
                  )}
                  {column === "Preparing" && (
                    <button
                      className="kitchen-button ready"
                      onClick={() => onUpdate(order.id, "Ready")}
                    >
                      Mark ready <PackageCheck size={15} />
                    </button>
                  )}
                </div>
              ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function MenuView({
  menu,
  search,
  category,
  canManage,
  setSearch,
  setCategory,
  onToggle,
  onStartOrder,
}: {
  menu: MenuItem[];
  search: string;
  category: string;
  canManage: boolean;
  setSearch: (value: string) => void;
  setCategory: (value: string) => void;
  onToggle: (item: MenuItem) => void;
  onStartOrder: () => void;
}) {
  const categories = ["All", ...new Set(menu.map((item) => item.category))];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MENU</span>
          <h1>A menu that stays current.</h1>
          <p>Keep availability and pricing clear for every service.</p>
        </div>
        {canManage ? (
          <a className="primary-button" href="/manager/menu">
            <Plus size={16} /> Manage menu
          </a>
        ) : (
          <button className="primary-button" onClick={onStartOrder}>
            <Plus size={16} /> Choose a table
          </button>
        )}
      </div>
      <div className="menu-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search menu..."
          />
        </div>
        <div className="filter-bar">
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
      </div>
      <div className="menu-list">
        {menu.map((item) => (
          <div className="menu-row" key={item.name}>
            {item.imageUrl ? (
              <Image className="menu-thumb-image" src={item.imageUrl} alt="" width={42} height={42} unoptimized />
            ) : (
              <div className="menu-thumb">
                <Utensils size={18} />
              </div>
            )}
            <div className="menu-name">
              <strong>{item.name}</strong>
              <span>{item.description}</span>
            </div>
            <span className="menu-category">{item.category}</span>
            <span className={item.veg ? "veg-label" : "nonveg-label"}>
              {item.veg ? "VEG" : "NON-VEG"}
            </span>
            <strong>{money(item.price)}</strong>
            {canManage ? (
              <button
                className={`availability ${item.available ? "on" : "off"}`}
                onClick={() => onToggle(item)}
              >
                <span /> {item.available ? "In stock" : "Out of stock"}
              </button>
            ) : (
              <span className={`availability ${item.available ? "on" : "off"}`}>
                <span /> {item.available ? "In stock" : "Out of stock"}
              </span>
            )}
            {canManage && <a className="icon-button subtle" href="/manager/menu" aria-label={`Edit ${item.name}`}><Pencil size={17} /></a>}
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomersView() {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CUSTOMERS</span>
          <h1>Know who comes back.</h1>
          <p>A simple view of regulars and their preferences.</p>
        </div>
        <button className="secondary-button">
          <Search size={16} /> Find customer
        </button>
      </div>
      <div className="customer-grid">
        {[
          {
            name: "Amit Sharma",
            phone: "+91 98765 43210",
            visits: 8,
            spend: "₹12,450",
            favorite: "Butter Chicken",
            last: "Today, 1:42 PM",
          },
          {
            name: "Priya Menon",
            phone: "+91 98111 82021",
            visits: 12,
            spend: "₹18,920",
            favorite: "Paneer Tikka",
            last: "Yesterday",
          },
          {
            name: "Rohan Kapoor",
            phone: "+91 99004 22091",
            visits: 5,
            spend: "₹7,640",
            favorite: "Garlic Naan",
            last: "12 Sep 2026",
          },
        ].map((customer) => (
          <div className="customer-card" key={customer.name}>
            <div className="customer-head">
              <div className="avatar large">{customer.name.charAt(0)}</div>
              <div>
                <h3>{customer.name}</h3>
                <span>{customer.phone}</span>
              </div>
              <MoreHorizontal size={17} />
            </div>
            <div className="customer-stats">
              <div>
                <strong>{customer.visits}</strong>
                <span>visits</span>
              </div>
              <div>
                <strong>{customer.spend}</strong>
                <span>spent</span>
              </div>
            </div>
            <div className="customer-foot">
              <span>
                Favourite: <b>{customer.favorite}</b>
              </span>
              <small>{customer.last}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsView() {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">REPORTS · SEPTEMBER 16, 2026</span>
          <h1>Read the rhythm of service.</h1>
          <p>Useful signals for today, without the noise.</p>
        </div>
        <button className="secondary-button">
          This week <ChevronDown size={15} />
        </button>
      </div>
      <div className="metrics">
        <Metric label="Today's sales" value="₹42,850" note="Target ₹50,000" />
        <Metric
          label="Average order"
          value="₹630"
          note="+₹48 this week"
          positive
        />
        <Metric label="Orders served" value="68" note="Across 42 tables" />
      </div>
      <div className="report-grid">
        <section className="report-card">
          <SectionTitle title="Sales by hour" action="Today" />
          <div className="bars">
            {[28, 36, 44, 31, 52, 68, 84, 71, 93, 78, 62, 48].map(
              (height, index) => (
                <div className="bar-wrap" key={index}>
                  <div className="bar" style={{ height: `${height}%` }} />
                  <span>
                    {index + 11 > 12 ? `${index - 1}p` : `${index + 11}a`}
                  </span>
                </div>
              ),
            )}
          </div>
        </section>
        <section className="report-card">
          <SectionTitle title="Top selling items" action="This week" />
          <div className="ranking">
            {[
              ["Butter Naan", "41", "₹2,460"],
              ["Butter Chicken", "24", "₹7,680"],
              ["Dal Makhani", "19", "₹4,180"],
              ["Paneer Tikka", "17", "₹3,740"],
            ].map(([name, count, total], index) => (
              <div className="rank-row" key={name}>
                <span>0{index + 1}</span>
                <strong>{name}</strong>
                <small>{count} sold</small>
                <b>{total}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingsView() {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SETTINGS</span>
          <h1>Make the system yours.</h1>
          <p>Restaurant details and service preferences.</p>
        </div>
      </div>
      <div className="settings-list">
        {[
          [
            "Restaurant information",
            "Anndham Family Dhaba · Jaipur, Rajasthan",
            Store,
          ],
          ["Tables & floor", "12 tables · 52 total seats", Grid2X2],
          ["Tax / GST", "5% restaurant GST enabled", CircleDollarSign],
          ["Staff & roles", "8 active staff members", Users],
          ["Notifications", "Sound alerts enabled for kitchen", Bell],
        ].map(([title, detail, Icon]) => {
          const ItemIcon = Icon as typeof Store;
          return (
            <button className="setting-row" key={title as string}>
              <div className="setting-icon">
                <ItemIcon size={18} />
              </div>
              <div>
                <strong>{title as string}</strong>
                <span>{detail as string}</span>
              </div>
              <ChevronDown size={17} />
            </button>
          );
        })}
      </div>
      <div className="rbac-panel">
        <div className="section-title">
          <h2>Role-based access</h2>
          <button>Tenant RBAC</button>
        </div>
        <div className="rbac-grid">
          {[
            { role: "Owner", access: "Tenant billing, staff, menu, reports" },
            { role: "Manager", access: "Floor overview, orders, settings" },
            { role: "Waiter", access: "Tables, order capture, QR order flow" },
            { role: "Kitchen", access: "KOT queue, prep and ready states" },
          ].map((row) => (
            <div className="rbac-row" key={row.role}>
              <strong>{row.role}</strong>
              <span>{row.access}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TablePanel({
  table,
  onClose,
  onStatus,
  onNavigate,
}: {
  table: Table;
  onClose: () => void;
  onStatus: (status: Status) => void;
  onNavigate: (view: View) => void;
}) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className="eyebrow">TABLE DETAILS</span>
            <h2>{table.id}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close table details"
          >
            <X size={18} />
          </button>
        </div>
        <div className="drawer-intro">
          <span className={`status-pill ${statusTone[table.status]}`}>
            {table.status}
          </span>
          <p>
            {table.seats} guests ·{" "}
            {table.waiter === "-"
              ? "No waiter assigned"
              : `Waiter ${table.waiter}`}
          </p>
        </div>
        <div className="drawer-section">
          <span className="eyebrow">CURRENT ORDER</span>
          {table.order ? (
            <>
              <div className="drawer-order">
                <strong>{table.order}</strong>
                <span>4 items · {table.elapsed}</span>
                <b>₹880</b>
              </div>
              <div className="drawer-order-line">
                <span>Paneer Tikka</span>
                <b>₹220</b>
              </div>
              <div className="drawer-order-line">
                <span>Butter Chicken</span>
                <b>₹320</b>
              </div>
              <div className="drawer-order-line">
                <span>Butter Naan × 4</span>
                <b>₹240</b>
              </div>
              <div className="drawer-total">
                <span>Total incl. GST</span>
                <strong>₹924</strong>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Utensils size={20} />
              <p>No active order yet.</p>
            </div>
          )}
        </div>
        <div className="drawer-section">
          <span className="eyebrow">QUICK ACTIONS</span>
          <div className="drawer-actions">
            <button
              className="primary-button"
              onClick={() => onNavigate("Waiter Mode")}
            >
              <Plus size={15} /> Add item
            </button>
            <button
              className="secondary-button"
              onClick={() => onStatus("Billing")}
            >
              <CircleDollarSign size={15} /> Request bill
            </button>
            {table.status !== "Available" && (
              <button
                className="secondary-button"
                onClick={() => onStatus("Available")}
              >
                <PackageCheck size={15} /> Mark available
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function OrderPanel({
  order,
  onClose,
  onUpdate,
}: {
  order: Order;
  onClose: () => void;
  onUpdate: (id: string, status: OrderStatus) => void;
}) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className="eyebrow">ORDER DETAILS</span>
            <h2>{order.id}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close order details"
          >
            <X size={18} />
          </button>
        </div>
        <div className="drawer-intro">
          <span className={`status-pill ${statusTone[order.status]}`}>
            {order.status}
          </span>
          <p>
            {order.table} · {order.waiter} · {order.time}
          </p>
        </div>
        <div className="drawer-section">
          <span className="eyebrow">ITEMS</span>
          {order.items.map((item) => (
            <div className="drawer-order-line" key={item}>
              <span>{item}</span>
            </div>
          ))}
          <div className="drawer-order-line source-row">
            <span>Source</span>
            <span className={`source-badge ${sourceTone[order.source]}`}>
              {order.source}
            </span>
          </div>
          <div className="drawer-total">
            <span>Total</span>
            <strong>{money(order.amount)}</strong>
          </div>
        </div>
        <div className="drawer-section">
          <span className="eyebrow">MOVE TICKET</span>
          <div className="drawer-actions">
            {order.status === "New" && (
              <button
                className="primary-button"
                onClick={() => {
                  onUpdate(order.id, "Preparing");
                  onClose();
                }}
              >
                Start preparing
              </button>
            )}
            {order.status === "Preparing" && (
              <button
                className="primary-button"
                onClick={() => {
                  onUpdate(order.id, "Ready");
                  onClose();
                }}
              >
                Mark ready
              </button>
            )}
            {order.status === "Ready" && (
              <button
                className="primary-button"
                onClick={() => {
                  onUpdate(order.id, "Served");
                  onClose();
                }}
              >
                Mark served
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  positive,
}: {
  label: string;
  value: string;
  note: string;
  positive?: boolean;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={positive ? "positive" : ""}>
        {positive && "↗ "}
        {note}
      </small>
    </div>
  );
}
function SectionTitle({
  title,
  action,
  onClick,
}: {
  title: string;
  action: string;
  onClick?: () => void;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      <button onClick={onClick}>
        {action} <span>→</span>
      </button>
    </div>
  );
}
