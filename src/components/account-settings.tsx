"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Account = {
  name: string;
  email: string;
  role: "MANAGER" | "WAITER" | "KITCHEN";
  active: boolean;
  restaurantName: string;
};

export default function AccountSettings() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/account")
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }
        if (!response.ok)
          throw new Error(body.error ?? "Account could not be loaded");
        return body.account as Account;
      })
      .then((result) => {
        if (mounted && result) {
          setAccount(result);
          setName(result.name);
        }
      })
      .catch((cause) => {
        if (mounted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Account could not be loaded",
          );
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Name could not be updated");
      setAccount((current) =>
        current ? { ...current, ...body.account } : current,
      );
      setMessage("Name updated");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Name could not be updated",
      );
    } finally {
      setPending(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Password could not be changed");
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Password could not be changed",
      );
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (!account)
    return (
      <main className="page">
        <p>{error || "Loading account..."}</p>
      </main>
    );

  return (
    <main className="page account-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h1>Account settings</h1>
          <p>Update your profile and sign-in credentials.</p>
        </div>
        {account.role === "MANAGER" && (
          <a className="secondary-button" href="/manager/staff">
            Manage staff
          </a>
        )}
      </div>
      <div className="account-grid">
        <section className="section-block">
          <h2>Profile</h2>
          <dl className="account-details">
            <div>
              <dt>Email</dt>
              <dd>{account.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{account.role}</dd>
            </div>
            <div>
              <dt>Restaurant</dt>
              <dd>{account.restaurantName}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{account.active ? "Active" : "Inactive"}</dd>
            </div>
          </dl>
          <form onSubmit={saveName} className="account-form">
            <label>
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={80}
              />
            </label>
            <button className="primary-button" disabled={pending}>
              Save name
            </button>
          </form>
        </section>
        <section className="section-block">
          <h2>Change password</h2>
          <form onSubmit={changePassword} className="account-form">
            <label>
              Current password
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </label>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                minLength={12}
                maxLength={72}
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </label>
            <p className="auth-hint">
              At least 12 characters, including uppercase, lowercase, a number,
              and a symbol. Changing it signs out existing sessions.
            </p>
            <button className="primary-button" disabled={pending}>
              Change password
            </button>
          </form>
          {message && (
            <p className="auth-success" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="secondary-button account-logout"
            onClick={() => void logout()}
          >
            Log out
          </button>
        </section>
      </div>
    </main>
  );
}
