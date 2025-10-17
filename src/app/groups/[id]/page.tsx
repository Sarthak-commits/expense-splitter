import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import ExpenseForm from "@/components/ExpenseForm";
import MemberManager from "@/components/MemberManager";
import SettlementForm from "@/components/SettlementForm";
import ExpenseActions from "@/components/ExpenseActions";
import BalanceDisplay from "@/components/BalanceDisplay";
import ExpenseList from "@/components/ExpenseList";
import { Prisma } from "@prisma/client";
import { computeBalances } from "@/lib/balances";

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
  const expensesRaw = hasMore ? expensesQ.slice(0, PAGE_SIZE) : expensesQ;
  const expenses = expensesRaw.map((e) => ({
    ...e,
    amount: e.amount.toString(),
    date: e.date instanceof Date ? e.date.toISOString() : (e.date as any),
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : (e.createdAt as any),
  }));
  const nextCursor = hasMore ? expenses[expenses.length - 1]?.id : undefined;

  // Compute basic balances for all members: paid - owed, adjusted by settlements
  const memberIds = group.members.map((m) => m.user.id);

  const expensesAll = await prisma.expense.findMany({
    where: { groupId },
    select: { paidById: true, amount: true },
  });
  const splitsAll = await prisma.expenseSplit.findMany({
    where: { expense: { groupId } },
    select: { userId: true, amount: true },
  });
  const settlements = await prisma.settlement.findMany({
    where: { groupId },
    select: { fromUserId: true, toUserId: true, amount: true },
  });

  const net = computeBalances(memberIds, expensesAll, splitsAll, settlements);
  const balances = group.members.map((m) => {
    const uid = m.user.id;
    const value = net[uid] ?? new Prisma.Decimal(0);
    const rounded = new Prisma.Decimal(value.toFixed(2));
    return { user: m.user, amount: rounded };
  });

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">{group.name}</h1>
        <Link 
          href="/groups" 
          className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          ← Back to groups
        </Link>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-4">👥 Members</h2>
        
        {/* Mobile-friendly member list */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {group.members.map((m) => (
            <div key={m.user.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                {(m.user.name || m.user.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {m.user.name || m.user.email}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-600">{m.user.email}</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {m.role}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Member Management */}
        <MemberManager
          groupId={group.id}
          ownerUserId={group.createdById}
          currentUserId={userId}
          members={group.members.map((m) => ({
            userId: m.user.id,
            name: m.user.name,
            email: m.user.email!,
            role: m.role,
          }))}
        />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-4">➕ Add New Expense</h2>
        <div className="bg-gray-50 rounded-lg p-4">
          <ExpenseForm 
            groupId={group.id} 
            members={group.members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email! }))} 
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-4">💸 Expenses</h2>
        <ExpenseList
          groupId={group.id}
          initialExpenses={expenses}
          hasMore={hasMore}
          nextCursor={nextCursor}
          currentUserId={userId}
          groupCreatorId={group.createdById}
          members={group.members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email! }))}
        />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-4">💰 Balances & Settlements</h2>
        <BalanceDisplay
          groupId={group.id}
          balances={balances}
          currentUserId={userId}
          onSettlementRecorded={() => {
            // This would ideally trigger a refresh, but for now we'll rely on manual refresh
            // In a real app, you might want to use a state management solution
          }}
        />
        
        <div className="mt-6">
          <h3 className="text-md font-medium mb-3">⚙️ Manual Settlement Recording</h3>
          <SettlementForm
            groupId={group.id}
            currentUserId={userId}
            members={group.members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email! }))}
            balances={balances}
          />
        </div>
      </section>
    </div>
  );
}
