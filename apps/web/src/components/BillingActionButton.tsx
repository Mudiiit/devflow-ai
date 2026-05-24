"use client";

import { useState } from "react";
import { fetchApi } from "@/lib/api";

type BillingActionButtonProps = {
  readonly label: string;
  readonly endpoint: "/billing/checkout" | "/billing/portal" | "/billing/subscription/change";
  readonly payload: Record<string, unknown>;
  readonly tone?: "primary" | "secondary";
};

export function BillingActionButton({ label, endpoint, payload, tone = "primary" }: BillingActionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={async () => {
        setIsLoading(true);
        try {
          const requestPayload =
            endpoint === "/billing/portal" && !("returnUrl" in payload)
              ? { ...payload, returnUrl: `${window.location.origin}/settings/billing` }
              : payload;

          const response = await fetchApi<{ url?: string } | { subscription?: unknown; usage?: unknown }>(endpoint, {
            method: "POST",
            body: JSON.stringify(requestPayload),
          });

          if ("url" in response && typeof response.url === "string") {
            window.location.assign(response.url);
            return;
          }

          window.location.reload();
        } finally {
          setIsLoading(false);
        }
      }}
      className={[
        "rounded-full px-4 py-2 text-xs font-semibold transition",
        tone === "primary"
          ? "bg-[color:var(--app-accent)] text-white shadow-lg shadow-[color:var(--app-accent)]/20"
          : "border border-[color:var(--app-border)] text-[color:var(--app-fg)]",
        isLoading ? "opacity-70" : "hover:translate-y-[-1px]",
      ].join(" ")}
    >
      {isLoading ? "Working..." : label}
    </button>
  );
}