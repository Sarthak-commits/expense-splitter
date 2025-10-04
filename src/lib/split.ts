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