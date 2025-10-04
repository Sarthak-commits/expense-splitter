import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import CreateGroupForm from "@/components/CreateGroupForm";

export default async function GroupsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");
  const userId = (session.user as any).id as string;

  const groups = await prisma.group.findMany({
    where: {
      OR: [
        { createdById: userId },
        { members: { some: { userId } } },
      ],
    },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-4">Your groups</h1>
      <CreateGroupForm />
      <ul className="mt-6 space-y-2">
        {groups.map((g) => (
          <li key={g.id} className="border rounded p-3">
            <Link className="underline" href={`/groups/${g.id}`}>{g.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
