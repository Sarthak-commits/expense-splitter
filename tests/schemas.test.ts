import { describe, it, expect } from "vitest";
import { currencySchema, amountInputSchema } from "../src/lib/schemas";

describe("schemas", () => {
  it("accepts USD and rejects others", () => {
    expect(currencySchema.safeParse("USD").success).toBe(true);
    expect(currencySchema.safeParse("usd").success).toBe(true); // transforms to uppercase then checks
    expect(currencySchema.safeParse("EUR").success).toBe(false);
  });

  it("validates amount with up to 2 decimals and > 0", () => {
    expect(amountInputSchema.safeParse("10").success).toBe(true);
    expect(amountInputSchema.safeParse("10.00").success).toBe(true);
    expect(amountInputSchema.safeParse(12).success).toBe(true);
    expect(amountInputSchema.safeParse("0").success).toBe(false);
    expect(amountInputSchema.safeParse("-1").success).toBe(false);
    expect(amountInputSchema.safeParse("1.234").success).toBe(false);
    expect(amountInputSchema.safeParse("foo").success).toBe(false);
  });
});