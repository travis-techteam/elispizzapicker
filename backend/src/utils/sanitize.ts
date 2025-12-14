import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Create a DOMPurify instance using jsdom window
const window = new JSDOM('').window;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const purify = DOMPurify(window as any);

/**
 * Sanitize a string by removing all HTML tags
 * This prevents XSS attacks by stripping any HTML content
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input;
  // Remove all HTML tags, keeping only text content
  return purify.sanitize(input, { ALLOWED_TAGS: [] }).trim();
}

/**
 * Recursively sanitize all string values in an object
 * Handles nested objects and arrays
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as T;
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized as T;
  }

  return obj;
}
