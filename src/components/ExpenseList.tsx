"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ExpenseActions from "./ExpenseActions";

// Expense categories with display labels and icons (matching ExpenseForm)
const EXPENSE_CATEGORIES = [
  { value: "FOOD", label: "🍽️ Food", shortLabel: "Food" },
  { value: "GROCERIES", label: "🛒 Groceries", shortLabel: "Groceries" },
  { value: "TRAVEL", label: "✈️ Travel", shortLabel: "Travel" },
  { value: "TRANSPORTATION", label: "🚗 Transport", shortLabel: "Transport" },
  { value: "ENTERTAINMENT", label: "🎬 Entertainment", shortLabel: "Entertainment" },
  { value: "SHOPPING", label: "🛍️ Shopping", shortLabel: "Shopping" },
  { value: "UTILITIES", label: "💡 Utilities", shortLabel: "Utilities" },
  { value: "HOUSING", label: "🏠 Housing", shortLabel: "Housing" },
  { value: "HEALTH", label: "🏥 Healthcare", shortLabel: "Health" },
  { value: "EDUCATION", label: "📚 Education", shortLabel: "Education" },
  { value: "GIFTS", label: "🎁 Gifts", shortLabel: "Gifts" },
  { value: "FEES", label: "📋 Fees", shortLabel: "Fees" },
  { value: "OTHER", label: "📦 Other", shortLabel: "Other" },
];

// Helper function to get category display info
function getCategoryInfo(category: string) {
  const cat = EXPENSE_CATEGORIES.find(c => c.value === category);
  return cat || { value: "OTHER", label: "📦 Other", shortLabel: "Other" };
}

interface Expense {
  id: string;
  description: string;
  amount: any; // Prisma Decimal
  currency: string;
  date: string;
  createdAt: string;
  category: string; // ExpenseCategory from Prisma
  paidBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface ExpenseListProps {
  groupId: string;
  initialExpenses: Expense[];
  hasMore: boolean;
  nextCursor?: string;
  currentUserId: string;
  groupCreatorId: string;
  members: { id: string; name?: string | null; email: string }[];
}

export default function ExpenseList({
  groupId,
  initialExpenses,
  hasMore: initialHasMore,
  nextCursor: initialCursor,
  currentUserId,
  groupCreatorId,
  members
}: ExpenseListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState(initialCursor);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'description'>(
    (searchParams.get('sort') as 'date' | 'amount' | 'description') || 'date'
  );
  const [filterBy, setFilterBy] = useState(searchParams.get('filter') || 'all');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || 'all');
  const [error, setError] = useState<string | null>(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      updateURL({ search: term, cursor: undefined });
      loadExpenses(true, term);
    }, 300),
    []
  );

  // Update URL with search params
  function updateURL(params: { search?: string; sort?: string; filter?: string; category?: string; cursor?: string }) {
    const url = new URL(window.location.href);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      } else {
        url.searchParams.delete(key);
      }
    });
    
    router.replace(url.pathname + url.search, { scroll: false });
  }

  // Load expenses with filters
  async function loadExpenses(reset = false, search = searchTerm) {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (sortBy !== 'date') params.set('sort', sortBy);
      if (filterBy !== 'all') params.set('filter', filterBy);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (!reset && nextCursor) params.set('cursor', nextCursor);
      
      const url = `/api/groups/${groupId}/expenses?${params.toString()}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error('Failed to load expenses');
      }
      
      const data = await res.json();
      
      if (reset) {
        setExpenses(data.expenses);
      } else {
        setExpenses(prev => [...prev, ...data.expenses]);
      }
      
      setHasMore(data.pagination.hasNextPage);
      setNextCursor(data.pagination.nextCursor);
    } catch (err) {
      setError('Failed to load expenses. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Handle search input
  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  // Handle filter/sort changes
  useEffect(() => {
    updateURL({ sort: sortBy, filter: filterBy, category: categoryFilter, cursor: undefined });
    loadExpenses(true);
  }, [sortBy, filterBy, categoryFilter]);

  // Filter expenses client-side for immediate feedback
  const filteredExpenses = expenses.filter(expense => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesDescription = expense.description.toLowerCase().includes(searchLower);
      const matchesPayer = (expense.paidBy.name?.toLowerCase() || expense.paidBy.email.toLowerCase()).includes(searchLower);
      const matchesAmount = expense.amount.toString().includes(searchTerm);
      const categoryInfo = getCategoryInfo(expense.category || 'OTHER');
      const matchesCategory = categoryInfo.shortLabel.toLowerCase().includes(searchLower);
      
      if (!matchesDescription && !matchesPayer && !matchesAmount && !matchesCategory) {
        return false;
      }
    }

    // Category filter
    if (categoryFilter !== 'all' && expense.category !== categoryFilter) {
      return false;
    }

    // User filter
    if (filterBy === 'my-expenses') {
      return expense.paidBy.id === currentUserId;
    } else if (filterBy === 'others-expenses') {
      return expense.paidBy.id !== currentUserId;
    }

    return true;
  });

  // Sort expenses client-side
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    switch (sortBy) {
      case 'amount':
        return parseFloat(b.amount.toString()) - parseFloat(a.amount.toString());
      case 'description':
        return a.description.localeCompare(b.description);
      case 'date':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  function canModifyExpense(expense: Expense): boolean {
    return groupCreatorId === currentUserId || expense.paidBy.id === currentUserId;
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls - Mobile Optimized */}
      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-4">
        {/* Search Input - Full Width on Mobile */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Search Expenses</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border rounded-md px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation"
              >
                ❌
              </button>
            )}
          </div>
        </div>
        
        {/* Sort, Filter, and Category - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Sort Options */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Sort</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'amount' | 'description')}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="date">📅 Newest</option>
              <option value="amount">💰 Highest</option>
              <option value="description">📝 A-Z</option>
            </select>
          </div>

          {/* User Filter Options */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Filter</label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">👥 All</option>
              <option value="my-expenses">👤 Mine</option>
              <option value="others-expenses">👥 Others</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full border rounded-md px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">🏷️ All Categories</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              {categoryFilter !== 'all' && (
                <button
                  onClick={() => setCategoryFilter('all')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation"
                  title="Clear category filter"
                >
                  ✖️
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {sortedExpenses.length} of {expenses.length} expenses
            {searchTerm && ` matching "${searchTerm}"`}
            {categoryFilter !== 'all' && ` in ${getCategoryInfo(categoryFilter).shortLabel}`}
          </span>
          {(searchTerm || filterBy !== 'all' || categoryFilter !== 'all' || sortBy !== 'date') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSortBy('date');
                setFilterBy('all');
                setCategoryFilter('all');
                updateURL({});
                loadExpenses(true, '');
              }}
              className="text-blue-600 hover:text-blue-800"
            >
              🔄 Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">❌ {error}</p>
        </div>
      )}

      {/* Expenses List */}
      {sortedExpenses.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">
            {searchTerm || filterBy !== 'all' || categoryFilter !== 'all'
              ? '🔍 No expenses match your current filters'
              : '💸 No expenses yet. Add one to get started.'
            }
          </p>
          {(searchTerm || filterBy !== 'all' || categoryFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterBy('all');
                setCategoryFilter('all');
              }}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              Show all expenses
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {sortedExpenses.map((expense) => (
            <div key={expense.id} className="p-3 sm:p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
              {/* Mobile Layout - Stacked */}
              <div className="block sm:hidden">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 text-sm leading-tight truncate">{expense.description}</h4>
                      {expense.paidBy.id === currentUserId && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-lg font-semibold text-gray-900">
                        💰 ${parseFloat(expense.amount.toString()).toFixed(2)} {expense.currency}
                      </div>
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                        {getCategoryInfo(expense.category || 'OTHER').shortLabel}
                      </span>
                    </div>
                  </div>
                  <ExpenseActions
                    expenseId={expense.id}
                    canModify={canModifyExpense(expense)}
                    members={members}
                  />
                </div>
                <div className="flex justify-between items-center text-xs text-gray-600">
                  <span className="truncate">👤 {expense.paidBy.name || expense.paidBy.email}</span>
                  <span className="whitespace-nowrap ml-2">📅 {new Date(expense.date).toLocaleDateString()}</span>
                </div>
              </div>
              
              {/* Desktop Layout - Side by Side */}
              <div className="hidden sm:flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900">{expense.description}</h4>
                    {expense.paidBy.id === currentUserId && (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        You paid
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>💰 ${parseFloat(expense.amount.toString()).toFixed(2)} {expense.currency}</span>
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                      {getCategoryInfo(expense.category || 'OTHER').shortLabel}
                    </span>
                    <span>👤 {expense.paidBy.name || expense.paidBy.email}</span>
                    <span>📅 {new Date(expense.date).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <ExpenseActions
                    expenseId={expense.id}
                    canModify={canModifyExpense(expense)}
                    members={members}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More Button - Mobile Optimized */}
      {hasMore && !searchTerm && filterBy === 'all' && categoryFilter === 'all' && (
        <div className="text-center pt-4">
          <button
            onClick={() => loadExpenses(false)}
            className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-md text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span className="hidden sm:inline">Loading more...</span>
                <span className="sm:hidden">Loading...</span>
              </div>
            ) : (
              <>
                <span className="hidden sm:inline">📄 Load More Expenses</span>
                <span className="sm:hidden">📄 Load More</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Pagination Info */}
      <div className="text-center text-xs text-gray-500">
        {!hasMore && expenses.length > 0 && (
          <p>✅ All expenses loaded ({expenses.length} total)</p>
        )}
      </div>
    </div>
  );
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}