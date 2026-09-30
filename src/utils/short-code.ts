import crypto from "crypto";

const BASE62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Reserved slugs that cannot be used as custom aliases
export const RESERVED_SLUGS = new Set([
  "api",
  "s",
  "login",
  "register",
  "dashboard",
  "admin",
  "status",
  "health",
  "favicon",
  "robots",
  "static",
  "_next",
]);

/**
 * Generates a cryptographically random Base62 short code.
 * @param length default is 6 characters (62^6 = 56.8 billion combinations)
 */
export function generateShortCode(length: number = 6): string {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += BASE62_CHARS[bytes[i]! % BASE62_CHARS.length];
  }
  return result;
}

/**
 * Validates whether a URL is a valid web URL with http/https scheme.
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates a custom alias slug (3-30 chars, alphanumeric, hyphens, underscores).
 */
export function isValidCustomAlias(alias: string): boolean {
  if (!alias || alias.length < 3 || alias.length > 30) return false;
  if (RESERVED_SLUGS.has(alias.toLowerCase())) return false;
  return /^[a-zA-Z0-9_-]+$/.test(alias);
}
