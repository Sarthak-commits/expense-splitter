import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeBalances } from "@/lib/balances";
import { Prisma } from "@prisma/client";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const groupId = params.id;

  // Verify membership
  const isMember = await prisma.group.findFirst({
    where: { id: groupId, OR: [{ createdById: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } });
  const memberIds = members.map((m) => m.userId);
  const expenses = await prisma.expense.findMany({ where: { groupId }, select: { paidById: true, amount: true } });
  const splits = await prisma.expenseSplit.findMany({ where: { expense: { groupId } }, select: { userId: true, amount: true } });
  const settlements = await prisma.settlement.findMany({ where: { groupId }, select: { fromUserId: true, toUserId: true, amount: true } });

  const net = computeBalances(memberIds, expenses, splits, settlements);
  const creditors: { userId: string; amt: Prisma.Decimal }[] = [];
  const debtors: { userId: string; amt: Prisma.Decimal }[] = [];
  for (const uid of memberIds) {
    const val = net[uid] ?? new Prisma.Decimal(0);
    const n = new Prisma.Decimal(val.toFixed(2));
    if (n.greaterThan(0.009)) creditors.push({ userId: uid, amt: n });
    else if (n.lessThan(-0.009)) debtors.push({ userId: uid, amt: n.abs() });
  }
  creditors.sort((a, b) => b.amt.comparedTo(a.amt));
  debtors.sort((a, b) => b.amt.comparedTo(a.amt));
  const suggestions: { fromUserId: string; toUserId: string; amount: string }[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Prisma.Decimal.min(debtors[i].amt, creditors[j].amt);
    suggestions.push({ fromUserId: debtors[i].userId, toUserId: creditors[j].userId, amount: pay.toFixed(2) });
    debtors[i].amt = debtors[i].amt.minus(pay);
    creditors[j].amt = creditors[j].amt.minus(pay);
    if (debtors[i].amt.lessThan(0.01)) i++;
    if (creditors[j].amt.lessThan(0.01)) j++;
  }

  return NextResponse.json({ suggestions });
}