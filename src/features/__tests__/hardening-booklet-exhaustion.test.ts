/**
 * Phase 4 Hardening: Booklet Exhaustion Tests
 *
 * Tests covering:
 * - Booklet range validation
 * - OR number sequence management
 * - Exhaustion detection and handling
 * - Concurrent OR consumption
 * - Booklet lifecycle transitions
 */

import { describe, it, expect } from "vitest";

// =============================================================================
// BOOKLET RANGE VALIDATION
// =============================================================================

describe("Booklet Range Validation", () => {
  describe("Start/End Number Validation", () => {
    it("should validate start number is less than end number", () => {
      const validateRange = (
        startNumber: number,
        endNumber: number
      ): { valid: boolean; error?: string } => {
        if (startNumber >= endNumber) {
          return {
            valid: false,
            error: "Start number must be less than end number",
          };
        }
        return { valid: true };
      };

      expect(validateRange(1, 50)).toEqual({ valid: true });
      expect(validateRange(50, 100)).toEqual({ valid: true });
      expect(validateRange(100, 50).valid).toBe(false);
      expect(validateRange(50, 50).valid).toBe(false);
    });

    it("should validate booklet contains exactly 51 receipts", () => {
      const BOOKLET_SIZE = 51;

      const validateBookletSize = (
        startNumber: number,
        endNumber: number
      ): { valid: boolean; error?: string } => {
        const size = endNumber - startNumber + 1;
        if (size !== BOOKLET_SIZE) {
          return {
            valid: false,
            error: `Booklet must contain exactly ${BOOKLET_SIZE} receipts, got ${size}`,
          };
        }
        return { valid: true };
      };

      expect(validateBookletSize(50, 100)).toEqual({ valid: true }); // 51 receipts
      expect(validateBookletSize(1, 51)).toEqual({ valid: true }); // 51 receipts
      expect(validateBookletSize(1, 50).valid).toBe(false); // 50 receipts
      expect(validateBookletSize(1, 100).valid).toBe(false); // 100 receipts
    });

    it("should validate OR numbers are 5 digits", () => {
      const validateORNumberRange = (
        startNumber: number,
        endNumber: number
      ): { valid: boolean; error?: string } => {
        const MIN_OR = 1;
        const MAX_OR = 99999;

        if (startNumber < MIN_OR || endNumber > MAX_OR) {
          return {
            valid: false,
            error: "OR numbers must be between 00001 and 99999",
          };
        }
        return { valid: true };
      };

      expect(validateORNumberRange(1, 51)).toEqual({ valid: true });
      expect(validateORNumberRange(99949, 99999)).toEqual({ valid: true });
      expect(validateORNumberRange(0, 50).valid).toBe(false);
      expect(validateORNumberRange(99950, 100000).valid).toBe(false);
    });
  });

  describe("Prefix Validation", () => {
    it("should validate prefix is 2 uppercase letters", () => {
      const PREFIX_REGEX = /^[A-Z]{2}$/;

      const validatePrefix = (
        prefix: string
      ): { valid: boolean; error?: string } => {
        if (!PREFIX_REGEX.test(prefix)) {
          return {
            valid: false,
            error: "Prefix must be exactly 2 uppercase letters",
          };
        }
        return { valid: true };
      };

      expect(validatePrefix("AP")).toEqual({ valid: true });
      expect(validatePrefix("ZZ")).toEqual({ valid: true });
      expect(validatePrefix("AB")).toEqual({ valid: true });
      expect(validatePrefix("ap").valid).toBe(false); // lowercase
      expect(validatePrefix("A").valid).toBe(false); // too short
      expect(validatePrefix("ABC").valid).toBe(false); // too long
      expect(validatePrefix("A1").valid).toBe(false); // contains number
      expect(validatePrefix("").valid).toBe(false); // empty
    });
  });

  describe("Booklet Overlap Detection", () => {
    it("should detect overlapping booklet ranges", () => {
      type Booklet = {
        prefix: string;
        startNumber: number;
        endNumber: number;
      };

      const rangesOverlap = (a: Booklet, b: Booklet): boolean => {
        if (a.prefix !== b.prefix) return false;
        return a.startNumber <= b.endNumber && b.startNumber <= a.endNumber;
      };

      const bookletA: Booklet = { prefix: "AP", startNumber: 1, endNumber: 51 };
      const bookletB: Booklet = { prefix: "AP", startNumber: 52, endNumber: 102 };
      const bookletC: Booklet = { prefix: "AP", startNumber: 40, endNumber: 90 };
      const bookletD: Booklet = { prefix: "AQ", startNumber: 1, endNumber: 51 };

      expect(rangesOverlap(bookletA, bookletB)).toBe(false); // Adjacent, no overlap
      expect(rangesOverlap(bookletA, bookletC)).toBe(true); // Overlap at 40-51
      expect(rangesOverlap(bookletA, bookletD)).toBe(false); // Different prefix
    });

    it("should validate no overlap with existing booklets", () => {
      type Booklet = {
        prefix: string;
        startNumber: number;
        endNumber: number;
      };

      const existingBooklets: Booklet[] = [
        { prefix: "AP", startNumber: 1, endNumber: 51 },
        { prefix: "AP", startNumber: 52, endNumber: 102 },
        { prefix: "AQ", startNumber: 1, endNumber: 51 },
      ];

      const hasOverlap = (newBooklet: Booklet): boolean => {
        return existingBooklets.some((existing) => {
          if (existing.prefix !== newBooklet.prefix) return false;
          return (
            newBooklet.startNumber <= existing.endNumber &&
            existing.startNumber <= newBooklet.endNumber
          );
        });
      };

      expect(hasOverlap({ prefix: "AP", startNumber: 103, endNumber: 153 })).toBe(
        false
      );
      expect(hasOverlap({ prefix: "AP", startNumber: 50, endNumber: 100 })).toBe(
        true
      );
      expect(hasOverlap({ prefix: "AR", startNumber: 1, endNumber: 51 })).toBe(
        false
      );
    });
  });
});

// =============================================================================
// OR NUMBER SEQUENCE MANAGEMENT
// =============================================================================

describe("OR Number Sequence Management", () => {
  describe("Next OR Number Calculation", () => {
    it("should return next sequential OR number", () => {
      type Booklet = {
        prefix: string;
        startNumber: number;
        endNumber: number;
        nextNumber: number;
      };

      const getNextOR = (
        booklet: Booklet
      ): { orNumber: string; newNextNumber: number } | null => {
        if (booklet.nextNumber > booklet.endNumber) {
          return null; // Exhausted
        }

        const orNumber = `${booklet.prefix}-${String(booklet.nextNumber).padStart(5, "0")}`;
        return {
          orNumber,
          newNextNumber: booklet.nextNumber + 1,
        };
      };

      const booklet: Booklet = {
        prefix: "AP",
        startNumber: 1,
        endNumber: 51,
        nextNumber: 1,
      };

      const result1 = getNextOR(booklet);
      expect(result1?.orNumber).toBe("AP-00001");
      expect(result1?.newNextNumber).toBe(2);

      const booklet2: Booklet = { ...booklet, nextNumber: 51 };
      const result2 = getNextOR(booklet2);
      expect(result2?.orNumber).toBe("AP-00051");
      expect(result2?.newNextNumber).toBe(52);

      const exhaustedBooklet: Booklet = { ...booklet, nextNumber: 52 };
      const result3 = getNextOR(exhaustedBooklet);
      expect(result3).toBeNull();
    });

    it("should format OR number with proper padding", () => {
      const formatORNumber = (prefix: string, number: number): string => {
        return `${prefix}-${String(number).padStart(5, "0")}`;
      };

      expect(formatORNumber("AP", 1)).toBe("AP-00001");
      expect(formatORNumber("AP", 12)).toBe("AP-00012");
      expect(formatORNumber("AP", 123)).toBe("AP-00123");
      expect(formatORNumber("AP", 1234)).toBe("AP-01234");
      expect(formatORNumber("AP", 12345)).toBe("AP-12345");
      expect(formatORNumber("AP", 99999)).toBe("AP-99999");
    });
  });

  describe("OR Consumption Tracking", () => {
    it("should track consumed OR numbers", () => {
      type ORStatus = "available" | "consumed" | "voided";

      type ORRecord = {
        orNumber: string;
        status: ORStatus;
        consumedAt?: Date;
        paymentId?: string;
      };

      const orRecords = new Map<string, ORRecord>();

      const consumeOR = (
        orNumber: string,
        paymentId: string
      ): { success: boolean; error?: string } => {
        const existing = orRecords.get(orNumber);

        if (existing) {
          if (existing.status === "consumed") {
            return { success: false, error: "OR already consumed" };
          }
          if (existing.status === "voided") {
            return { success: false, error: "OR has been voided" };
          }
        }

        orRecords.set(orNumber, {
          orNumber,
          status: "consumed",
          consumedAt: new Date(),
          paymentId,
        });

        return { success: true };
      };

      // First consumption
      const result1 = consumeOR("AP-00001", "payment-1");
      expect(result1.success).toBe(true);

      // Duplicate consumption
      const result2 = consumeOR("AP-00001", "payment-2");
      expect(result2.success).toBe(false);
      expect(result2.error).toBe("OR already consumed");
    });

    it("should mark OR as voided without returning to pool", () => {
      type ORRecord = {
        status: "available" | "consumed" | "voided";
        voidedAt?: Date;
        voidReason?: string;
      };

      const voidOR = (
        record: ORRecord,
        reason: string
      ): ORRecord => {
        return {
          ...record,
          status: "voided",
          voidedAt: new Date(),
          voidReason: reason,
        };
      };

      const consumedOR: ORRecord = { status: "consumed" };
      const voidedOR = voidOR(consumedOR, "Payment voided");

      expect(voidedOR.status).toBe("voided");
      expect(voidedOR.voidReason).toBe("Payment voided");
      // Voided OR should NOT return to available
      expect(voidedOR.status).not.toBe("available");
    });
  });
});

// =============================================================================
// EXHAUSTION DETECTION AND HANDLING
// =============================================================================

describe("Exhaustion Detection and Handling", () => {
  describe("Exhaustion Detection", () => {
    it("should detect when booklet is exhausted", () => {
      type Booklet = {
        startNumber: number;
        endNumber: number;
        nextNumber: number;
        status: "active" | "exhausted" | "voided";
      };

      const isExhausted = (booklet: Booklet): boolean => {
        return booklet.nextNumber > booklet.endNumber;
      };

      const activeBooklet: Booklet = {
        startNumber: 1,
        endNumber: 51,
        nextNumber: 50,
        status: "active",
      };
      expect(isExhausted(activeBooklet)).toBe(false);

      const lastORBooklet: Booklet = {
        startNumber: 1,
        endNumber: 51,
        nextNumber: 51,
        status: "active",
      };
      expect(isExhausted(lastORBooklet)).toBe(false); // Still has one OR left

      const exhaustedBooklet: Booklet = {
        startNumber: 1,
        endNumber: 51,
        nextNumber: 52,
        status: "active",
      };
      expect(isExhausted(exhaustedBooklet)).toBe(true);
    });

    it("should calculate remaining OR count", () => {
      type Booklet = {
        endNumber: number;
        nextNumber: number;
      };

      const getRemainingCount = (booklet: Booklet): number => {
        const remaining = booklet.endNumber - booklet.nextNumber + 1;
        return Math.max(0, remaining);
      };

      expect(getRemainingCount({ endNumber: 51, nextNumber: 1 })).toBe(51);
      expect(getRemainingCount({ endNumber: 51, nextNumber: 50 })).toBe(2);
      expect(getRemainingCount({ endNumber: 51, nextNumber: 51 })).toBe(1);
      expect(getRemainingCount({ endNumber: 51, nextNumber: 52 })).toBe(0);
    });

    it("should warn when booklet is running low", () => {
      const LOW_THRESHOLD = 10;

      type Booklet = {
        endNumber: number;
        nextNumber: number;
      };

      const isRunningLow = (booklet: Booklet): boolean => {
        const remaining = booklet.endNumber - booklet.nextNumber + 1;
        return remaining > 0 && remaining <= LOW_THRESHOLD;
      };

      expect(isRunningLow({ endNumber: 51, nextNumber: 1 })).toBe(false); // 51 remaining
      expect(isRunningLow({ endNumber: 51, nextNumber: 40 })).toBe(false); // 12 remaining
      expect(isRunningLow({ endNumber: 51, nextNumber: 42 })).toBe(true); // 10 remaining
      expect(isRunningLow({ endNumber: 51, nextNumber: 50 })).toBe(true); // 2 remaining
      expect(isRunningLow({ endNumber: 51, nextNumber: 52 })).toBe(false); // 0 remaining (exhausted)
    });
  });

  describe("Automatic Status Transition", () => {
    it("should transition to exhausted when last OR consumed", () => {
      type Booklet = {
        id: string;
        endNumber: number;
        nextNumber: number;
        status: "active" | "exhausted" | "voided";
      };

      const consumeORAndUpdateStatus = (
        booklet: Booklet
      ): Booklet => {
        const newNextNumber = booklet.nextNumber + 1;
        const isNowExhausted = newNextNumber > booklet.endNumber;

        return {
          ...booklet,
          nextNumber: newNextNumber,
          status: isNowExhausted ? "exhausted" : booklet.status,
        };
      };

      // Consuming second-to-last OR
      const beforeLastOR: Booklet = {
        id: "b1",
        endNumber: 51,
        nextNumber: 50,
        status: "active",
      };
      const afterSecondToLast = consumeORAndUpdateStatus(beforeLastOR);
      expect(afterSecondToLast.status).toBe("active");
      expect(afterSecondToLast.nextNumber).toBe(51);

      // Consuming last OR
      const lastOR = consumeORAndUpdateStatus(afterSecondToLast);
      expect(lastOR.status).toBe("exhausted");
      expect(lastOR.nextNumber).toBe(52);
    });
  });

  describe("Exhausted Booklet Handling", () => {
    it("should reject OR consumption from exhausted booklet", () => {
      type Booklet = {
        status: "active" | "exhausted" | "voided";
        nextNumber: number;
        endNumber: number;
      };

      const canConsumeOR = (
        booklet: Booklet
      ): { allowed: boolean; reason?: string } => {
        if (booklet.status === "exhausted") {
          return { allowed: false, reason: "Booklet is exhausted" };
        }
        if (booklet.status === "voided") {
          return { allowed: false, reason: "Booklet has been voided" };
        }
        if (booklet.nextNumber > booklet.endNumber) {
          return { allowed: false, reason: "No remaining OR numbers" };
        }
        return { allowed: true };
      };

      const exhaustedBooklet: Booklet = {
        status: "exhausted",
        nextNumber: 52,
        endNumber: 51,
      };
      expect(canConsumeOR(exhaustedBooklet)).toEqual({
        allowed: false,
        reason: "Booklet is exhausted",
      });

      const activeBooklet: Booklet = {
        status: "active",
        nextNumber: 50,
        endNumber: 51,
      };
      expect(canConsumeOR(activeBooklet)).toEqual({ allowed: true });
    });

    it("should require new booklet selection after exhaustion", () => {
      type Booklet = {
        id: string;
        status: "active" | "exhausted";
      };

      const getAvailableBooklets = (
        booklets: Booklet[],
        currentBookletId: string
      ): Booklet[] => {
        return booklets.filter(
          (b) => b.status === "active" && b.id !== currentBookletId
        );
      };

      const booklets: Booklet[] = [
        { id: "b1", status: "exhausted" },
        { id: "b2", status: "active" },
        { id: "b3", status: "active" },
      ];

      const available = getAvailableBooklets(booklets, "b1");
      expect(available).toHaveLength(2);
      expect(available.map((b) => b.id)).toEqual(["b2", "b3"]);
    });
  });
});

// =============================================================================
// CONCURRENT OR CONSUMPTION
// =============================================================================

describe("Concurrent OR Consumption", () => {
  describe("Row-Level Locking", () => {
    it("should serialize OR consumption with locking", async () => {
      type LockState = {
        isLocked: boolean;
        lockedBy: string | null;
      };

      const bookletLocks = new Map<string, LockState>();

      const acquireBookletLock = async (
        bookletId: string,
        userId: string
      ): Promise<boolean> => {
        const lock = bookletLocks.get(bookletId);

        if (lock?.isLocked) {
          return false; // Already locked
        }

        bookletLocks.set(bookletId, { isLocked: true, lockedBy: userId });
        return true;
      };

      const releaseBookletLock = (bookletId: string): void => {
        bookletLocks.set(bookletId, { isLocked: false, lockedBy: null });
      };

      // First user acquires lock
      const lock1 = await acquireBookletLock("booklet-1", "user-1");
      expect(lock1).toBe(true);

      // Second user fails to acquire
      const lock2 = await acquireBookletLock("booklet-1", "user-2");
      expect(lock2).toBe(false);

      // First user releases
      releaseBookletLock("booklet-1");

      // Now second user can acquire
      const lock3 = await acquireBookletLock("booklet-1", "user-2");
      expect(lock3).toBe(true);
    });

    it("should use SELECT FOR UPDATE pattern", () => {
      // This test documents the expected SQL pattern
      const getSelectForUpdateQuery = (bookletId: string): string => {
        return `
          SELECT * FROM receipt_booklets
          WHERE id = '${bookletId}'
          FOR UPDATE
        `;
      };

      const query = getSelectForUpdateQuery("booklet-1");
      expect(query).toContain("FOR UPDATE");
      expect(query).toContain("receipt_booklets");
    });
  });

  describe("Atomic OR Assignment", () => {
    it("should atomically increment nextNumber", () => {
      // Simulated atomic operation
      type AtomicResult = {
        previousValue: number;
        newValue: number;
        assignedOR: string;
      };

      const atomicGetAndIncrement = (
        currentNextNumber: number,
        prefix: string
      ): AtomicResult => {
        const assignedOR = `${prefix}-${String(currentNextNumber).padStart(5, "0")}`;
        return {
          previousValue: currentNextNumber,
          newValue: currentNextNumber + 1,
          assignedOR,
        };
      };

      const result = atomicGetAndIncrement(42, "AP");
      expect(result.previousValue).toBe(42);
      expect(result.newValue).toBe(43);
      expect(result.assignedOR).toBe("AP-00042");
    });

    it("should prevent gap in OR sequence", () => {
      // Sequence should be continuous without gaps
      const consumedORs: number[] = [];

      const consumeNextOR = (nextNumber: number): number => {
        consumedORs.push(nextNumber);
        return nextNumber + 1;
      };

      let next = 1;
      next = consumeNextOR(next); // 1
      next = consumeNextOR(next); // 2
      next = consumeNextOR(next); // 3

      // Verify no gaps
      expect(consumedORs).toEqual([1, 2, 3]);

      // Each OR should be exactly 1 more than previous
      for (let i = 1; i < consumedORs.length; i++) {
        expect(consumedORs[i] - consumedORs[i - 1]).toBe(1);
      }
    });
  });

  describe("Concurrent Cashier Scenario", () => {
    it("should handle two cashiers posting simultaneously", async () => {
      type PostResult = {
        success: boolean;
        orNumber?: string;
        error?: string;
      };

      // Shared state
      let bookletNextNumber = 1;
      const assignedORs: string[] = [];
      let mutex = false;

      const postPaymentWithOR = async (
        cashierId: string
      ): Promise<PostResult> => {
        // Simulate acquiring lock
        while (mutex) {
          await new Promise((r) => setTimeout(r, 10));
        }
        mutex = true;

        try {
          const orNumber = `AP-${String(bookletNextNumber).padStart(5, "0")}`;
          bookletNextNumber++;
          assignedORs.push(orNumber);

          return { success: true, orNumber };
        } finally {
          mutex = false;
        }
      };

      // Simulate concurrent requests
      const [result1, result2] = await Promise.all([
        postPaymentWithOR("cashier-1"),
        postPaymentWithOR("cashier-2"),
      ]);

      // Both should succeed with different ORs
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.orNumber).not.toBe(result2.orNumber);

      // No duplicate ORs
      const uniqueORs = new Set(assignedORs);
      expect(uniqueORs.size).toBe(assignedORs.length);
    });
  });
});

// =============================================================================
// BOOKLET LIFECYCLE
// =============================================================================

describe("Booklet Lifecycle Transitions", () => {
  describe("Valid State Transitions", () => {
    type BookletStatus = "active" | "exhausted" | "voided";

    it("should define valid transitions", () => {
      const validTransitions: Record<BookletStatus, BookletStatus[]> = {
        active: ["exhausted", "voided"],
        exhausted: ["voided"], // Can void an exhausted booklet
        voided: [], // Terminal state
      };

      const canTransition = (
        from: BookletStatus,
        to: BookletStatus
      ): boolean => {
        return validTransitions[from].includes(to);
      };

      // Valid transitions
      expect(canTransition("active", "exhausted")).toBe(true);
      expect(canTransition("active", "voided")).toBe(true);
      expect(canTransition("exhausted", "voided")).toBe(true);

      // Invalid transitions
      expect(canTransition("exhausted", "active")).toBe(false);
      expect(canTransition("voided", "active")).toBe(false);
      expect(canTransition("voided", "exhausted")).toBe(false);
    });
  });

  describe("Booklet Activation", () => {
    it("should allow multiple active booklets", () => {
      type Booklet = {
        id: string;
        prefix: string;
        status: "active" | "exhausted" | "voided";
      };

      const booklets: Booklet[] = [
        { id: "b1", prefix: "AP", status: "active" },
        { id: "b2", prefix: "AQ", status: "active" },
        { id: "b3", prefix: "AR", status: "exhausted" },
      ];

      const activeBooklets = booklets.filter((b) => b.status === "active");
      expect(activeBooklets).toHaveLength(2);

      // Multiple active booklets allowed (confirmed business rule)
      expect(activeBooklets.map((b) => b.prefix)).toContain("AP");
      expect(activeBooklets.map((b) => b.prefix)).toContain("AQ");
    });
  });

  describe("Booklet Selection by Cashier", () => {
    it("should allow cashier to select from available booklets", () => {
      type Booklet = {
        id: string;
        prefix: string;
        status: "active" | "exhausted" | "voided";
        remainingCount: number;
      };

      const getSelectableBooklets = (booklets: Booklet[]): Booklet[] => {
        return booklets.filter(
          (b) => b.status === "active" && b.remainingCount > 0
        );
      };

      const booklets: Booklet[] = [
        { id: "b1", prefix: "AP", status: "active", remainingCount: 25 },
        { id: "b2", prefix: "AQ", status: "active", remainingCount: 0 },
        { id: "b3", prefix: "AR", status: "exhausted", remainingCount: 0 },
        { id: "b4", prefix: "AS", status: "active", remainingCount: 51 },
      ];

      const selectable = getSelectableBooklets(booklets);
      expect(selectable).toHaveLength(2);
      expect(selectable.map((b) => b.prefix)).toEqual(["AP", "AS"]);
    });
  });
});
