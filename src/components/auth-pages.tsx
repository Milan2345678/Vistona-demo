"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dashboardPath } from "@/lib/user-roles";
import type { AppRole } from "@/lib/auth";

type AuthResult = { user?: { role: AppRole }; error?: string };

function AuthFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="login-page auth-page">
      <Link
        className="login-brand"
        href="/login"
        aria-label="Vistona Restaurant CRM"
      >
        <span className="brand-mark">V</span>
        <strong>VISTONA</strong>
        <span>Restaurant CRM</span>
      </Link>
      <div className="login-wrap">
        <div className="login-copy">
          <span className="eyebrow">RESTAURANT OPERATIONS</span>
          <h1>One place for your floor and kitchen.</h1>
          <p>
            Secure access for the restaurant team, from the first order to the
            final ticket.
          </p>
        </div>
        <section className="login-card auth-card">
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
          {children}
        </section>
      </div>
    </main>
  );
}

function useRoleRedirect() {
  const router = useRouter();
  return useCallback(
    (role: string | undefined) => {
      if (role === "manager" || role === "waiter" || role === "kitchen") {
        router.replace(dashboardPath(role));
        router.refresh();
      }
    },
    [router],
  );
}

async function postAuth(
  endpoint: string,
  body: Record<string, string>,
): Promise<AuthResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as AuthResult;
  if (!response.ok)
    throw new Error(result.error ?? "Request could not be completed");
  return result;
}

export function LoginPage() {
  const redirectForRole = useRoleRedirect();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/session")
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (mounted && result?.user?.role) redirectForRole(result.user.role);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [redirectForRole]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const result = await postAuth("/api/auth/login", { email, password });
      redirectForRole(result.user?.role);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="WELCOME BACK"
      title="Sign in to Vistona"
      description="Use the account created by your restaurant manager."
    >
      <form onSubmit={submit}>
        <label>
          Email
          <input
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
            required
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            required
          />
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button full"
          disabled={pending}
          type="submit"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <div className="auth-links">
        <Link href="/signup">Create a restaurant account</Link>
        <Link href="/join">Join a restaurant with an invite</Link>
      </div>
    </AuthFrame>
  );
}

export function OwnerSignupPage() {
  const redirectForRole = useRoleRedirect();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setPending(true);
    try {
      const result = await postAuth("/api/auth/signup", {
        name,
        email,
        password,
        restaurantName,
        city,
      });
      redirectForRole(result.user?.role);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Account could not be created",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="NEW RESTAURANT"
      title="Create your owner account"
      description="This creates a new tenant and restaurant. Staff join later with a manager-issued invite."
    >
      <form onSubmit={submit}>
        <label>
          Restaurant name
          <input
            autoComplete="organization"
            value={restaurantName}
            onChange={(event) => {
              setRestaurantName(event.target.value);
              setError("");
            }}
            required
            minLength={2}
            maxLength={80}
          />
        </label>
        <label>
          City
          <input
            autoComplete="address-level2"
            value={city}
            onChange={(event) => {
              setCity(event.target.value);
              setError("");
            }}
            required
            minLength={2}
            maxLength={80}
          />
        </label>
        <label>
          Your name
          <input
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            required
            minLength={2}
            maxLength={80}
          />
        </label>
        <label>
          Email
          <input
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
            required
            maxLength={254}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="new-password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            required
            minLength={12}
            maxLength={72}
          />
        </label>
        <label>
          Confirm password
          <input
            autoComplete="new-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setError("");
            }}
            required
          />
        </label>
        <p className="auth-hint">
          Use at least 12 characters with uppercase, lowercase, number, and
          symbol.
        </p>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button full"
          disabled={pending}
          type="submit"
        >
          {pending ? "Creating account..." : "Create restaurant account"}
        </button>
      </form>
      <div className="auth-links">
        <Link href="/login">Back to sign in</Link>
        <Link href="/join">Have a staff invite?</Link>
      </div>
    </AuthFrame>
  );
}

export function JoinPage() {
  const redirectForRole = useRoleRedirect();
  const [inviteCode, setInviteCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setPending(true);
    try {
      const result = await postAuth("/api/auth/join", {
        inviteCode,
        name,
        email,
        password,
      });
      redirectForRole(result.user?.role);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Account could not be created",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="STAFF INVITATION"
      title="Join your restaurant"
      description="Your invite sets your role and restaurant. It can only be used once and expires after seven days."
    >
      <form onSubmit={submit}>
        <label>
          Invite code
          <input
            autoComplete="one-time-code"
            value={inviteCode}
            onChange={(event) => {
              setInviteCode(event.target.value.toUpperCase());
              setError("");
            }}
            required
            minLength={16}
            maxLength={64}
          />
        </label>
        <label>
          Your name
          <input
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            required
            minLength={2}
            maxLength={80}
          />
        </label>
        <label>
          Email
          <input
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
            required
            maxLength={254}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="new-password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            required
            minLength={12}
            maxLength={72}
          />
        </label>
        <label>
          Confirm password
          <input
            autoComplete="new-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setError("");
            }}
            required
          />
        </label>
        <p className="auth-hint">
          Use at least 12 characters with uppercase, lowercase, number, and
          symbol.
        </p>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button full"
          disabled={pending}
          type="submit"
        >
          {pending ? "Joining..." : "Create staff account"}
        </button>
      </form>
      <div className="auth-links">
        <Link href="/login">Back to sign in</Link>
        <Link href="/signup">Create a restaurant account</Link>
      </div>
    </AuthFrame>
  );
}
