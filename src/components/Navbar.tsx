"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated" && !!session?.user;

  return (
    <header className="border-b border-gray-200 bg-white shadow-sm">
      <div className="max-w-6xl mx-auto h-16 px-4 flex items-center justify-between">
        <nav className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
            💸 Expense Splitter
          </Link>
          {isAuthed && (
            <Link 
              href="/groups" 
              className="text-gray-600 hover:text-blue-600 font-medium transition-colors"
            >
              Groups
            </Link>
          )}
        </nav>
        
        <div>
          {isAuthed ? (
            <div className="flex items-center gap-4">
              <span className="text-gray-700 hidden sm:inline font-medium">
                {session.user?.name || session.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link 
                href="/auth/login" 
                className="px-4 py-2 text-gray-600 hover:text-blue-600 font-medium transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-sm"
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
