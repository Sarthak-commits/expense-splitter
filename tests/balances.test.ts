import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { computeBalances } from "../src/lib/balances";

const D = (s: string) => new Prisma.Decimal(s);

describe("computeBalances", () => {
  it("computes net balances from expenses, splits, and settlements", () => {
    const members = ["alice", "bob", "carol"];
    const expenses = [
      { paidById: "alice", amount: D("30.00") },
      { paidById: "bob", amount: D("15.00") },
    ];
    const splits = [
      { userId: "alice", amount: D("15.00") },
      { userId: "bob", amount: D("15.00") },
      { userId: "carol", amount: D("15.00") },
    ];
    const settlements = [
      { fromUserId: "bob", toUserId: "alice", amount: D("5.00") },
    ];

    const net = computeBalances(members, expenses, splits, settlements);
    // Paid: alice +30, bob +15; Owed: alice -15, bob -15, carol -15; Settlement: bob +5, alice -5
    expect(net["alice"].toFixed(2)).toBe("10.00"); // 30 - 15 - 5
    expect(net["bob"].toFixed(2)).toBe("5.00");   // 15 - 15 + 5
    expect(net["carol"].toString()).toBe("-15");  // 0 - 15
  });
});