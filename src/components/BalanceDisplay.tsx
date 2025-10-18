"use client";

import { useState, useEffect } from "react";

// Expense categories with display labels and icons (matching other components)
const EXPENSE_CATEGORIES = [
  { value: "FOOD", label: "🍽️ Food", shortLabel: "Food", color: "bg-red-100 text-red-800" },
  { value: "GROCERIES", label: "🛒 Groceries", shortLabel: "Groceries", color: "bg-green-100 text-green-800" },
  { value: "TRAVEL", label: "✈️ Travel", shortLabel: "Travel", color: "bg-blue-100 text-blue-800" },
  { value: "TRANSPORTATION", label: "🚗 Transport", shortLabel: "Transport", color: "bg-indigo-100 text-indigo-800" },
  { value: "ENTERTAINMENT", label: "🎬 Entertainment", shortLabel: "Entertainment", color: "bg-purple-100 text-purple-800" },
  { value: "SHOPPING", label: "🛍️ Shopping", shortLabel: "Shopping", color: "bg-pink-100 text-pink-800" },
  { value: "UTILITIES", label: "💡 Utilities", shortLabel: "Utilities", color: "bg-yellow-100 text-yellow-800" },
  { value: "HOUSING", label: "🏠 Housing", shortLabel: "Housing", color: "bg-orange-100 text-orange-800" },
  { value: "HEALTH", label: "🏥 Healthcare", shortLabel: "Health", color: "bg-teal-100 text-teal-800" },
  { value: "EDUCATION", label: "📚 Education", shortLabel: "Education", color: "bg-cyan-100 text-cyan-800" },
  { value: "GIFTS", label: "🎁 Gifts", shortLabel: "Gifts", color: "bg-rose-100 text-rose-800" },
  { value: "FEES", label: "📋 Fees", shortLabel: "Fees", color: "bg-gray-100 text-gray-800" },
  { value: "OTHER", label: "📦 Other", shortLabel: "Other", color: "bg-slate-100 text-slate-800" },
];

// Helper function to get category display info
function getCategoryInfo(category: string) {
  const cat = EXPENSE_CATEGORIES.find(c => c.value === category);
  return cat || { value: "OTHER", label: "📦 Other", shortLabel: "Other", color: "bg-slate-100 text-slate-800" };
}

// Interface for expense data
interface ExpenseData {
  id: string;
  description: string;
  amount: string; // Prisma Decimal as string
  currency: string;
  category: string;
  paidBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

// Interface for category spending summary
interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  topSpender?: {
    userId: string;
    name: string | null;
    email: string;
    amount: number;
  };
}

interface BalanceUser {
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  amount: any; // Prisma Decimal
}

interface SettlementSuggestion {
  fromUserId: string;
  fromName: string | null;
  fromEmail: string;
  toUserId: string;
  toName: string | null;
  toEmail: string;
  amount: string;
}

interface BalanceDisplayProps {
  groupId: string;
  balances: BalanceUser[];
  currentUserId: string;
  expenses?: ExpenseData[]; // Optional expense data for category insights
  onSettlementRecorded?: () => void;
}

export default function BalanceDisplay({ 
  groupId, 
  balances, 
  currentUserId, 
  expenses = [],
  onSettlementRecorded 
}: BalanceDisplayProps) {
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [recordingSettlement, setRecordingSettlement] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCategoryBreakdown, setShowCategoryBreakdown] = useState(false);

  // Calculate balance statistics
  const totalOwed = balances.reduce((sum, b) => {
    const amount = parseFloat(b.amount.toString());
    return sum + (amount > 0 ? amount : 0);
  }, 0);

  const totalOwes = balances.reduce((sum, b) => {
    const amount = parseFloat(b.amount.toString());
    return sum + (amount < 0 ? Math.abs(amount) : 0);
  }, 0);

  const settledCount = balances.filter(b => Math.abs(parseFloat(b.amount.toString())) < 0.01).length;
  const unsettledCount = balances.length - settledCount;

  // Calculate category spending breakdown
  const categorySpending: CategorySpending[] = (() => {
    if (!expenses.length) return [];
    
    const categoryTotals = new Map<string, {
      amount: number;
      count: number;
      spenders: Map<string, { amount: number; name: string | null; email: string; }>;
    }>();

    expenses.forEach(expense => {
      const category = expense.category || 'OTHER';
      const amount = parseFloat(expense.amount);
      const spenderId = expense.paidBy.id;
      
      if (!categoryTotals.has(category)) {
        categoryTotals.set(category, {
          amount: 0,
          count: 0,
          spenders: new Map()
        });
      }
      
      const categoryData = categoryTotals.get(category)!;
      categoryData.amount += amount;
      categoryData.count += 1;
      
      if (!categoryData.spenders.has(spenderId)) {
        categoryData.spenders.set(spenderId, {
          amount: 0,
          name: expense.paidBy.name,
          email: expense.paidBy.email
        });
      }
      
      categoryData.spenders.get(spenderId)!.amount += amount;
    });
    
    const totalSpent = Array.from(categoryTotals.values()).reduce((sum, cat) => sum + cat.amount, 0);
    
    return Array.from(categoryTotals.entries())
      .map(([category, data]) => {
        const topSpenderEntry = Array.from(data.spenders.entries())
          .sort(([,a], [,b]) => b.amount - a.amount)[0];
        
        return {
          category,
          amount: data.amount,
          percentage: totalSpent > 0 ? (data.amount / totalSpent) * 100 : 0,
          count: data.count,
          topSpender: topSpenderEntry ? {
            userId: topSpenderEntry[0],
            ...topSpenderEntry[1]
          } : undefined
        };
      })
      .sort((a, b) => b.amount - a.amount);
  })();

  const totalCategorySpending = categorySpending.reduce((sum, cat) => sum + cat.amount, 0);

  // Load settlement suggestions
  async function loadSuggestions() {
    if (unsettledCount === 0) return;
    
    setLoadingSuggestions(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/settlement-suggestions`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (err) {
      setError('Failed to load settlement suggestions');
    }
    setLoadingSuggestions(false);
  }

  // Auto-load suggestions when component mounts if there are unsettled balances
  useEffect(() => {
    if (unsettledCount > 0) {
      loadSuggestions();
    }
  }, [groupId, unsettledCount]);

  // Record a suggested settlement
  async function recordSuggestion(suggestion: SettlementSuggestion) {
    setRecordingSettlement(suggestion.fromUserId + '-' + suggestion.toUserId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/groups/${groupId}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromUserId: suggestion.fromUserId,
          toUserId: suggestion.toUserId,
          amount: suggestion.amount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to record settlement");
        return;
      }

      setSuccess(`Settlement recorded! ${suggestion.fromName || suggestion.fromEmail} paid ${suggestion.toName || suggestion.toEmail} $${suggestion.amount}`);
      
      // Refresh suggestions and notify parent
      await loadSuggestions();
      onSettlementRecorded?.();
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setRecordingSettlement(null);
    }
  }

  // Get balance color and status
  function getBalanceInfo(balance: BalanceUser) {
    const amount = parseFloat(balance.amount.toString());
    if (Math.abs(amount) < 0.01) {
      return {
        status: 'settled',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        icon: '✅',
        text: 'Settled'
      };
    } else if (amount > 0) {
      return {
        status: 'owed',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        icon: '💰',
        text: `Owed $${amount.toFixed(2)}`
      };
    } else {
      return {
        status: 'owes',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        icon: '💸',
        text: `Owes $${Math.abs(amount).toFixed(2)}`
      };
    }
  }

  return (
    <div className="space-y-4">
      {/* Balance Summary - Mobile Optimized */}
      <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
        <h3 className="font-medium text-gray-900 mb-3 text-sm sm:text-base">💰 Balance Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-gray-900">{balances.length}</div>
            <div className="text-xs sm:text-sm text-gray-600">Members</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-green-600">{settledCount}</div>
            <div className="text-xs sm:text-sm text-gray-600">Settled</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-amber-600">{unsettledCount}</div>
            <div className="text-xs sm:text-sm text-gray-600">Need Settlement</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">${totalOwed.toFixed(2)}</div>
            <div className="text-xs sm:text-sm text-gray-600">Outstanding</div>
          </div>
        </div>
      </div>

      {/* Category Spending Breakdown - Mobile Optimized */}
      {categorySpending.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-start sm:items-center justify-between mb-3 gap-2">
            <h4 className="font-medium text-purple-900 text-sm sm:text-base flex-1">
              📈 Spending by Category (${totalCategorySpending.toFixed(2)} total)
            </h4>
            <button
              onClick={() => setShowCategoryBreakdown(!showCategoryBreakdown)}
              className="text-xs sm:text-sm text-purple-600 hover:text-purple-800 px-2 py-1 rounded touch-manipulation"
            >
              {showCategoryBreakdown ? '⬆️' : '⬇️'}
            </button>
          </div>

          {showCategoryBreakdown && (
            <div className="space-y-3">
              {/* Top 3 Categories Overview - Always Visible */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {categorySpending.slice(0, 3).map((cat, index) => {
                  const categoryInfo = getCategoryInfo(cat.category);
                  const isCurrentUserTopSpender = cat.topSpender?.userId === currentUserId;
                  
                  return (
                    <div key={cat.category} className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${categoryInfo.color}`}>
                            {index + 1}. {categoryInfo.shortLabel}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">${cat.amount.toFixed(2)}</div>
                          <div className="text-xs text-gray-600">{cat.percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                      
                      {/* Visual Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            index === 0 ? 'bg-purple-500' : 
                            index === 1 ? 'bg-blue-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                        ></div>
                      </div>
                      
                      {/* Top Spender Info */}
                      {cat.topSpender && (
                        <div className="text-xs text-gray-600">
                          <span className={isCurrentUserTopSpender ? 'font-medium text-purple-700' : ''}>
                            Top: {cat.topSpender.name || cat.topSpender.email}
                            {isCurrentUserTopSpender && ' (You)'}
                          </span>
                          <span className="ml-1">${cat.topSpender.amount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* All Categories List - Collapsible */}
              {categorySpending.length > 3 && (
                <div className="space-y-2">
                  <p className="text-xs text-purple-700 font-medium">
                    All {categorySpending.length} Categories:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {categorySpending.slice(3).map((cat) => {
                      const categoryInfo = getCategoryInfo(cat.category);
                      const isCurrentUserTopSpender = cat.topSpender?.userId === currentUserId;
                      
                      return (
                        <div key={cat.category} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className={`text-xs px-2 py-1 rounded-full ${categoryInfo.color} whitespace-nowrap`}>
                              {categoryInfo.shortLabel}
                            </span>
                            {cat.topSpender && (
                              <span className="text-xs text-gray-600 truncate">
                                {isCurrentUserTopSpender ? 'You' : (cat.topSpender.name || cat.topSpender.email)}
                              </span>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-medium text-gray-900">${cat.amount.toFixed(2)}</div>
                            <div className="text-xs text-gray-600">{cat.percentage.toFixed(1)}%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Quick Insights */}
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                <p className="text-xs font-medium text-purple-900 mb-2">💡 Quick Insights:</p>
                <div className="space-y-1 text-xs text-purple-800">
                  {categorySpending[0] && (
                    <p>• Most spending in {getCategoryInfo(categorySpending[0].category).shortLabel} (${categorySpending[0].amount.toFixed(2)})</p>
                  )}
                  <p>• Average per category: ${(totalCategorySpending / categorySpending.length).toFixed(2)}</p>
                  <p>• Total expenses tracked: {categorySpending.reduce((sum, cat) => sum + cat.count, 0)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success/Error Messages */}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-700">✅ {success}</p>
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">❌ {error}</p>
        </div>
      )}

      {/* Settlement Suggestions - Mobile Optimized */}
      {unsettledCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-start sm:items-center justify-between mb-3 gap-2">
            <h4 className="font-medium text-blue-900 text-sm sm:text-base flex-1">🎯 Smart Settlement Suggestions</h4>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={loadSuggestions}
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded touch-manipulation"
                disabled={loadingSuggestions}
              >
                {loadingSuggestions ? 'Loading...' : '🔄'}
              </button>
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded touch-manipulation"
              >
                {showSuggestions ? '⬆️' : '⬇️'}
              </button>
            </div>
          </div>

          {showSuggestions && (
            <>
              {loadingSuggestions ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-blue-700 mt-2">Calculating optimal settlements...</p>
                </div>
              ) : suggestions.length === 0 ? (
                <p className="text-sm text-blue-700">🎉 All balances are optimally settled!</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-blue-700 mb-2">
                    These {suggestions.length} transactions will settle all balances:
                  </p>
                  {suggestions.map((suggestion, index) => {
                    const isRecording = recordingSettlement === suggestion.fromUserId + '-' + suggestion.toUserId;
                    const isCurrentUserInvolved = suggestion.fromUserId === currentUserId || suggestion.toUserId === currentUserId;
                    
                    return (
                      <div key={index} className={`p-3 rounded-lg border ${
                        isCurrentUserInvolved ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'
                      }`}>
                        {/* Mobile Layout - Stacked */}
                        <div className="block sm:hidden">
                          <div className="mb-2">
                            <p className="text-sm leading-tight">
                              <span className={isCurrentUserInvolved && suggestion.fromUserId === currentUserId ? 'font-bold text-red-700' : 'text-red-600'}>
                                {suggestion.fromName || suggestion.fromEmail}
                                {suggestion.fromUserId === currentUserId && ' (You)'}
                              </span>
                              <span className="text-gray-500 mx-1">pays</span>
                              <span className={isCurrentUserInvolved && suggestion.toUserId === currentUserId ? 'font-bold text-green-700' : 'text-green-600'}>
                                {suggestion.toName || suggestion.toEmail}
                                {suggestion.toUserId === currentUserId && ' (You)'}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-gray-900 text-lg">${suggestion.amount}</p>
                            <button
                              onClick={() => recordSuggestion(suggestion)}
                              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 touch-manipulation ${
                                isCurrentUserInvolved
                                  ? 'bg-yellow-600 text-white hover:bg-yellow-700 active:bg-yellow-800'
                                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                              }`}
                              disabled={isRecording || recordingSettlement !== null}
                            >
                              {isRecording ? 'Recording...' : isCurrentUserInvolved ? '⭐ Record' : 'Record'}
                            </button>
                          </div>
                        </div>
                        
                        {/* Desktop Layout - Side by Side */}
                        <div className="hidden sm:flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm">
                              <span className={isCurrentUserInvolved && suggestion.fromUserId === currentUserId ? 'font-bold text-red-700' : 'text-red-600'}>
                                {suggestion.fromName || suggestion.fromEmail}
                                {suggestion.fromUserId === currentUserId && ' (You)'}
                              </span>
                              <span className="text-gray-500 mx-2">pays</span>
                              <span className={isCurrentUserInvolved && suggestion.toUserId === currentUserId ? 'font-bold text-green-700' : 'text-green-600'}>
                                {suggestion.toName || suggestion.toEmail}
                                {suggestion.toUserId === currentUserId && ' (You)'}
                              </span>
                            </p>
                            <p className="font-bold text-gray-900">${suggestion.amount}</p>
                          </div>
                          <button
                            onClick={() => recordSuggestion(suggestion)}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                              isCurrentUserInvolved
                                ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                            disabled={isRecording || recordingSettlement !== null}
                          >
                            {isRecording ? 'Recording...' : isCurrentUserInvolved ? '⭐ Record (You)' : 'Record'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Individual Balances - Mobile Optimized */}
      <div>
        <h3 className="font-medium text-gray-900 mb-3 text-sm sm:text-base">👥 Individual Balances</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {balances.map((balance) => {
            const info = getBalanceInfo(balance);
            const isCurrentUser = balance.user.id === currentUserId;
            
            return (
              <div key={balance.user.id} className={`p-3 rounded-lg border ${info.bgColor} ${
                isCurrentUser ? 'ring-2 ring-blue-300' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 text-sm sm:text-base truncate">
                        {balance.user.name || balance.user.email}
                      </span>
                      {isCurrentUser && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">{balance.user.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-base sm:text-lg font-bold ${info.color}`}>
                      {info.icon}
                    </div>
                    <div className={`text-xs sm:text-sm font-medium ${info.color}`}>
                      {info.text}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Balance Explanation - Mobile Optimized */}
      <div className="text-xs sm:text-sm text-gray-500 bg-gray-50 rounded p-3">
        <p className="font-medium mb-2">How balances work:</p>
        <div className="space-y-1">
          <p>• <span className="text-green-600 font-medium">Positive amounts</span> = Money owed to this person</p>
          <p>• <span className="text-red-600 font-medium">Negative amounts</span> = Money this person owes</p>
          <p>• <span className="text-green-600 font-medium">Settled</span> = No money owed in either direction</p>
          <p>• Smart suggestions minimize transactions needed to settle everyone</p>
        </div>
      </div>
    </div>
  );
}