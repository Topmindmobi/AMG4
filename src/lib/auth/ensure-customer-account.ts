/** Shared result shape for guest checkout auto-account creation. */
export type EnsureCustomerAccountResult = {
  /** Profile / auth user id when known */
  userId: string | null;
  /** True when a brand-new account was created for this contact */
  created: boolean;
  /** True when an existing account was found and reused */
  existed: boolean;
  /** Login email (real or synthetic phone-guest email) */
  email: string;
  /** Normalized phone when known */
  phone?: string | null;
  /** Only set when a new account was created — show once or email it */
  temporaryPassword?: string;
  /** Soft failure message; order placement should still succeed */
  error?: string;
};

export type EnsureCustomerAccountInput = {
  /** Required when phone is missing */
  email?: string | null;
  /** Required when email is missing */
  phone?: string | null;
  fullName: string;
  town?: string | null;
};

/** Returning-guest / phone-lookup payload (safe — no passwords). */
export type GuestIdentityLookup = {
  found: boolean;
  email: string | null;
  /** Prefer this for the email login field (hides synthetic @amg.guest when phone shown) */
  loginEmail: string | null;
  fullName: string | null;
  phone: string | null;
  town: string | null;
  address: string | null;
  error?: string;
};
