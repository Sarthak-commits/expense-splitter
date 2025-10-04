import { Prisma } from "@prisma/client";

export type ExpenseLike = { paidById: string; amount: Prisma.Decimal };
export type SplitLike = { userId: string; amount: Prisma.Decimal };
export type SettlementLike = { fromUserId: string; toUserId: string; amount: Prisma.Decimal };

export function computeBalances(
  memberIds: string[],
  expenses: ExpenseLike[],
  splits: SplitLike[],
  settlements: SettlementLike[]
) {
  const zero = new Prisma.Decimal(0);
  const net: Record<string, Prisma.Decimal> = Object.fromEntries(
    memberIds.map((id) => [id, zero])
  );

  for (const e of expenses) {
    net[e.paidById] = (net[e.paidById] ?? zero).plus(e.amount);
  }
  for (const s of splits) {
    net[s.userId] = (net[s.userId] ?? zero).minus(s.amount);
  }
  for (const st of settlements) {
    net[st.fromUserId] = (net[st.fromUserId] ?? zero).plus(st.amount);
    net[st.toUserId] = (net[st.toUserId] ?? zero).minus(st.amount);
  }

  return net;
}