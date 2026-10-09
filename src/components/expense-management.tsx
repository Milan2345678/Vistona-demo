"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_METHOD_LABELS,
  type ExpenseCategory,
  type ExpensePaymentMethod,
} from "@/lib/expenses";

type Expense = {
  id: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  expenseDate: string;
  paymentMethod: ExpensePaymentMethod;
  createdAt: string;
  createdBy: string;
};

type ExpenseData = {
  expenses: Expense[];
  summary: {
    count: number;
    total: number;
    todayTotal: number;
    monthTotal: number;
  };
  daily: { date: string; total: number }[];
  monthly: { month: string; total: number }[];
};

type ExpenseForm = {
  amount: string;
  category: ExpenseCategory;
  description: string;
  expenseDate: string;
  paymentMethod: ExpensePaymentMethod;
};

function localDateValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function newExpenseForm(): ExpenseForm {
  return {
    amount: "",
    category: "FOOD_RAW_MATERIALS",
    description: "",
    expenseDate: localDateValue(),
    paymentMethod: "CASH",
  };
}

function money(value: number) {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMonth(value: string) {
  return new Date(`${value}-01T12:00:00`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

async function fetchExpenses(
  from: string,
  to: string,
  category: ExpenseCategory | "ALL",
): Promise<ExpenseData> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (category !== "ALL") params.set("category", category);
  const response = await fetch(`/api/expenses?${params.toString()}`, {
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error ?? "Expenses could not be loaded");
  return body as ExpenseData;
}

export default function ExpenseManagement() {
  const [data, setData] = useState<ExpenseData>({
    expenses: [],
    summary: { count: 0, total: 0, todayTotal: 0, monthTotal: 0 },
    daily: [],
    monthly: [],
  });
  const [form, setForm] = useState<ExpenseForm>(newExpenseForm);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchExpenses(from, to, category));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Expenses could not be loaded",
      );
    } finally {
      setLoading(false);
    }
  }, [category, from, to]);

  useEffect(() => {
    let active = true;
    fetchExpenses(from, to, category)
      .then((result) => {
        if (!active) return;
        setError("");
        setData(result);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Expenses could not be loaded",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category, from, to]);

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Expense could not be saved");
      setForm(newExpenseForm());
      setNotice("Expense added to history.");
      await loadExpenses();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Expense could not be saved",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page manager-expenses-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MANAGER WORKSPACE</span>
          <h1>Expenses</h1>
          <p>Record restaurant costs and review spending over time.</p>
        </div>
        <a className="secondary-button" href="/manager/dashboard">
          Back to dashboard
        </a>
      </div>

      {error && (
        <div className="table-error" role="alert">
          <strong>Expense request failed.</strong>
          <span>{error}</span>
          {!loading && (
            <button className="secondary-button" onClick={() => void loadExpenses()}>
              Try again
            </button>
          )}
        </div>
      )}
      {notice && (
        <p className="menu-notice" role="status">
          {notice}
        </p>
      )}

      <section className="expense-summary" aria-label="Expense summary">
        <article className="expense-summary-card">
          <span>Filtered total</span>
          <strong>{money(data.summary.total)}</strong>
          <small>{data.summary.count} matching expenses</small>
        </article>
        <article className="expense-summary-card">
          <span>Today</span>
          <strong>{money(data.summary.todayTotal)}</strong>
          <small>Restaurant-local date</small>
        </article>
        <article className="expense-summary-card">
          <span>This month</span>
          <strong>{money(data.summary.monthTotal)}</strong>
          <small>Restaurant-local month</small>
        </article>
      </section>

      <section className="expense-layout">
        <form className="expense-form" onSubmit={addExpense}>
          <div>
            <span className="eyebrow">NEW RECORD</span>
            <h2>Add expense</h2>
          </div>
          <label>
            Amount
            <span className="expense-amount-input">
              <span>₹</span>
              <input
                type="number"
                min="0.01"
                max="10000000"
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                required
              />
            </span>
          </label>
          <label>
            Category
            <select
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value as ExpenseCategory,
                }))
              }
            >
              {EXPENSE_CATEGORIES.map((item) => (
                <option value={item} key={item}>
                  {EXPENSE_CATEGORY_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Expense date
            <input
              type="date"
              value={form.expenseDate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  expenseDate: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            Payment method
            <select
              value={form.paymentMethod}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  paymentMethod: event.target.value as ExpensePaymentMethod,
                }))
              }
            >
              {EXPENSE_PAYMENT_METHODS.map((item) => (
                <option value={item} key={item}>
                  {EXPENSE_PAYMENT_METHOD_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Description / notes
            <textarea
              value={form.description}
              maxLength={1000}
              rows={3}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="What was this expense for?"
            />
          </label>
          <p className="expense-created-by">
            Created by your signed-in manager account.
          </p>
          <button className="primary-button" disabled={saving}>
            {saving ? "Saving expense…" : "Add expense"}
          </button>
        </form>

        <div className="expense-history">
          <div className="expense-history-heading">
            <div>
              <span className="eyebrow">SPENDING</span>
              <h2>Expense history</h2>
            </div>
            <span className="expense-history-limit">Latest 500 records</span>
          </div>
          <div className="expense-filters">
            <label>
              From
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
            <label>
              Category
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as ExpenseCategory | "ALL")
                }
              >
                <option value="ALL">All categories</option>
                {EXPENSE_CATEGORIES.map((item) => (
                  <option value={item} key={item}>
                    {EXPENSE_CATEGORY_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {loading ? (
            <p className="expense-empty" role="status">
              Loading expenses…
            </p>
          ) : !data.expenses.length ? (
            <p className="expense-empty">No expenses match these filters.</p>
          ) : (
            <div className="expense-table-wrap">
              <table className="expense-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Expense</th>
                    <th>Payment</th>
                    <th>Created by</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>{formatDate(expense.expenseDate)}</td>
                      <td>
                        <strong>
                          {EXPENSE_CATEGORY_LABELS[expense.category]}
                        </strong>
                        <small>
                          {expense.description || "No notes"}
                        </small>
                      </td>
                      <td>
                        {EXPENSE_PAYMENT_METHOD_LABELS[expense.paymentMethod]}
                      </td>
                      <td>{expense.createdBy}</td>
                      <td className="expense-table-amount">
                        {money(expense.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="expense-trends">
            <section>
              <h3>Daily expenses</h3>
              {data.daily.length ? (
                <ul>
                  {data.daily.map((item) => (
                    <li key={item.date}>
                      <span>{formatDate(item.date)}</span>
                      <strong>{money(item.total)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No daily totals for this filter.</p>
              )}
            </section>
            <section>
              <h3>Monthly expenses</h3>
              {data.monthly.length ? (
                <ul>
                  {data.monthly.map((item) => (
                    <li key={item.month}>
                      <span>{formatMonth(item.month)}</span>
                      <strong>{money(item.total)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No monthly totals for this filter.</p>
              )}
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
