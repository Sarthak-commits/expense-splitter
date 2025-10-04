import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { computeEqualSplits } from "../src/lib/split";

describe("computeEqualSplits", () => {
  it("splits equally and sums to original (2 members)", () => {
    const amount = new Prisma.Decimal("10.00");
    const members = ["u1", "u2"];
    const splits = computeEqualSplits(amount, members);
    const sum = splits.reduce((acc, s) => acc.plus(s.amount), new Prisma.Decimal(0));
    expect(sum.toFixed(2)).toBe("10.00");
    expect(splits[0].amount.toFixed(2)).toBe("5.00");
    expect(splits[1].amount.toFixed(2)).toBe("5.00");
  });

  it("distributes remainder by cents (3 members, 10.00)", () => {
    const amount = new Prisma.Decimal("10.00");
    const splits = computeEqualSplits(amount, ["a", "b", "c"]);
    const values = splits.map((s) => parseFloat(s.amount.toString()));
    const sum = values.reduce((a, b) => a + b, 0);
    expect(sum.toFixed(2)).toBe("10.00");
    const max = Math.max(...values);
    const min = Math.min(...values);
    expect(max - min <= 0.01).toBe(true);
  });
});