import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const isAuthed = !!session?.user;
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Split expenses,
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600"> stay friends</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Track shared expenses, split bills fairly, and settle up easily with roommates, 
            friends, and travel companions.
          </p>
          
          {!isAuthed ? (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                href="/auth/register"
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-200 transform transition-all duration-200 hover:scale-105 shadow-lg"
              >
                Get Started Free
              </Link>
              <Link 
                href="/auth/login"
                className="px-8 py-4 text-gray-600 hover:text-blue-600 font-semibold border-2 border-gray-300 hover:border-blue-500 rounded-xl transition-all duration-200"
              >
                Sign In
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-auto">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">👋</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Welcome back, {session.user?.name || "there"}!
                </h2>
                <p className="text-gray-600 mb-6">
                  Ready to manage your shared expenses?
                </p>
              </div>
              <Link 
                href="/groups"
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-200 transform transition-all duration-200 hover:scale-105 text-center block"
              >
                View My Groups
              </Link>
            </div>
          )}
        </div>
        
        {/* Feature highlights */}
        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💰</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Smart Splitting</h3>
            <p className="text-gray-600">Automatically calculate fair splits for equal, custom, or percentage-based expenses.</p>
          </div>
          
          <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🧮</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Balance Tracking</h3>
            <p className="text-gray-600">Keep track of who owes what with real-time balance calculations and settlement suggestions.</p>
          </div>
          
          <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">👥</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Group Management</h3>
            <p className="text-gray-600">Create groups for different occasions - roommates, trips, dinners, or any shared expenses.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
