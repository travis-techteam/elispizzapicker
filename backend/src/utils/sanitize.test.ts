import { describe, it, expect } from 'vitest';
import { sanitizeString, sanitizeObject } from './sanitize.js';

describe('Sanitize Utilities', () => {
  describe('sanitizeString', () => {
    it('should return the same string if no HTML', () => {
      expect(sanitizeString('Hello World')).toBe('Hello World');
    });

    it('should remove HTML tags', () => {
      expect(sanitizeString('<b>Bold</b> text')).toBe('Bold text');
    });

    it('should remove script tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>Hello')).toBe('Hello');
    });

    it('should handle inline event handlers', () => {
      expect(sanitizeString('<img src="x" onerror="alert(1)">')).toBe('');
    });

    it('should remove nested tags', () => {
      expect(sanitizeString('<div><p>Hello <b>World</b></p></div>')).toBe('Hello World');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  Hello World  ')).toBe('Hello World');
    });

    it('should handle empty string', () => {
      expect(sanitizeString('')).toBe('');
    });

    it('should handle non-string input', () => {
      expect(sanitizeString(null as any)).toBe(null);
      expect(sanitizeString(undefined as any)).toBe(undefined);
      expect(sanitizeString(123 as any)).toBe(123);
    });

    it('should remove javascript: URLs', () => {
      expect(sanitizeString('<a href="javascript:alert(1)">Click</a>')).toBe('Click');
    });

    it('should handle data: URLs', () => {
      expect(sanitizeString('<img src="data:image/svg+xml,<svg onload=alert(1)>">')).toBe('');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize string values in object', () => {
      const input = { name: '<script>alert("xss")</script>John' };
      const result = sanitizeObject(input);
      expect(result.name).toBe('John');
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '<b>John</b>',
          bio: '<script>xss</script>Hello',
        },
      };
      const result = sanitizeObject(input);
      expect(result.user.name).toBe('John');
      expect(result.user.bio).toBe('Hello');
    });

    it('should handle arrays', () => {
      const input = {
        toppings: ['<b>Pepperoni</b>', '<script>xss</script>Cheese'],
      };
      const result = sanitizeObject(input);
      expect(result.toppings).toEqual(['Pepperoni', 'Cheese']);
    });

    it('should preserve non-string values', () => {
      const input = {
        name: 'John',
        age: 25,
        active: true,
        score: null,
      };
      const result = sanitizeObject(input);
      expect(result).toEqual({
        name: 'John',
        age: 25,
        active: true,
        score: null,
      });
    });

    it('should handle deeply nested structures', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              value: '<img src=x onerror=alert(1)>test',
            },
          },
        },
      };
      const result = sanitizeObject(input);
      expect(result.level1.level2.level3.value).toBe('test');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeObject(null)).toBe(null);
      expect(sanitizeObject(undefined)).toBe(undefined);
    });

    it('should handle arrays at root level', () => {
      const input = ['<b>One</b>', '<script>xss</script>Two'];
      const result = sanitizeObject(input);
      expect(result).toEqual(['One', 'Two']);
    });
  });
});
