/**
 * Booklet Exhaustion Logic Tests
 *
 * Tests for receipt booklet exhaustion including:
 * - Status transitions (active → exhausted)
 * - nextNumber auto-increment behavior
 * - Exhaustion detection when nextNumber > endNumber
 * - Multiple sequential payments
 * - Boundary value testing
 *
 * H4 Finding: High-priority test for booklet exhaustion logic
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { LockedReceiptBooklet } from "@/lib/utils/tx-helpers";

// Utility function to determine new booklet status after OR consumption
function calculateNewBookletStatus(
  currentNextNumber: number,
  endNumber: number
): "active" | "exhausted" {
  // After consuming currentNextNumber, the new nextNumber will be currentNextNumber + 1
  const newNextNumber = currentNextNumber + 1;
  return newNextNumber > endNumber ? "exhausted" : "active";
}

// Utility function to check if booklet has available OR numbers
function hasAvailableOrNumbers(booklet: {
  nextNumber: number;
  endNumber: number;
  status: string;
}): boolean {
  return booklet.status === "active" && booklet.nextNumber <= booklet.endNumber;
}

// Utility function to get remaining OR count
function getRemainingOrCount(booklet: {
  nextNumber: number;
  endNumber: number;
}): number {
  return Math.max(0, booklet.endNumber - booklet.nextNumber + 1);
}

describe("Booklet Exhaustion Logic", () => {
  describe("calculateNewBookletStatus", () => {
    describe("standard 50-receipt booklet (51-100)", () => {
      const START = 51;
      const END = 100;

      it("should return 'active' when consuming first OR (51)", () => {
        // Arrange - consuming OR 51, next will be 52
        const currentNext = START;

        // Act
        const result = calculateNewBookletStatus(currentNext, END);

        // Assert
        expect(result).toBe("active");
      });

      it("should return 'active' when consuming middle OR (75)", () => {
        // Arrange - consuming OR 75, next will be 76
        const currentNext = 75;

        // Act
        const result = calculateNewBookletStatus(currentNext, END);

        // Assert
        expect(result).toBe("active");
      });

      it("should return 'active' when consuming second-to-last OR (99)", () => {
        // Arrange - consuming OR 99, next will be 100 (still one left)
        const currentNext = 99;

        // Act
        const result = calculateNewBookletStatus(currentNext, END);

        // Assert
        expect(result).toBe("active");
      });

      it("should return 'exhausted' when consuming last OR (100)", () => {
        // Arrange - consuming OR 100, next will be 101 (exceeds end)
        const currentNext = END;

        // Act
        const result = calculateNewBookletStatus(currentNext, END);

        // Assert
        expect(result).toBe("exhausted");
      });
    });

    describe("booklet starting from 1 (1-50)", () => {
      const START = 1;
      const END = 50;

      it("should return 'active' when consuming first OR (1)", () => {
        const result = calculateNewBookletStatus(START, END);
        expect(result).toBe("active");
      });

      it("should return 'exhausted' when consuming last OR (50)", () => {
        const result = calculateNewBookletStatus(END, END);
        expect(result).toBe("exhausted");
      });
    });

    describe("high-range booklet (99950-99999)", () => {
      const START = 99950;
      const END = 99999;

      it("should return 'active' when consuming 99998", () => {
        const result = calculateNewBookletStatus(99998, END);
        expect(result).toBe("active");
      });

      it("should return 'exhausted' when consuming 99999", () => {
        const result = calculateNewBookletStatus(END, END);
        expect(result).toBe("exhausted");
      });
    });

    describe("edge cases", () => {
      it("should handle single-OR scenario (start == end)", () => {
        // If a booklet theoretically had only 1 OR
        const result = calculateNewBookletStatus(100, 100);
        expect(result).toBe("exhausted");
      });
    });
  });

  describe("hasAvailableOrNumbers", () => {
    it("should return true for active booklet with OR numbers remaining", () => {
      // Arrange
      const booklet = {
        nextNumber: 51,
        endNumber: 100,
        status: "active",
      };

      // Act & Assert
      expect(hasAvailableOrNumbers(booklet)).toBe(true);
    });

    it("should return true for active booklet with exactly one OR remaining", () => {
      // Arrange
      const booklet = {
        nextNumber: 100,
        endNumber: 100,
        status: "active",
      };

      // Act & Assert
      expect(hasAvailableOrNumbers(booklet)).toBe(true);
    });

    it("should return false for exhausted booklet", () => {
      // Arrange
      const booklet = {
        nextNumber: 101,
        endNumber: 100,
        status: "exhausted",
      };

      // Act & Assert
      expect(hasAvailableOrNumbers(booklet)).toBe(false);
    });

    it("should return false for voided booklet", () => {
      // Arrange
      const booklet = {
        nextNumber: 51,
        endNumber: 100,
        status: "voided",
      };

      // Act & Assert
      expect(hasAvailableOrNumbers(booklet)).toBe(false);
    });

    it("should return false for inactive booklet", () => {
      // Arrange
      const booklet = {
        nextNumber: 51,
        endNumber: 100,
        status: "inactive",
      };

      // Act & Assert
      expect(hasAvailableOrNumbers(booklet)).toBe(false);
    });

    it("should return false when nextNumber exceeds endNumber (corrupted state)", () => {
      // Arrange - shouldn't happen but test defensive logic
      const booklet = {
        nextNumber: 105,
        endNumber: 100,
        status: "active",
      };

      // Act & Assert
      expect(hasAvailableOrNumbers(booklet)).toBe(false);
    });
  });

  describe("getRemainingOrCount", () => {
    it("should return full count for fresh booklet", () => {
      // Arrange - 51 to 100 = 50 OR numbers
      const booklet = { nextNumber: 51, endNumber: 100 };

      // Act
      const result = getRemainingOrCount(booklet);

      // Assert
      expect(result).toBe(50);
    });

    it("should return correct count after some consumption", () => {
      // Arrange - consumed 10, now at 61, remaining = 100 - 61 + 1 = 40
      const booklet = { nextNumber: 61, endNumber: 100 };

      // Act
      const result = getRemainingOrCount(booklet);

      // Assert
      expect(result).toBe(40);
    });

    it("should return 1 when only one OR remains", () => {
      // Arrange
      const booklet = { nextNumber: 100, endNumber: 100 };

      // Act
      const result = getRemainingOrCount(booklet);

      // Assert
      expect(result).toBe(1);
    });

    it("should return 0 when booklet is exhausted", () => {
      // Arrange - nextNumber exceeds endNumber
      const booklet = { nextNumber: 101, endNumber: 100 };

      // Act
      const result = getRemainingOrCount(booklet);

      // Assert
      expect(result).toBe(0);
    });

    it("should return 0 for corrupted state (nextNumber >> endNumber)", () => {
      // Arrange
      const booklet = { nextNumber: 200, endNumber: 100 };

      // Act
      const result = getRemainingOrCount(booklet);

      // Assert
      expect(result).toBe(0);
    });

    it("should handle booklet starting from 1", () => {
      // Arrange - 1 to 50 = 50 OR numbers
      const booklet = { nextNumber: 1, endNumber: 50 };

      // Act
      const result = getRemainingOrCount(booklet);

      // Assert
      expect(result).toBe(50);
    });
  });

  describe("Booklet State Transitions", () => {
    // Simulates payment posting flow
    interface BookletState {
      nextNumber: number;
      endNumber: number;
      status: "active" | "exhausted" | "voided" | "inactive";
    }

    function simulatePaymentPost(
      booklet: BookletState
    ): { orAssigned: number; newState: BookletState } | { error: string } {
      // Guard: Check if booklet can be used
      if (booklet.status !== "active") {
        return { error: `Booklet is ${booklet.status}, cannot use` };
      }
      if (booklet.nextNumber > booklet.endNumber) {
        return { error: "No OR numbers available" };
      }

      // Consume current OR number
      const orAssigned = booklet.nextNumber;
      const newNextNumber = booklet.nextNumber + 1;
      const newStatus: "active" | "exhausted" =
        newNextNumber > booklet.endNumber ? "exhausted" : "active";

      return {
        orAssigned,
        newState: {
          ...booklet,
          nextNumber: newNextNumber,
          status: newStatus,
        },
      };
    }

    it("should increment nextNumber after payment", () => {
      // Arrange
      const booklet: BookletState = {
        nextNumber: 51,
        endNumber: 100,
        status: "active",
      };

      // Act
      const result = simulatePaymentPost(booklet);

      // Assert
      expect("orAssigned" in result).toBe(true);
      if ("orAssigned" in result) {
        expect(result.orAssigned).toBe(51);
        expect(result.newState.nextNumber).toBe(52);
      }
    });

    it("should stay active after consuming non-last OR", () => {
      // Arrange
      const booklet: BookletState = {
        nextNumber: 99,
        endNumber: 100,
        status: "active",
      };

      // Act
      const result = simulatePaymentPost(booklet);

      // Assert
      expect("newState" in result).toBe(true);
      if ("newState" in result) {
        expect(result.newState.status).toBe("active");
        expect(result.newState.nextNumber).toBe(100);
      }
    });

    it("should transition to exhausted after consuming last OR", () => {
      // Arrange
      const booklet: BookletState = {
        nextNumber: 100,
        endNumber: 100,
        status: "active",
      };

      // Act
      const result = simulatePaymentPost(booklet);

      // Assert
      expect("newState" in result).toBe(true);
      if ("newState" in result) {
        expect(result.newState.status).toBe("exhausted");
        expect(result.newState.nextNumber).toBe(101);
      }
    });

    it("should reject payment on exhausted booklet", () => {
      // Arrange
      const booklet: BookletState = {
        nextNumber: 101,
        endNumber: 100,
        status: "exhausted",
      };

      // Act
      const result = simulatePaymentPost(booklet);

      // Assert
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("exhausted");
      }
    });

    it("should reject payment on voided booklet", () => {
      // Arrange
      const booklet: BookletState = {
        nextNumber: 51,
        endNumber: 100,
        status: "voided",
      };

      // Act
      const result = simulatePaymentPost(booklet);

      // Assert
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("voided");
      }
    });

    it("should reject payment on inactive booklet", () => {
      // Arrange
      const booklet: BookletState = {
        nextNumber: 51,
        endNumber: 100,
        status: "inactive",
      };

      // Act
      const result = simulatePaymentPost(booklet);

      // Assert
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("inactive");
      }
    });

    it("should handle full booklet consumption sequence", () => {
      // Arrange - small booklet for testing (5 ORs)
      let booklet: BookletState = {
        nextNumber: 1,
        endNumber: 5,
        status: "active",
      };
      const assignedOrNumbers: number[] = [];

      // Act - consume all 5 OR numbers
      for (let i = 0; i < 5; i++) {
        const result = simulatePaymentPost(booklet);
        expect("orAssigned" in result).toBe(true);
        if ("orAssigned" in result) {
          assignedOrNumbers.push(result.orAssigned);
          booklet = result.newState;
        }
      }

      // Assert
      expect(assignedOrNumbers).toEqual([1, 2, 3, 4, 5]);
      expect(booklet.status).toBe("exhausted");
      expect(booklet.nextNumber).toBe(6);

      // Try one more payment - should fail
      const failedResult = simulatePaymentPost(booklet);
      expect("error" in failedResult).toBe(true);
    });

    it("should handle concurrent-like sequential payments correctly", () => {
      // Arrange - simulate rapid sequential payments
      let booklet: BookletState = {
        nextNumber: 98,
        endNumber: 100,
        status: "active",
      };
      const results: (
        | { orAssigned: number; newState: BookletState }
        | { error: string }
      )[] = [];

      // Act - 5 payment attempts (only 3 should succeed)
      for (let i = 0; i < 5; i++) {
        const result = simulatePaymentPost(booklet);
        results.push(result);
        if ("newState" in result) {
          booklet = result.newState;
        }
      }

      // Assert
      // First 3 should succeed (98, 99, 100)
      expect("orAssigned" in results[0]).toBe(true);
      expect("orAssigned" in results[1]).toBe(true);
      expect("orAssigned" in results[2]).toBe(true);

      // Last 2 should fail (exhausted)
      expect("error" in results[3]).toBe(true);
      expect("error" in results[4]).toBe(true);

      if ("orAssigned" in results[0]) expect(results[0].orAssigned).toBe(98);
      if ("orAssigned" in results[1]) expect(results[1].orAssigned).toBe(99);
      if ("orAssigned" in results[2]) expect(results[2].orAssigned).toBe(100);
    });
  });

  describe("OR Number Assignment", () => {
    function formatOrNumber(prefix: string, sequence: number): string {
      return `${prefix} ${String(sequence).padStart(5, "0")}`;
    }

    it("should format OR number with prefix and padded sequence", () => {
      expect(formatOrNumber("AK", 51)).toBe("AK 00051");
      expect(formatOrNumber("AK", 1)).toBe("AK 00001");
      expect(formatOrNumber("AK", 99999)).toBe("AK 99999");
    });

    it("should generate sequential OR numbers for a booklet", () => {
      // Arrange
      const prefix = "AK";
      let nextNumber = 51;
      const endNumber = 55;
      const assignedOrNumbers: string[] = [];

      // Act
      while (nextNumber <= endNumber) {
        assignedOrNumbers.push(formatOrNumber(prefix, nextNumber));
        nextNumber++;
      }

      // Assert
      expect(assignedOrNumbers).toEqual([
        "AK 00051",
        "AK 00052",
        "AK 00053",
        "AK 00054",
        "AK 00055",
      ]);
    });
  });

  describe("Booklet Boundary Values", () => {
    describe("minimum values", () => {
      it("should handle booklet starting at 1", () => {
        const result = calculateNewBookletStatus(1, 50);
        expect(result).toBe("active");
      });

      it("should exhaust when consuming OR 50 in 1-50 booklet", () => {
        const result = calculateNewBookletStatus(50, 50);
        expect(result).toBe("exhausted");
      });
    });

    describe("maximum values", () => {
      it("should handle booklet at maximum range (99950-99999)", () => {
        const result = calculateNewBookletStatus(99950, 99999);
        expect(result).toBe("active");
      });

      it("should exhaust at maximum OR number 99999", () => {
        const result = calculateNewBookletStatus(99999, 99999);
        expect(result).toBe("exhausted");
      });
    });

    describe("standard ranges", () => {
      const testCases = [
        { start: 1, end: 50, name: "1-50" },
        { start: 51, end: 100, name: "51-100" },
        { start: 101, end: 150, name: "101-150" },
        { start: 500, end: 549, name: "500-549" },
        { start: 1000, end: 1049, name: "1000-1049" },
      ];

      testCases.forEach(({ start, end, name }) => {
        it(`should handle standard booklet range ${name}`, () => {
          // First OR should keep active
          expect(calculateNewBookletStatus(start, end)).toBe("active");

          // Middle OR should keep active
          const middle = Math.floor((start + end) / 2);
          expect(calculateNewBookletStatus(middle, end)).toBe("active");

          // Second to last should keep active
          expect(calculateNewBookletStatus(end - 1, end)).toBe("active");

          // Last OR should exhaust
          expect(calculateNewBookletStatus(end, end)).toBe("exhausted");
        });
      });
    });
  });

  describe("LockedReceiptBooklet Type Compatibility", () => {
    it("should work with LockedReceiptBooklet interface", () => {
      // Arrange
      const lockedBooklet: LockedReceiptBooklet = {
        id: "booklet-uuid-123",
        series: "AK-00051-00100",
        prefix: "AK",
        startNumber: 51,
        endNumber: 100,
        nextNumber: 75,
        status: "active",
        createdAt: new Date(),
        createdBy: "user-123",
        updatedAt: new Date(),
        updatedBy: "user-123",
      };

      // Act
      const hasAvailable = hasAvailableOrNumbers(lockedBooklet);
      const remaining = getRemainingOrCount(lockedBooklet);
      const newStatus = calculateNewBookletStatus(
        lockedBooklet.nextNumber,
        lockedBooklet.endNumber
      );

      // Assert
      expect(hasAvailable).toBe(true);
      expect(remaining).toBe(26); // 100 - 75 + 1 = 26
      expect(newStatus).toBe("active");
    });

    it("should detect exhausted state from LockedReceiptBooklet", () => {
      // Arrange
      const exhaustedBooklet: LockedReceiptBooklet = {
        id: "booklet-uuid-456",
        series: "BK-00001-00050",
        prefix: "BK",
        startNumber: 1,
        endNumber: 50,
        nextNumber: 51, // Past end
        status: "exhausted",
        createdAt: new Date(),
        createdBy: "user-123",
        updatedAt: new Date(),
        updatedBy: "user-123",
      };

      // Act
      const hasAvailable = hasAvailableOrNumbers(exhaustedBooklet);
      const remaining = getRemainingOrCount(exhaustedBooklet);

      // Assert
      expect(hasAvailable).toBe(false);
      expect(remaining).toBe(0);
    });
  });

  describe("Manual Entry Impact on Booklet Exhaustion", () => {
    interface BookletState {
      nextNumber: number;
      endNumber: number;
      status: "active" | "exhausted";
      consumedOrNumbers: Set<number>;
    }

    function simulateManualOrConsumption(
      booklet: BookletState,
      manualOrSequence: number
    ): BookletState | { error: string } {
      // Check if OR is within booklet range
      if (
        manualOrSequence < booklet.nextNumber ||
        manualOrSequence > booklet.endNumber
      ) {
        return { error: "OR number not in valid range" };
      }

      // Check if OR already consumed
      if (booklet.consumedOrNumbers.has(manualOrSequence)) {
        return { error: "OR number already used" };
      }

      // Mark as consumed
      const newConsumed = new Set(booklet.consumedOrNumbers);
      newConsumed.add(manualOrSequence);

      // Advance nextNumber past all consumed sequential numbers
      let newNextNumber = booklet.nextNumber;
      while (
        newNextNumber <= booklet.endNumber &&
        newConsumed.has(newNextNumber)
      ) {
        newNextNumber++;
      }

      const newStatus = newNextNumber > booklet.endNumber ? "exhausted" : "active";

      return {
        nextNumber: newNextNumber,
        endNumber: booklet.endNumber,
        status: newStatus,
        consumedOrNumbers: newConsumed,
      };
    }

    it("should advance nextNumber when manual entry consumes current OR", () => {
      // Arrange
      const booklet: BookletState = {
        nextNumber: 51,
        endNumber: 100,
        status: "active",
        consumedOrNumbers: new Set(),
      };

      // Act - manually enter OR 51 (current next)
      const result = simulateManualOrConsumption(booklet, 51);

      // Assert
      expect("nextNumber" in result).toBe(true);
      if ("nextNumber" in result) {
        expect(result.nextNumber).toBe(52);
        expect(result.consumedOrNumbers.has(51)).toBe(true);
      }
    });

    it("should not advance nextNumber when manual entry uses future OR", () => {
      // Arrange
      const booklet: BookletState = {
        nextNumber: 51,
        endNumber: 100,
        status: "active",
        consumedOrNumbers: new Set(),
      };

      // Act - manually enter OR 60 (future)
      const result = simulateManualOrConsumption(booklet, 60);

      // Assert
      expect("nextNumber" in result).toBe(true);
      if ("nextNumber" in result) {
        // nextNumber stays at 51 since OR 51 is still available
        expect(result.nextNumber).toBe(51);
        expect(result.consumedOrNumbers.has(60)).toBe(true);
      }
    });

    it("should advance past gap when sequential ORs are consumed", () => {
      // Arrange - ORs 51, 52, 53 already consumed
      const booklet: BookletState = {
        nextNumber: 51,
        endNumber: 100,
        status: "active",
        consumedOrNumbers: new Set([51, 52, 53]),
      };

      // Act - consume OR 54 to close the gap
      // First, simulate the booklet state properly
      let state: BookletState = {
        nextNumber: 51,
        endNumber: 100,
        status: "active",
        consumedOrNumbers: new Set(),
      };

      // Consume 51, 52, 53 in order
      for (const or of [51, 52, 53]) {
        const result = simulateManualOrConsumption(state, or);
        if ("nextNumber" in result) {
          state = result;
        }
      }

      // Assert
      expect(state.nextNumber).toBe(54);
    });

    it("should exhaust booklet when all ORs consumed via manual entry", () => {
      // Arrange - small booklet for testing
      let booklet: BookletState = {
        nextNumber: 1,
        endNumber: 3,
        status: "active",
        consumedOrNumbers: new Set(),
      };

      // Act - consume all ORs in random order
      const consumeOrder = [2, 1, 3];
      for (const or of consumeOrder) {
        const result = simulateManualOrConsumption(booklet, or);
        if ("nextNumber" in result) {
          booklet = result;
        }
      }

      // Assert
      expect(booklet.status).toBe("exhausted");
      expect(booklet.consumedOrNumbers.size).toBe(3);
    });
  });
});
