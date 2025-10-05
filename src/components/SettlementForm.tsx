"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { settlementCreateSchema } from "@/lib/schemas";

interface SettlementSuggestion {
  fromUserId: string;
  fromName: string | null;
  fromEmail: string;
  toUserId: string;
  toName: string | null;
  toEmail: string;
  amount: string;
}

interface Settlement {
  id: string;
  amount: string;
  createdAt: string;
  from: {
    name: string | null;
    email: string;
  };
  to: {
    name: string | null;
    email: string;
  };
}

export default function SettlementForm({
  groupId,
  members,
  currentUserId,
  balances,
}: {
  groupId: string;
  members: { id: string; name?: string | null; email: string }[];
  currentUserId: string;
  balances: { user: { id: string; name?: string | null; email: string }; amount: any }[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'record' | 'suggestions' | 'history'>('suggestions');
  const [fromUserId, setFromUserId] = useState(currentUserId);
  const [toUserId, setToUserId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load settlement suggestions
  useEffect(() => {
    if (activeTab === 'suggestions') {
      loadSuggestions();
    }
  }, [activeTab, groupId]);

  // Load settlement history
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, groupId]);

  async function loadSuggestions() {
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/settlement-suggestions`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
    setLoadingSuggestions(false);
  }

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/settlements`);
      if (res.ok) {
        const data = await res.json();
        setSettlements(data.settlements || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
    setLoadingHistory(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    const parsed = settlementCreateSchema.safeParse({ fromUserId, toUserId, amount });
    if (!parsed.success || parsed.data.fromUserId === parsed.data.toUserId) {
      setError("Please select two different users and provide a positive amount");
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId, toUserId, amount }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data?.error || "Failed to record settlement");
        return;
      }
      
      setSuccess(`Settlement recorded successfully! ${data.settlement?.from?.name || 'User'} paid ${data.settlement?.to?.name || 'user'} $${amount}`);
      setAmount("");
      setToUserId("");
      
      // Refresh suggestions and balances
      if (activeTab === 'suggestions') {
        await loadSuggestions();
      }
      router.refresh();
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function recordSuggestion(suggestion: SettlementSuggestion) {
    setError(null);
    setSuccess(null);
    setLoading(true);
    
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
      
      // Refresh suggestions and balances
      await loadSuggestions();
      router.refresh();
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'suggestions'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('suggestions')}
        >
          💡 Smart Suggestions
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'record'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('record')}
        >
          ✏️ Record Manual
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('history')}
        >
          📜 History
        </button>
      </div>

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

      {/* Smart Suggestions Tab */}
      {activeTab === 'suggestions' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">💡 Optimal Settlement Suggestions</h3>
            <button
              onClick={loadSuggestions}
              className="text-sm text-blue-600 hover:text-blue-800"
              disabled={loadingSuggestions}
            >
              {loadingSuggestions ? 'Loading...' : '🔄 Refresh'}
            </button>
          </div>
          
          {loadingSuggestions ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-500 mt-2">Calculating optimal settlements...</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">🎉 All balances are settled!</p>
              <p className="text-xs text-gray-400 mt-1">No settlements needed at this time.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-600">
                These suggestions minimize the number of transactions needed to settle all balances.
              </p>
              {suggestions.map((suggestion, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      <span className="text-red-600">{suggestion.fromName || suggestion.fromEmail}</span>
                      <span className="text-gray-500 mx-2">→</span>
                      <span className="text-green-600">{suggestion.toName || suggestion.toEmail}</span>
                    </p>
                    <p className="text-lg font-bold text-gray-900">${suggestion.amount}</p>
                  </div>
                  <button
                    onClick={() => recordSuggestion(suggestion)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Recording...' : 'Record'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual Record Tab */}
      {activeTab === 'record' && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">✏️ Record Manual Settlement</h3>
          <form onSubmit={onSubmit} className="border rounded-lg p-4 space-y-4 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">From (Payer)</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={fromUserId}
                  onChange={(e) => setFromUserId(e.target.value)}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.email}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">To (Receiver)</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={toUserId}
                  onChange={(e) => setToUserId(e.target.value)}
                >
                  <option value="">Select receiver</option>
                  {members.filter(m => m.id !== fromUserId).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.email}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-green-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || !toUserId || !amount}
                >
                  {loading ? 'Recording...' : 'Record Settlement'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">📜 Settlement History</h3>
            <button
              onClick={loadHistory}
              className="text-sm text-blue-600 hover:text-blue-800"
              disabled={loadingHistory}
            >
              {loadingHistory ? 'Loading...' : '🔄 Refresh'}
            </button>
          </div>
          
          {loadingHistory ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-500 mt-2">Loading settlement history...</p>
            </div>
          ) : settlements.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">📝 No settlements recorded yet</p>
              <p className="text-xs text-gray-400 mt-1">Settlement history will appear here once you start recording payments.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {settlements.map((settlement) => (
                <div key={settlement.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium text-red-600">{settlement.from.name || settlement.from.email}</span>
                      <span className="text-gray-500 mx-2">paid</span>
                      <span className="font-medium text-green-600">{settlement.to.name || settlement.to.email}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(settlement.createdAt).toLocaleDateString()} at {new Date(settlement.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">${settlement.amount}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
