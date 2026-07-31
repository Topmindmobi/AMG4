/** Shared result shape for guest checkout auto-account creation. */
export type EnsureCustomerAccountResult = {
  /** Profile / auth user id when known */
  userId: string | null;
  /** True when a brand-new account was created for this email */
  created: boolean;
  /** True when an existing account was found and reused */
  existed: boolean;
  email: string;
  /** Only set when a new account was created — show once or email it */
  temporaryPassword?: string;
  /** Soft failure message; order placement should still succeed */
  error?: string;
};

export type EnsureCustomerAccountInput = {
  email: string;
  fullName: string;
  phone?: string | null;
  town?: string | null;
};
