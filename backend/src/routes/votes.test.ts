import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Copy of the vote schema for testing validation
const voteSchema = z.object({
  sliceCount: z.number().int().min(1).max(4),
  choices: z
    .array(
      z.object({
        pizzaOptionId: z.string().min(1),
        priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      })
    )
    .length(3)
    .refine(
      (choices) => {
        const priorities = choices.map((c) => c.priority);
        return priorities.includes(1) && priorities.includes(2) && priorities.includes(3);
      },
      { message: 'Must have exactly one choice for each priority (1, 2, 3)' }
    )
    .refine(
      (choices) => {
        const ids = choices.map((c) => c.pizzaOptionId);
        return new Set(ids).size === ids.length;
      },
      { message: 'Cannot vote for the same pizza option multiple times' }
    ),
});

describe('Vote Schema Validation', () => {
  describe('sliceCount', () => {
    it('should accept valid slice counts (1-4)', () => {
      for (let sliceCount = 1; sliceCount <= 4; sliceCount++) {
        const result = voteSchema.safeParse({
          sliceCount,
          choices: [
            { pizzaOptionId: 'pizza-1', priority: 1 },
            { pizzaOptionId: 'pizza-2', priority: 2 },
            { pizzaOptionId: 'pizza-3', priority: 3 },
          ],
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject slice count of 0', () => {
      const result = voteSchema.safeParse({
        sliceCount: 0,
        choices: [
          { pizzaOptionId: 'pizza-1', priority: 1 },
          { pizzaOptionId: 'pizza-2', priority: 2 },
          { pizzaOptionId: 'pizza-3', priority: 3 },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('should reject slice count greater than 4', () => {
      const result = voteSchema.safeParse({
        sliceCount: 5,
        choices: [
          { pizzaOptionId: 'pizza-1', priority: 1 },
          { pizzaOptionId: 'pizza-2', priority: 2 },
          { pizzaOptionId: 'pizza-3', priority: 3 },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer slice count', () => {
      const result = voteSchema.safeParse({
        sliceCount: 2.5,
        choices: [
          { pizzaOptionId: 'pizza-1', priority: 1 },
          { pizzaOptionId: 'pizza-2', priority: 2 },
          { pizzaOptionId: 'pizza-3', priority: 3 },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('choices', () => {
    it('should require exactly 3 choices', () => {
      const twoChoices = voteSchema.safeParse({
        sliceCount: 2,
        choices: [
          { pizzaOptionId: 'pizza-1', priority: 1 },
          { pizzaOptionId: 'pizza-2', priority: 2 },
        ],
      });
      expect(twoChoices.success).toBe(false);

      const fourChoices = voteSchema.safeParse({
        sliceCount: 2,
        choices: [
          { pizzaOptionId: 'pizza-1', priority: 1 },
          { pizzaOptionId: 'pizza-2', priority: 2 },
          { pizzaOptionId: 'pizza-3', priority: 3 },
          { pizzaOptionId: 'pizza-4', priority: 1 as 1 | 2 | 3 },
        ],
      });
      expect(fourChoices.success).toBe(false);
    });

    it('should require priorities 1, 2, and 3', () => {
      const result = voteSchema.safeParse({
        sliceCount: 2,
        choices: [
          { pizzaOptionId: 'pizza-1', priority: 1 },
          { pizzaOptionId: 'pizza-2', priority: 1 },
          { pizzaOptionId: 'pizza-3', priority: 1 },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('should reject duplicate pizza options', () => {
      const result = voteSchema.safeParse({
        sliceCount: 2,
        choices: [
          { pizzaOptionId: 'pizza-1', priority: 1 },
          { pizzaOptionId: 'pizza-1', priority: 2 },
          { pizzaOptionId: 'pizza-3', priority: 3 },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid choices', () => {
      const result = voteSchema.safeParse({
        sliceCount: 2,
        choices: [
          { pizzaOptionId: 'pizza-1', priority: 1 },
          { pizzaOptionId: 'pizza-2', priority: 2 },
          { pizzaOptionId: 'pizza-3', priority: 3 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty pizza option IDs', () => {
      const result = voteSchema.safeParse({
        sliceCount: 2,
        choices: [
          { pizzaOptionId: '', priority: 1 },
          { pizzaOptionId: 'pizza-2', priority: 2 },
          { pizzaOptionId: 'pizza-3', priority: 3 },
        ],
      });
      expect(result.success).toBe(false);
    });
  });
});
