import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export default async function GroupDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");
  const userId = (session.user as any).id as string;
  const groupId = params.id;

  // Fetch the group only if the user is the creator or a member
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
      expenses: {
        select: {
          id: true,
          description: true,
          amount: true,
          currency: true,
          date: true,
          paidBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { date: "desc" },
        take: 10,
      },
    },
  });

  if (!group) {
    notFound();
  }

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
        <h2 className="text-lg font-medium mb-2">Recent expenses</h2>
        {group.expenses.length === 0 ? (
          <p className="text-sm text-gray-600">No expenses yet. Add one to get started.</p>
        ) : (
          <ul className="divide-y border rounded">
            {group.expenses.map((e) => (
              <li key={e.id} className="p-3 text-sm flex items-center justify-between">
                <div>
                  <div className="font-medium">{e.description}</div>
                  <div className="text-gray-600">Paid by {e.paidBy.name || e.paidBy.email}</div>
                </div>
                <div className="font-mono">
                  {e.amount.toString()} {e.currency}
                </div>
              </li>
            ))}
          </ul>
        )}
        {/* Placeholder button for future expense creation */}
        <div className="mt-3">
          <button className="bg-black text-white rounded px-4 py-2 opacity-60 cursor-not-allowed" disabled>
            Add expense (coming soon)
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Balances</h2>
        <p className="text-sm text-gray-600">Balance calculations coming soon.</p>
      </section>
    </div>
  );
}
