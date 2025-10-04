import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { computePercentSplits } from "../src/lib/split";

describe("computePercentSplits", () => {
  it("allocates rounded amounts summing to total", () => {
    const D = (s: string) => new Prisma.Decimal(s);
    const amount = D("100.00");
    const entries = [
      { userId: "a", percent: 33.34 },
      { userId: "b", percent: 33.33 },
      { userId: "c", percent: 33.33 },
    ];
    const splits = computePercentSplits(amount, entries);
    const sum = splits.reduce((acc, s) => acc.plus(s.amount), D("0"));
    expect(sum.toFixed(2)).toBe("100.00");
  });
});