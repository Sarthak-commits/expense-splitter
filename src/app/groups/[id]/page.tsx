import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import ExpenseForm from "@/components/ExpenseForm";
import { Prisma } from "@prisma/client";

export default async function GroupDetailPage({ params, searchParams }: { params: { id: string }, searchParams?: { cursor?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");
  const userId = (session.user as any).id as string;
  const groupId = params.id;

  // Ensure requester has access (creator or member)
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [
        { createdById: userId },
        { members: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      name: true,
      createdById: true,
      members: {
        select: {
          role: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!group) {
    notFound();
  }

  const PAGE_SIZE = 20;
  const cursor = searchParams?.cursor;
  const expensesQ = await prisma.expense.findMany({
    where: { groupId },
    select: {
      id: true,
      description: true,
      amount: true,
      currency: true,
      date: true,
      createdAt: true,
      paidBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = expensesQ.length > PAGE_SIZE;
  const expenses = hasMore ? expensesQ.slice(0, PAGE_SIZE) : expensesQ;
  const nextCursor = hasMore ? expenses[expenses.length - 1]?.id : undefined;

  // Compute basic balances for all members: paid - owed, adjusted by settlements
  const memberIds = group.members.map((m) => m.user.id);
  const zero = new Prisma.Decimal(0);
  const net: Record<string, Prisma.Decimal> = Object.fromEntries(
    memberIds.map((id) => [id, zero])
  );

  const expensesAll = await prisma.expense.findMany({
    where: { groupId },
    select: { paidById: true, amount: true },
  });
  for (const e of expensesAll) {
    if (!net[e.paidById]) net[e.paidById] = zero;
    net[e.paidById] = net[e.paidById].plus(e.amount);
  }

  const splitsAll = await prisma.expenseSplit.findMany({
    where: { expense: { groupId } },
    select: { userId: true, amount: true },
  });
  for (const s of splitsAll) {
    if (!net[s.userId]) net[s.userId] = zero;
    net[s.userId] = net[s.userId].minus(s.amount);
  }

  const settlements = await prisma.settlement.findMany({
    where: { groupId },
    select: { fromUserId: true, toUserId: true, amount: true },
  });
  for (const st of settlements) {
    if (!net[st.fromUserId]) net[st.fromUserId] = zero;
    if (!net[st.toUserId]) net[st.toUserId] = zero;
    // Payment from A to B reduces B's receivable and reduces A's payable
    net[st.fromUserId] = net[st.fromUserId].plus(st.amount);
    net[st.toUserId] = net[st.toUserId].minus(st.amount);
  }

  const balances = group.members.map((m) => {
    const uid = m.user.id;
    const value = net[uid] ?? zero;
    const rounded = new Prisma.Decimal(value.toFixed(2));
    return { user: m.user, amount: rounded };
  });

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{group.name}</h1>
        <Link href="/groups" className="underline">Back to groups</Link>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-2">Members</h2>
        <ul className="space-y-1">
          {group.members.map((m) => (
            <li key={m.user.id} className="text-sm">
              <span className="font-medium">{m.user.name || m.user.email}</span>
              <span className="text-gray-600"> — {m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Add expense</h2>
        {/* client-side form */}
        {/* @ts-expect-error Server Component to Client Component boundary */}
        <ExpenseForm groupId={group.id} />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Expenses</h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-gray-600">No expenses yet. Add one to get started.</p>
        ) : (
          <ul className="divide-y border rounded">
            {expenses.map((e) => (
              <li key={e.id} className="p-3 text-sm flex items-center justify-between">
                <div>
                  <div className="font-medium">{e.description}</div>
                  <div className="text-gray-600">Paid by {e.paidBy.name || e.paidBy.email}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono">{e.amount.toString()} {e.currency}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {hasMore && nextCursor && (
          <div className="mt-3">
            <Link href={`/groups/${group.id}?cursor=${nextCursor}`} className="underline">Load more</Link>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Balances</h2>
        <ul className="space-y-1">
          {balances.map(({ user, amount }) => {
            const n = parseFloat(amount.toString());
            const label = Math.abs(n) < 0.01
              ? "settled"
              : n > 0
              ? `is owed ${amount.toFixed(2)}`
              : `owes ${(amount.abs()).toFixed(2)}`;
            return (
              <li key={user.id} className="text-sm">
                <span className="font-medium">{user.name || user.email}</span>
                <span className="text-gray-700"> — {label}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-gray-500 mt-2">Positive balances mean the user is owed money; negative means the user owes.</p>
      </section>
    </div>
  );
}
