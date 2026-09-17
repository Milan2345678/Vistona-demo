"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  ChefHat,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Grid2X2,
  LayoutDashboard,
  Menu as MenuIcon,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  Utensils,
  X,
} from "lucide-react";

type Role = "Manager" | "Waiter" | "Kitchen";
type Status = "Available" | "Ordering" | "Preparing" | "Served" | "Billing";
type OrderStatus = "New" | "Preparing" | "Ready" | "Served" | "Completed";
type View =
  | "Dashboard"
  | "Tables"
  | "Orders"
  | "Waiter Mode"
  | "Kitchen"
  | "Menu"
  | "Customers"
  | "Reports"
  | "Settings";

type Table = {
  id: string;
  seats: number;
  status: Status;
  order: string | null;
  waiter: string;
  elapsed: string;
};
type Order = {
  id: string;
  table: string;
  waiter: string;
  items: string[];
  amount: number;
  status: OrderStatus;
  time: string;
};
type MenuItem = {
  name: string;
  description: string;
  category: string;
  price: number;
  veg: boolean;
  available: boolean;
};
type Request = { id: number; table: string; title: string; time: string };

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

const initialOrders: Order[] = [
  {
    id: "#1042",
    table: "T03",
    waiter: "Rahul",
    items: ["Paneer Tikka x1", "Butter Chicken x1", "Butter Naan x4"],
    amount: 880,
    status: "Preparing",
    time: "12 min ago",
  },
  {
    id: "#1041",
    table: "T02",
    waiter: "Meera",
    items: ["Dal Makhani x1", "Garlic Naan x2"],
    amount: 540,
    status: "Ready",
    time: "8 min ago",
  },
  {
    id: "#1040",
    table: "T07",
    waiter: "Asha",
    items: ["Tandoori Chicken x1", "Jeera Rice x1"],
    amount: 760,
    status: "New",
    time: "16 min ago",
  },
  {
    id: "#1039",
    table: "T05",
    waiter: "Meera",
    items: ["Kadhai Paneer x1", "Plain Rice x1"],
    amount: 480,
    status: "Served",
    time: "22 min ago",
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
    { label: "Waiter Mode", icon: Utensils, roles: ["Manager", "Waiter"] },
    { label: "Kitchen", icon: ChefHat, roles: ["Manager", "Kitchen"] },
    { label: "Menu", icon: MenuIcon, roles: ["Manager"] },
    { label: "Customers", icon: Users, roles: ["Manager", "Waiter"] },
    { label: "Reports", icon: CircleDollarSign, roles: ["Manager"] },
    { label: "Settings", icon: Settings, roles: ["Manager"] },
  ];

const statusTone: Record<string, string> = {
  Available: "status-available",
  Ordering: "status-ordering",
  Preparing: "status-preparing",
  Served: "status-served",
  Billing: "status-billing",
  New: "status-new",
  Ready: "status-ready",
  Completed: "status-served",
};
const money = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

export default function Home() {
  const [signedIn, setSignedIn] = useState(false);
  const [role, setRole] = useState<Role>("Manager");
  const [view, setView] = useState<View>("Dashboard");
  const [tables, setTables] = useState(initialTables);
  const [orders, setOrders] = useState(initialOrders);
  const [menu, setMenu] = useState(menuSeed);
  const [requests, setRequests] = useState<Request[]>([
    { id: 1, table: "T07", title: "Bring Bill", time: "2 min ago" },
    { id: 2, table: "T03", title: "Need Water", time: "1 min ago" },
    { id: 3, table: "T11", title: "Call Waiter", time: "Just now" },
  ]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [toast, setToast] = useState("");
  const [orderItems, setOrderItems] = useState<Record<string, number>>({
    "Paneer Tikka": 1,
    "Butter Chicken": 1,
    "Butter Naan": 4,
  });
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategory, setMenuCategory] = useState("All");
  const [orderFilter, setOrderFilter] = useState("All");

  if (!signedIn)
    return (
      <LoginScreen
        onSignIn={(nextRole) => {
          setRole(nextRole);
          setSignedIn(true);
          setView(
            nextRole === "Kitchen"
              ? "Kitchen"
              : nextRole === "Waiter"
                ? "Tables"
                : "Dashboard",
          );
        }}
      />
    );

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };
  const activeOrderCount = orders.filter(
    (order) => !["Completed", "Served"].includes(order.status),
  ).length;
  const currentTable = tables.find((table) => table.id === "T03")!;
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
    (order) => orderFilter === "All" || order.status === orderFilter,
  );

  function updateOrder(id: string, status: OrderStatus) {
    setOrders((current) =>
      current.map((order) => (order.id === id ? { ...order, status } : order)),
    );
    const order = orders.find((item) => item.id === id);
    if (order)
      setTables((current) =>
        current.map((table) =>
          table.id === order.table
            ? {
                ...table,
                status:
                  status === "Ready"
                    ? "Served"
                    : status === "Served"
                      ? "Available"
                      : "Preparing",
              }
            : table,
        ),
      );
    notify(`${id} marked ${status.toLowerCase()}`);
  }

  function sendToKitchen() {
    const target = orders.find((order) => order.id === "#1042");
    if (target) updateOrder(target.id, "Preparing");
    setView("Kitchen");
    notify("KOT sent to kitchen");
  }

  function addItem(name: string, delta: number) {
    setOrderItems((current) => ({
      ...current,
      [name]: Math.max(0, (current[name] ?? 0) + delta),
    }));
  }

  function changeTableStatus(status: Status) {
    if (!selectedTable) return;
    setTables((current) =>
      current.map((table) =>
        table.id === selectedTable.id ? { ...table, status } : table,
      ),
    );
    setSelectedTable((table) => (table ? { ...table, status } : table));
    notify(`${selectedTable.id} is now ${status.toLowerCase()}`);
  }

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
            <strong>Anndham Family Dhaba</strong>
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
            <div className="avatar">M</div>
            <div>
              <strong>Milan Rao</strong>
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
            <span>ANNDHAM FAMILY DHABA</span>
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
              <select
                value={role}
                onChange={(event) => {
                  const nextRole = event.target.value as Role;
                  setRole(nextRole);
                  setView(
                    nextRole === "Kitchen"
                      ? "Kitchen"
                      : nextRole === "Waiter"
                        ? "Tables"
                        : "Dashboard",
                  );
                }}
              >
                <option>Manager</option>
                <option>Waiter</option>
                <option>Kitchen</option>
              </select>
            </div>
          </div>
        </header>

        {view === "Dashboard" && (
          <Dashboard
            tables={tables}
            orders={orders}
            requests={requests}
            onTable={setSelectedTable}
            onOrder={setSelectedOrder}
            onResolve={(id) => {
              setRequests((current) =>
                current.filter((request) => request.id !== id),
              );
              notify("Request resolved");
            }}
            onNavigate={setView}
          />
        )}
        {view === "Tables" && (
          <TablesView
            tables={tables}
            onTable={setSelectedTable}
            onNavigate={setView}
          />
        )}
        {view === "Orders" && (
          <OrdersView
            orders={filteredOrders}
            filter={orderFilter}
            setFilter={setOrderFilter}
            onOrder={setSelectedOrder}
            onUpdate={updateOrder}
          />
        )}
        {view === "Waiter Mode" && (
          <WaiterView
            currentTable={currentTable}
            menu={menu}
            orderItems={orderItems}
            total={orderTotal}
            onAdd={addItem}
            onSend={sendToKitchen}
            onNavigate={setView}
          />
        )}
        {view === "Kitchen" && (
          <KitchenView orders={orders} onUpdate={updateOrder} />
        )}
        {view === "Menu" && (
          <MenuView
            menu={filteredMenu}
            search={menuSearch}
            category={menuCategory}
            setSearch={setMenuSearch}
            setCategory={setMenuCategory}
            onToggle={(name) => {
              setMenu((current) =>
                current.map((item) =>
                  item.name === name
                    ? { ...item, available: !item.available }
                    : item,
                ),
              );
              notify("Menu availability updated");
            }}
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
  requests,
  onTable,
  onOrder,
  onResolve,
  onNavigate,
}: {
  tables: Table[];
  orders: Order[];
  requests: Request[];
  onTable: (table: Table) => void;
  onOrder: (order: Order) => void;
  onResolve: (id: number) => void;
  onNavigate: (view: View) => void;
}) {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">GOOD EVENING, MILAN</span>
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
          label="Today's sales"
          value="₹42,850"
          note="+12.4% vs yesterday"
          positive
        />
        <Metric
          label="Orders"
          value={String(orders.length + 64)}
          note="8 orders in service"
        />
        <Metric
          label="Active tables"
          value={String(
            tables.filter((table) => table.status !== "Available").length,
          )}
          note="of 12 tables"
        />
        <Metric
          label="Pending orders"
          value={String(
            orders.filter((order) =>
              ["New", "Preparing"].includes(order.status),
            ).length + 5,
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
            {tables.slice(0, 8).map((table) => (
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
        <section className="section-block requests">
          <SectionTitle
            title="Staff requests"
            action={`${requests.length} open`}
          />
          <div className="compact-list">
            {requests.map((request) => (
              <div className="list-row" key={request.id}>
                <div className="request-symbol">
                  <Bell size={16} />
                </div>
                <div className="row-main">
                  <strong>
                    {request.table} <span>{request.title}</span>
                  </strong>
                  <small>{request.time}</small>
                </div>
                <button
                  className="text-button"
                  onClick={() => onResolve(request.id)}
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function LoginScreen({ onSignIn }: { onSignIn: (role: Role) => void }) {
  const [email, setEmail] = useState("milan@vistona.global");
  const [password, setPassword] = useState("demo123");
  return (
    <main className="login-page">
      <div className="login-brand">
        <div className="brand-mark">
          <Sparkles size={16} />
        </div>
        <strong>VISTONA</strong>
        <span>Restaurant OS</span>
      </div>
      <div className="login-wrap">
        <div className="login-copy">
          <span className="eyebrow">RESTAURANT MANAGEMENT</span>
          <h1>
            Run service
            <br />
            with less friction.
          </h1>
          <p>One calm workspace for your floor, kitchen and team.</p>
          <div className="login-line">
            <span /> <span>Anndham Family Dhaba · Jaipur</span>
          </div>
        </div>
        <section className="login-card">
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Sign in to Vistona</h2>
          <p>Use a demo profile to explore the operating system.</p>
          <label>
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            className="primary-button full"
            onClick={() => onSignIn("Manager")}
          >
            Sign in <ChevronDown size={15} />
          </button>
          <div className="demo-divider">
            <span>DEMO ACCESS</span>
          </div>
          <div className="demo-roles">
            <button onClick={() => onSignIn("Manager")}>
              <strong>Manager</strong>
              <span>Full restaurant access</span>
            </button>
            <button onClick={() => onSignIn("Waiter")}>
              <strong>Waiter</strong>
              <span>Tables and captain mode</span>
            </button>
            <button onClick={() => onSignIn("Kitchen")}>
              <strong>Kitchen</strong>
              <span>Live ticket display</span>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function TablesView({
  tables,
  onTable,
  onNavigate,
}: {
  tables: Table[];
  onTable: (table: Table) => void;
  onNavigate: (view: View) => void;
}) {
  const [filter, setFilter] = useState("All");
  const filtered = tables.filter(
    (table) => filter === "All" || table.status === filter,
  );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TABLES</span>
          <h1>Floor overview</h1>
          <p>See every table at a glance.</p>
        </div>
        <button
          className="primary-button"
          onClick={() => onNavigate("Waiter Mode")}
        >
          <Plus size={16} /> Start order
        </button>
      </div>
      <div className="filter-bar">
        {["All", "Available", "Ordering", "Preparing", "Served", "Billing"].map(
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
      <div className="floor-grid">
        {filtered.map((table) => (
          <button
            className={`floor-card ${table.status.toLowerCase()}`}
            key={table.id}
            onClick={() => onTable(table)}
          >
            <div className="floor-card-top">
              <div>
                <span className="eyebrow">TABLE</span>
                <h2>{table.id}</h2>
              </div>
              <span className={`status-pill ${statusTone[table.status]}`}>
                {table.status}
              </span>
            </div>
            <div className="floor-meta">
              <span>{table.seats} seats</span>
              {table.order && <span>{table.order}</span>}
            </div>
            <div className="floor-footer">
              <span>
                {table.waiter === "-"
                  ? "Ready for guests"
                  : `Waiter: ${table.waiter}`}
              </span>
              <span>{table.elapsed || "Available"}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function OrdersView({
  orders,
  filter,
  setFilter,
  onOrder,
  onUpdate,
}: {
  orders: Order[];
  filter: string;
  setFilter: (value: string) => void;
  onOrder: (order: Order) => void;
  onUpdate: (id: string, status: OrderStatus) => void;
}) {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ORDERS</span>
          <h1>Service, in one view</h1>
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
              <small>{order.time}</small>
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
  const [category, setCategory] = useState("Starters");
  const categories = [
    "Starters",
    "Main Course",
    "Breads",
    "Drinks",
    "Desserts",
  ];
  const items = menu.filter(
    (item) => item.category === category && item.available,
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
              <div className={`food-art ${item.veg ? "veg" : "nonveg"}`}>
                <Utensils size={22} />
              </div>
              <div className="food-content">
                <span className="veg-label">
                  {item.veg ? "VEG" : "NON-VEG"}
                </span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <strong>{money(item.price)}</strong>
                <div className="quantity">
                  <button onClick={() => onAdd(item.name, -1)}>-</button>
                  <b>{orderItems[item.name] ?? 0}</b>
                  <button onClick={() => onAdd(item.name, 1)}>+</button>
                </div>
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
}: {
  orders: Order[];
  onUpdate: (id: string, status: OrderStatus) => void;
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
          <span className="live-dot" /> Anndham Family Dhaba <b>·</b>{" "}
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
                  <p>{order.time}</p>
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
                  {column === "Ready" && (
                    <button
                      className="kitchen-button served"
                      onClick={() => onUpdate(order.id, "Served")}
                    >
                      Served <PackageCheck size={15} />
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
  setSearch,
  setCategory,
  onToggle,
}: {
  menu: MenuItem[];
  search: string;
  category: string;
  setSearch: (value: string) => void;
  setCategory: (value: string) => void;
  onToggle: (name: string) => void;
}) {
  const categories = [
    "All",
    "Starters",
    "Main Course",
    "Breads",
    "Drinks",
    "Desserts",
  ];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MENU</span>
          <h1>A menu that stays current.</h1>
          <p>Keep availability and pricing clear for every service.</p>
        </div>
        <button
          className="primary-button"
          onClick={() => alert("Add item form opened")}
        >
          <Plus size={16} /> Add item
        </button>
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
            <div className="menu-thumb">
              <Utensils size={18} />
            </div>
            <div className="menu-name">
              <strong>{item.name}</strong>
              <span>{item.description}</span>
            </div>
            <span className="menu-category">{item.category}</span>
            <span className={item.veg ? "veg-label" : "nonveg-label"}>
              {item.veg ? "VEG" : "NON-VEG"}
            </span>
            <strong>{money(item.price)}</strong>
            <button
              className={`availability ${item.available ? "on" : "off"}`}
              onClick={() => onToggle(item.name)}
            >
              <span /> {item.available ? "Available" : "Unavailable"}
            </button>
            <button
              className="icon-button subtle"
              aria-label={`More options for ${item.name}`}
            >
              <MoreHorizontal size={17} />
            </button>
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
            <button
              className="secondary-button"
              onClick={() =>
                onStatus(table.status === "Served" ? "Available" : "Served")
              }
            >
              <PackageCheck size={15} /> Mark{" "}
              {table.status === "Served" ? "available" : "served"}
            </button>
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
