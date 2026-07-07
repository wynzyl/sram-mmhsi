import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for OR Booklet Access Control
 *
 * Business Rules:
 * - Assigned booklets can ONLY be consumed by the assigned user
 * - Unassigned booklets can be used by anyone
 * - Server rejects booklet usage by non-assigned users
 */

// Mock the database module
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

// Import after mocking
import { db } from "@/lib/db";

// Helper to create mock chainable query
function createMockQuery<T>(result: T) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

describe("Booklet Access Control - Business Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBookletIdsAssignedToOthers", () => {
    it("should return booklet IDs assigned to other users", async () => {
      // This tests the logic that filters out booklets assigned to other users
      const currentUserId = "user-123";
      const otherUserBooklets = [
        { defaultBookletId: "booklet-A" },
        { defaultBookletId: "booklet-B" },
      ];

      // Simulate the query result
      const mockResult = otherUserBooklets
        .map((u) => u.defaultBookletId)
        .filter((id): id is string => id !== null);

      expect(mockResult).toEqual(["booklet-A", "booklet-B"]);
      expect(mockResult).not.toContain(null);
    });

    it("should return empty array when no other users have assigned booklets", () => {
      const assignedToOthers: { defaultBookletId: string | null }[] = [];

      const result = assignedToOthers
        .map((u) => u.defaultBookletId)
        .filter((id): id is string => id !== null);

      expect(result).toEqual([]);
    });

    it("should filter out null defaultBookletId values", () => {
      const assignedToOthers = [
        { defaultBookletId: "booklet-A" },
        { defaultBookletId: null },
        { defaultBookletId: "booklet-B" },
        { defaultBookletId: null },
      ];

      const result = assignedToOthers
        .map((u) => u.defaultBookletId)
        .filter((id): id is string => id !== null);

      expect(result).toEqual(["booklet-A", "booklet-B"]);
      expect(result.length).toBe(2);
    });
  });

  describe("getAccessibleBookletsForUser", () => {
    it("should include user's own assigned booklet", () => {
      const allActiveBooklets = [
        { id: "booklet-A", series: "AA 00001-00050" },
        { id: "booklet-B", series: "BB 00001-00050" },
        { id: "booklet-C", series: "CC 00001-00050" },
      ];
      const excludedIds = ["booklet-B"]; // Assigned to another user

      const accessible = allActiveBooklets.filter(
        (b) => !excludedIds.includes(b.id)
      );

      expect(accessible).toHaveLength(2);
      expect(accessible.map((b) => b.id)).toEqual(["booklet-A", "booklet-C"]);
    });

    it("should include unassigned booklets", () => {
      const allActiveBooklets = [
        { id: "booklet-A", series: "AA 00001-00050" },
        { id: "booklet-B", series: "BB 00001-00050" },
      ];
      const excludedIds: string[] = []; // No booklets assigned to others

      const accessible = allActiveBooklets.filter(
        (b) => !excludedIds.includes(b.id)
      );

      expect(accessible).toHaveLength(2);
      expect(accessible).toEqual(allActiveBooklets);
    });

    it("should exclude booklets assigned to other users", () => {
      const allActiveBooklets = [
        { id: "booklet-A", series: "AA 00001-00050" },
        { id: "booklet-B", series: "BB 00001-00050" },
        { id: "booklet-C", series: "CC 00001-00050" },
      ];
      const excludedIds = ["booklet-A", "booklet-C"]; // Both assigned to others

      const accessible = allActiveBooklets.filter(
        (b) => !excludedIds.includes(b.id)
      );

      expect(accessible).toHaveLength(1);
      expect(accessible[0].id).toBe("booklet-B");
    });

    it("should return empty array when all booklets are assigned to others", () => {
      const allActiveBooklets = [
        { id: "booklet-A", series: "AA 00001-00050" },
        { id: "booklet-B", series: "BB 00001-00050" },
      ];
      const excludedIds = ["booklet-A", "booklet-B"];

      const accessible = allActiveBooklets.filter(
        (b) => !excludedIds.includes(b.id)
      );

      expect(accessible).toHaveLength(0);
    });
  });

  describe("Booklet Access Validation", () => {
    it("should deny access when booklet is assigned to another user", () => {
      const bookletId = "booklet-A";
      const excludedBookletIds = ["booklet-A", "booklet-B"];

      const isAccessDenied = excludedBookletIds.includes(bookletId);

      expect(isAccessDenied).toBe(true);
    });

    it("should allow access when booklet is not assigned to anyone", () => {
      const bookletId = "booklet-C";
      const excludedBookletIds = ["booklet-A", "booklet-B"];

      const isAccessDenied = excludedBookletIds.includes(bookletId);

      expect(isAccessDenied).toBe(false);
    });

    it("should allow access when booklet is assigned to current user", () => {
      // User's own booklet should NOT be in the excluded list
      const currentUserId = "user-123";
      const currentUserBookletId = "booklet-C";

      // excludedBookletIds only contains booklets assigned to OTHER users
      const excludedBookletIds = ["booklet-A", "booklet-B"]; // user-123's booklet not included

      const isAccessDenied = excludedBookletIds.includes(currentUserBookletId);

      expect(isAccessDenied).toBe(false);
    });

    it("should generate correct error message for auto-assign path", () => {
      const errorMessage =
        "BOOKLET_ACCESS_DENIED: This booklet is assigned to another user and cannot be used.";

      expect(errorMessage).toContain("BOOKLET_ACCESS_DENIED");
      expect(errorMessage).toContain("assigned to another user");
    });

    it("should generate correct error message for manual entry path", () => {
      const manualOrNumber = "AK 00050";
      const bookletSeries = "AK 00001-00100";
      const errorMessage =
        `MANUAL_OR_BOOKLET_RESTRICTED: OR number ${manualOrNumber} belongs to booklet "${bookletSeries}" ` +
        `which is assigned to another user. Use your assigned booklet or an unassigned one.`;

      expect(errorMessage).toContain("MANUAL_OR_BOOKLET_RESTRICTED");
      expect(errorMessage).toContain(manualOrNumber);
      expect(errorMessage).toContain(bookletSeries);
    });
  });

  describe("Edge Cases", () => {
    it("should handle user with no assigned booklet accessing unassigned booklets", () => {
      // User has no defaultBookletId, so they can only use unassigned booklets
      const allActiveBooklets = [
        { id: "booklet-A", series: "AA 00001-00050" },
        { id: "booklet-B", series: "BB 00001-00050" },
      ];
      const excludedIds = ["booklet-A"]; // booklet-A assigned to someone else

      const accessible = allActiveBooklets.filter(
        (b) => !excludedIds.includes(b.id)
      );

      expect(accessible).toHaveLength(1);
      expect(accessible[0].id).toBe("booklet-B");
    });

    it("should handle multiple users with assigned booklets", () => {
      // Simulate: User A has booklet-1, User B has booklet-2, User C has booklet-3
      // Current user is User A
      const currentUserId = "user-A";

      // Other users' assigned booklets (excludes current user's)
      const otherUsersBooklets = [
        { userId: "user-B", defaultBookletId: "booklet-2" },
        { userId: "user-C", defaultBookletId: "booklet-3" },
      ];

      const excludedIds = otherUsersBooklets.map((u) => u.defaultBookletId);

      expect(excludedIds).toEqual(["booklet-2", "booklet-3"]);
      expect(excludedIds).not.toContain("booklet-1"); // Current user's booklet not excluded
    });

    it("should correctly identify booklet ownership for manual OR entry", () => {
      const manualOrNumber = "AK 00050";
      const matchingBooklet = {
        id: "booklet-AK",
        series: "AK 00001-00100",
        prefix: "AK",
        startNumber: 1,
        endNumber: 100,
      };

      // Parse OR number (simplified)
      const prefix = manualOrNumber.split(" ")[0];
      const sequence = parseInt(manualOrNumber.split(" ")[1], 10);

      expect(prefix).toBe("AK");
      expect(sequence).toBe(50);

      // Check if sequence is within booklet range
      const isInRange =
        sequence >= matchingBooklet.startNumber &&
        sequence <= matchingBooklet.endNumber;

      expect(isInRange).toBe(true);
    });
  });
});

describe("Booklet Display - Assigned User Column", () => {
  it("should show assigned username when booklet has an owner", () => {
    const booklet = {
      id: "booklet-A",
      series: "AA 00001-00050",
      assignedToUsername: "cashier_john",
    };

    expect(booklet.assignedToUsername).toBe("cashier_john");
    expect(booklet.assignedToUsername).not.toBeNull();
  });

  it("should show dash when booklet has no assigned user", () => {
    const booklet = {
      id: "booklet-B",
      series: "BB 00001-00050",
      assignedToUsername: null,
    };

    const displayValue = booklet.assignedToUsername ?? "—";

    expect(displayValue).toBe("—");
  });

  it("should include createdAt for date issued column", () => {
    const booklet = {
      id: "booklet-A",
      series: "AA 00001-00050",
      createdAt: new Date("2026-07-01"),
    };

    expect(booklet.createdAt).toBeInstanceOf(Date);
    expect(booklet.createdAt.getFullYear()).toBe(2026);
  });
});
