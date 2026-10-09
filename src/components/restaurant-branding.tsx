"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";

type Branding = {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
};

type BrandingForm = {
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
};

type BrandingPreviewStyle = CSSProperties & {
  "--preview-primary": string;
  "--preview-accent": string;
};

const defaultColors = {
  primaryColor: "#173e32",
  accentColor: "#4c9b5c",
};

const emptyForm: BrandingForm = {
  logoUrl: "",
  ...defaultColors,
};

export default function RestaurantBranding() {
  const [restaurantName, setRestaurantName] = useState("Restaurant");
  const [form, setForm] = useState<BrandingForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch("/api/restaurant/branding", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(body.error ?? "Brand settings could not be loaded");
        return body.restaurant as Branding;
      })
      .then((restaurant) => {
        if (!mounted) return;
        setRestaurantName(restaurant.name);
        setForm({
          logoUrl: restaurant.logoUrl ?? "",
          primaryColor: restaurant.primaryColor ?? defaultColors.primaryColor,
          accentColor: restaurant.accentColor ?? defaultColors.accentColor,
        });
      })
      .catch((cause) => {
        if (mounted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Brand settings could not be loaded",
          );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const previewStyle: BrandingPreviewStyle = {
    "--preview-primary": form.primaryColor,
    "--preview-accent": form.accentColor,
  };

  async function saveBranding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/restaurant/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Brand settings could not be saved");
      setForm({
        logoUrl: body.restaurant.logoUrl ?? "",
        primaryColor:
          body.restaurant.primaryColor ?? defaultColors.primaryColor,
        accentColor: body.restaurant.accentColor ?? defaultColors.accentColor,
      });
      setNotice("Restaurant branding saved.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Brand settings could not be saved",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page manager-branding-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">RESTAURANT PROFILE</span>
          <h1>Restaurant branding</h1>
          <p>Choose how your restaurant appears on its customer QR menu.</p>
        </div>
        <a className="secondary-button" href="/manager/dashboard">
          Back to dashboard
        </a>
      </div>

      {error && (
        <div className="table-error" role="alert">
          <strong>Branding request failed.</strong>
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <p className="menu-notice" role="status">
          {notice}
        </p>
      )}

      <div className="manager-branding-layout">
        <form className="manager-branding-form" onSubmit={saveBranding}>
          <label>
            Logo image URL
            <input
              type="url"
              inputMode="url"
              maxLength={2048}
              value={form.logoUrl}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  logoUrl: event.target.value,
                }))
              }
              placeholder="https://example.com/logo.png"
            />
            <small>Use a publicly reachable HTTPS image URL.</small>
          </label>

          <label>
            Primary brand color
            <span className="branding-color-field">
              <input
                type="color"
                value={form.primaryColor}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    primaryColor: event.target.value,
                  }))
                }
                aria-label="Choose primary brand color"
              />
              <input
                type="text"
                value={form.primaryColor}
                pattern="#[0-9a-fA-F]{6}"
                maxLength={7}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    primaryColor: event.target.value,
                  }))
                }
                aria-label="Primary brand color hex value"
              />
            </span>
          </label>

          <label>
            Accent brand color
            <span className="branding-color-field">
              <input
                type="color"
                value={form.accentColor}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    accentColor: event.target.value,
                  }))
                }
                aria-label="Choose accent brand color"
              />
              <input
                type="text"
                value={form.accentColor}
                pattern="#[0-9a-fA-F]{6}"
                maxLength={7}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    accentColor: event.target.value,
                  }))
                }
                aria-label="Accent brand color hex value"
              />
            </span>
          </label>

          <button
            className="primary-button"
            type="submit"
            disabled={saving || loading}
          >
            {saving ? "Saving..." : "Save branding"}
          </button>
        </form>

        <section className="branding-preview" style={previewStyle}>
          <span className="eyebrow">CUSTOMER MENU PREVIEW</span>
          <div className="branding-preview-card">
            <div className="branding-preview-heading">
              {form.logoUrl ? (
                <span className="branding-preview-logo">
                  <Image
                    src={form.logoUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="48px"
                  />
                </span>
              ) : (
                <span className="branding-preview-mark">
                  {restaurantName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span>
                <strong>{restaurantName}</strong>
                <small>MENU &amp; ORDERING</small>
              </span>
            </div>
            <h2>Explore the menu</h2>
            <p>Fresh dishes, made for your table.</p>
            <span className="branding-preview-action">Browse menu</span>
          </div>
          {loading && <p className="branding-preview-loading">Loading preview…</p>}
        </section>
      </div>
    </main>
  );
}
