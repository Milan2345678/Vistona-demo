"use client";

import { useEffect, useState, type FormEvent } from "react";

type StaffRole = "WAITER" | "KITCHEN";
type Staff = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  createdAt: string;
};

export default function StaffManagement() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [roleToAdd, setRoleToAdd] = useState<StaffRole | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState<{
    code: string;
    role: StaffRole;
    expiresAt: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/staff")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error ?? "Staff list could not be loaded");
        return body.staff as Staff[];
      })
      .then((result) => {
        if (mounted) setStaff(result);
      })
      .catch((cause) => {
        if (mounted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Staff list could not be loaded",
          );
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  function startCreate(role: StaffRole) {
    setRoleToAdd(role);
    setName("");
    setEmail("");
    setPassword("");
    setError("");
    setInvite(null);
  }

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roleToAdd) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role: roleToAdd }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Staff account could not be created");
      setStaff((current) => [...current, body.staff]);
      setRoleToAdd(null);
      setMessage(
        `${body.staff.role === "KITCHEN" ? "Kitchen staff" : "Waiter"} account created`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Staff account could not be created",
      );
    } finally {
      setPending(false);
    }
  }

  async function createInvite(role: StaffRole) {
    setError("");
    setMessage("");
    setPending(true);
    try {
      const response = await fetch("/api/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Invite could not be created");
      setInvite(body.invite);
      setMessage(
        "This invite code is shown once. Share it with the intended staff member.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Invite could not be created",
      );
    } finally {
      setPending(false);
    }
  }

  async function saveStaff(member: Staff) {
    setError("");
    setMessage("");
    const response = await fetch(`/api/staff/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: member.name,
        email: member.email,
        role: member.role,
        active: member.active,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Staff member could not be updated");
      return;
    }
    setStaff((current) =>
      current.map((item) => (item.id === member.id ? body.staff : item)),
    );
    setMessage("Staff details saved");
  }

  async function deactivateStaff(member: Staff) {
    const response = await fetch(`/api/staff/${member.id}`, {
      method: "DELETE",
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Staff member could not be deactivated");
      return;
    }
    setStaff((current) =>
      current.map((item) => (item.id === member.id ? body.staff : item)),
    );
    setMessage("Staff account deactivated");
  }

  async function makeInvite(role: StaffRole) {
    await createInvite(role);
  }

  return (
    <main className="page staff-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TEAM ACCESS</span>
          <h1>Staff management</h1>
          <p>Accounts and access are limited to your restaurant.</p>
        </div>
        <div className="staff-actions">
          <button
            className="secondary-button"
            onClick={() => startCreate("WAITER")}
          >
            + Add Waiter
          </button>
          <button
            className="primary-button"
            onClick={() => startCreate("KITCHEN")}
          >
            + Add Kitchen Staff
          </button>
        </div>
      </div>
      <div className="staff-invite-actions">
        <span>Create a one-time, seven-day staff invite:</span>
        <button
          className="secondary-button"
          disabled={pending}
          onClick={() => void makeInvite("WAITER")}
        >
          Invite Waiter
        </button>
        <button
          className="secondary-button"
          disabled={pending}
          onClick={() => void makeInvite("KITCHEN")}
        >
          Invite Kitchen Staff
        </button>
      </div>
      {invite && (
        <section className="invite-result">
          <strong>{invite.role} invite code</strong>
          <code>{invite.code}</code>
          <span>Expires {new Date(invite.expiresAt).toLocaleString()}</span>
          <a href="/join">Open join page</a>
        </section>
      )}
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
      {roleToAdd && (
        <section className="section-block staff-create">
          <div className="staff-create-heading">
            <h2>New {roleToAdd === "KITCHEN" ? "Kitchen Staff" : "Waiter"}</h2>
            <button
              className="secondary-button"
              onClick={() => setRoleToAdd(null)}
            >
              Cancel
            </button>
          </div>
          <form className="staff-form" onSubmit={createStaff}>
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
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={254}
              />
            </label>
            <label>
              Temporary password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={12}
                maxLength={72}
              />
            </label>
            <button className="primary-button" disabled={pending}>
              Create account
            </button>
          </form>
          <p className="auth-hint">
            Use a strong temporary password and share it securely. Staff can
            change it from Account.
          </p>
        </section>
      )}
      <section className="staff-list section-block">
        <div className="staff-list-heading">
          <h2>Restaurant staff</h2>
          <span>{staff.length} accounts</span>
        </div>
        {staff.length === 0 ? (
          <p className="empty-staff">No waiter or kitchen accounts yet.</p>
        ) : (
          staff.map((member) => (
            <article className="staff-row" key={member.id}>
              <label>
                Name
                <input
                  value={member.name}
                  onChange={(event) =>
                    setStaff((current) =>
                      current.map((item) =>
                        item.id === member.id
                          ? { ...item, name: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={member.email}
                  onChange={(event) =>
                    setStaff((current) =>
                      current.map((item) =>
                        item.id === member.id
                          ? { ...item, email: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Role
                <select
                  value={member.role}
                  onChange={(event) =>
                    setStaff((current) =>
                      current.map((item) =>
                        item.id === member.id
                          ? { ...item, role: event.target.value as StaffRole }
                          : item,
                      ),
                    )
                  }
                >
                  <option value="WAITER">Waiter</option>
                  <option value="KITCHEN">Kitchen Staff</option>
                </select>
              </label>
              <label className="staff-active">
                <input
                  type="checkbox"
                  checked={member.active}
                  onChange={(event) =>
                    setStaff((current) =>
                      current.map((item) =>
                        item.id === member.id
                          ? { ...item, active: event.target.checked }
                          : item,
                      ),
                    )
                  }
                />{" "}
                Active
              </label>
              <div className="staff-row-actions">
                <button
                  className="secondary-button"
                  onClick={() => void saveStaff(member)}
                >
                  Save
                </button>
                {member.active && (
                  <button
                    className="text-button"
                    onClick={() => void deactivateStaff(member)}
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
