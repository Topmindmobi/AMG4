/**
 * Kenya phone helpers (client + server safe).
 * Canonical form is E.164: +2547XXXXXXXX / +2541XXXXXXXX.
 */

/** Normalize Kenya mobile numbers to E.164 (+254…). Returns null if unusable. */
export function normalizeKenyaPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "").trim();
  if (!digits) return null;

  let normalized = digits;
  if (normalized.startsWith("+")) {
    normalized = `+${normalized.slice(1).replace(/\D/g, "")}`;
  } else {
    const only = normalized.replace(/\D/g, "");
    if (only.startsWith("254") && only.length >= 12) {
      normalized = `+${only}`;
    } else if (only.startsWith("0") && only.length >= 10) {
      normalized = `+254${only.slice(1)}`;
    } else if (/^[17]\d{8}$/.test(only)) {
      normalized = `+254${only}`;
    } else if (only.length >= 9) {
      normalized = `+254${only.replace(/^0+/, "")}`;
    } else {
      return null;
    }
  }

  if (!/^\+254[17]\d{8}$/.test(normalized)) return null;
  return normalized;
}

/** Common storage/display variants for the same Kenya number (for DB OR queries). */
export function kenyaPhoneVariants(raw: string): string[] {
  const e164 = normalizeKenyaPhone(raw);
  if (!e164) return [];
  const national = `0${e164.slice(4)}`;
  const digits254 = e164.slice(1);
  const local9 = e164.slice(4);
  return Array.from(new Set([e164, national, digits254, local9, raw.trim()].filter(Boolean)));
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = normalizeKenyaPhone(a);
  const nb = normalizeKenyaPhone(b);
  if (na && nb) return na === nb;
  return a.replace(/\D/g, "") === b.replace(/\D/g, "");
}

/** Synthetic auth email for phone-only guest accounts (not a real inbox). */
export function guestEmailFromPhone(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `guest.${digits}@amg.guest`;
}

export function isGuestPhoneEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith("@amg.guest");
}

/** Human-friendly login label: real email, or phone when the account is phone-only. */
export function loginIdentifierLabel(email: string, phone?: string | null): string {
  if (isGuestPhoneEmail(email) && phone) {
    return normalizeKenyaPhone(phone) ?? phone;
  }
  return email;
}
