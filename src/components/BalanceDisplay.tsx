"use client";

import { useState, useEffect } from "react";

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
  onSettlementRecorded?: () => void;
}

export default function BalanceDisplay({ 
  groupId, 
  balances, 
  currentUserId, 
  onSettlementRecorded 
}: BalanceDisplayProps) {
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [recordingSettlement, setRecordingSettlement] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

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