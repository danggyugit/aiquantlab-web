import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Production FastAPI base URL. Prefers NEXT_PUBLIC_API_URL when set
 * (dev/staging can override), else falls back to prod. Ensures every
 * consumer works out-of-the-box even if Vercel is missing the env var.
 * Trailing slash always stripped so callers can safely concat paths.
 */
const DEFAULT_API_BASE = "https://aiquantlab-api.onrender.com";
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? DEFAULT_API_BASE;
