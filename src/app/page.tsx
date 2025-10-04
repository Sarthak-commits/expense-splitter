import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const isAuthed = !!session?.user;
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Expense Splitter</h1>
        <p className="text-sm text-gray-600 mb-6">Split expenses with friends, track balances, and settle up.</p>
        {!isAuthed ? (
          <div className="space-x-3">
            <Link className="underline" href="/auth/register">Create an account</Link>
            <Link className="underline" href="/auth/login">Sign in</Link>
          </div>
        ) : (
          <div className="space-x-3">
            <span>Hi, {session.user?.name || session.user?.email}</span>
            <Link className="underline" href="/groups">Go to your groups</Link>
          </div>
        )}
      </div>
    </div>
  );
}
