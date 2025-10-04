"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated" && !!session?.user;

  return (
    <header className="border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-5xl mx-auto h-12 px-4 flex items-center justify-between">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="font-medium hover:underline">
            Expense Splitter
          </Link>
          <Link href="/groups" className="hover:underline">
            Groups
          </Link>
        </nav>
        <div className="text-sm">
          {isAuthed ? (
            <div className="flex items-center gap-3">
              <span className="text-gray-700 hidden sm:inline">
                {session.user?.name || session.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="px-3 py-1.5 rounded border hover:bg-gray-50"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/auth/login" className="hover:underline">
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="px-3 py-1.5 rounded border hover:bg-gray-50"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
