"use client";

/**
 * Demo-mode data layer — thin re-export barrel.
 *
 * This used to be a single ~2,100-line file mixing demo auth, catalog,
 * orders, notifications, supply requests, rider delivery/payouts, service
 * ratings, and quotes with no internal module boundaries (flagged in the
 * original codebase audit as a "god file", and the direct cause of at least
 * one real bug: a whole feature silently existing in only the demo-mode
 * code path because nobody split it out to notice the production branch was
 * missing). It's now split into focused per-domain modules under
 * `./demo/*`, re-exported here unchanged so every existing
 * `import { ... } from "@/lib/store/demo-store"` across the app keeps
 * working with zero call-site changes — see `git log` / the P2/P3 fixes
 * summary for the split itself.
 *
 * Add new demo-mode functionality to the relevant `./demo/*` module (or a
 * new one) and export it from there — this file should stay a pure barrel.
 */

export * from "./demo/auth";
export * from "./demo/callbacks";
export * from "./demo/catalog";
export * from "./demo/notifications";
export * from "./demo/order-ratings";
export * from "./demo/orders";
export * from "./demo/quotes";
export * from "./demo/returns";
export * from "./demo/rider-payouts";
export * from "./demo/role-applications";
export * from "./demo/service-ratings";
export * from "./demo/supply-requests";
