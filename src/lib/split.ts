import { Prisma } from "@prisma/client";

// Compute equal splits rounded to 2 decimals such that the sum equals the original amount.
export function computeEqualSplits(amount: Prisma.Decimal, memberIds: string[]) {
  if (memberIds.length === 0) throw new Error("No members to split with");
  const n = new Prisma.Decimal(memberIds.length);
  const base = amount.dividedBy(n);
  const baseRounded = new Prisma.Decimal(base.toFixed(2));
  const totalRounded = baseRounded.mul(n);
  let remainder = amount.minus(totalRounded);

  return memberIds.map((uid) => {
    let amt = baseRounded;
    if (!remainder.isZero()) {
      const step = new Prisma.Decimal("0.01");
      amt = amt.plus(step);
      remainder = remainder.minus(step);
      if (remainder.lessThan(0)) remainder = new Prisma.Decimal(0);
    }
    return { userId: uid, amount: amt } as const;
  });
}

// Compute splits from percentages, rounded to cents and total preserved
export function computePercentSplits(
  amount: Prisma.Decimal,
  entries: { userId: string; percent: number }[]
) {
  if (!entries.length) throw new Error("No members to split with");
  const raw = entries.map(({ userId, percent }) => {
    const pct = new Prisma.Decimal(percent.toString());
    const val = amount.mul(pct).dividedBy(new Prisma.Decimal(100));
    const rounded = new Prisma.Decimal(val.toFixed(2));
    const frac = val.minus(rounded).abs().toNumber();
    return { userId, rounded, frac };
  });
  const sumRounded = raw.reduce((acc, r) => acc.plus(r.rounded), new Prisma.Decimal(0));
  let remainder = amount.minus(sumRounded);
  raw.sort((a, b) => b.frac - a.frac);
  for (let i = 0; !remainder.isZero() && i < raw.length; i++) {
    const step = new Prisma.Decimal(remainder.greaterThan(0) ? "0.01" : "-0.01");
    raw[i].rounded = raw[i].rounded.plus(step);
    remainder = remainder.minus(step);
    if (i === raw.length - 1 && !remainder.isZero()) i = -1;
  }
  return raw.map((r) => ({ userId: r.userId, amount: r.rounded }));
}
