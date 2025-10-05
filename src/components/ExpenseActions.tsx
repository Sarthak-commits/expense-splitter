"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ExpenseDetails {
  id: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  splitType: string;
  paidBy: {
    name: string | null;
    email: string;
  };
  splits: Array<{
    userId: string;
    amount: string;
    user: {
      name: string | null;
      email: string;
    };
  }>;
  group: {
    name: string;
  };
  canModify: boolean;
  modifyReason?: string;
}

export default function ExpenseActions({ 
  expenseId, 
  canModify, 
  members 
}: { 
  expenseId: string; 
  canModify: boolean;
  members?: { id: string; name?: string | null; email: string }[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expenseDetails, setExpenseDetails] = useState<ExpenseDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Edit form state
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editSplitType, setEditSplitType] = useState<'EQUAL' | 'EXACT'>('EQUAL');
  const [editSplits, setEditSplits] = useState<{ [userId: string]: string }>({});
  const [showDetails, setShowDetails] = useState(false);

  // Load expense details when needed
  async function loadExpenseDetails() {
    setLoadingDetails(true);
    setError(null);
    try {
      const res = await fetch(`/api/expenses/${expenseId}`);
      const data = await res.json();
      
      if (!res.ok) {
        setError(data?.error || 'Failed to load expense details');
        return;
      }
      
      setExpenseDetails(data.expense);
      setEditDescription(data.expense.description);
      setEditAmount(data.expense.amount);
      setEditSplitType(data.expense.splitType);
      
      // Initialize edit splits
      const splitsMap: { [userId: string]: string } = {};
      data.expense.splits.forEach((split: any) => {
        splitsMap[split.userId] = split.amount;
      });
      setEditSplits(splitsMap);
      
    } catch (err) {
      setError('Network error. Please try again.');
    }
    setLoadingDetails(false);
  }

  // Load details when switching to edit mode
  useEffect(() => {
    if (mode === 'edit' && !expenseDetails) {
      loadExpenseDetails();
    }
  }, [mode]);

  if (!canModify) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setShowDetails(!showDetails);
            if (!showDetails && !expenseDetails) {
              loadExpenseDetails();
            }
          }}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          View Details
        </button>
        {showDetails && expenseDetails && (
          <ExpenseDetailsModal 
            expense={expenseDetails}
            onClose={() => setShowDetails(false)}
          />
        )}
      </div>
    );
  }

  async function onDelete() {
    if (!confirm(`Are you sure you want to delete this expense? This action cannot be undone.`)) {
      return;
    }
    
    setError(null);
    setSuccess(null);
    setLoading(true);
    
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, { method: "DELETE" });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data?.error || "Failed to delete expense");
        return;
      }
      
      setSuccess(`Expense "${data.deletedExpense?.description || 'expense'}" has been deleted`);
      // Close any modals and refresh
      setMode('view');
      setTimeout(() => {
        router.refresh();
      }, 1000);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onSaveEdit() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    
    try {
      const updateData: any = {
        description: editDescription,
        amount: editAmount,
        splitType: editSplitType
      };
      
      // If EXACT split type, include splits
      if (editSplitType === 'EXACT' && members) {
        const splits = members.map(member => ({
          userId: member.id,
          amount: editSplits[member.id] || '0'
        }));
        updateData.splits = splits;
        
        // Validate splits sum to total
        const totalSplits = splits.reduce((sum, split) => sum + parseFloat(split.amount || '0'), 0);
        const totalAmount = parseFloat(editAmount);
        if (Math.abs(totalSplits - totalAmount) > 0.01) {
          setError(`Split amounts ($${totalSplits.toFixed(2)}) must equal the total amount ($${totalAmount.toFixed(2)})`);
          setLoading(false);
          return;
        }
      }
      
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data?.error || 'Failed to update expense');
        return;
      }
      
      setSuccess('Expense updated successfully!');
      setMode('view');
      router.refresh();
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Main Actions */}
      {mode === 'view' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setMode('edit');
              setError(null);
              setSuccess(null);
            }}
            className="text-blue-600 hover:text-blue-800 text-sm"
            disabled={loading}
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-red-600 hover:text-red-800 text-sm"
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      )}

      {/* Success/Error Messages */}
      {success && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          ✅ {success}
        </div>
      )}
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      {/* Edit Modal */}
      {mode === 'edit' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Expense</h3>
              <button
                onClick={() => setMode('view')}
                className="text-gray-400 hover:text-gray-600"
              >
                ❌
              </button>
            </div>

            {loadingDetails ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <p className="text-sm text-gray-500 mt-2">Loading expense details...</p>
              </div>
            ) : expenseDetails ? (
              <div className="space-y-4">
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                {/* Split Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Split Type</label>
                  <select
                    value={editSplitType}
                    onChange={(e) => setEditSplitType(e.target.value as 'EQUAL' | 'EXACT')}
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="EQUAL">Equal Split</option>
                    <option value="EXACT">Custom Amounts</option>
                  </select>
                </div>

                {/* Custom Splits */}
                {editSplitType === 'EXACT' && members && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Individual Amounts</label>
                    <div className="space-y-2">
                      {members.map((member) => (
                        <div key={member.id} className="flex items-center gap-2">
                          <span className="text-sm w-32 truncate">
                            {member.name || member.email}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editSplits[member.id] || ''}
                            onChange={(e) => setEditSplits({
                              ...editSplits,
                              [member.id]: e.target.value
                            })}
                            className="flex-1 border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      ))}
                      <div className="text-xs text-gray-500">
                        Total: ${members.reduce((sum, m) => sum + parseFloat(editSplits[m.id] || '0'), 0).toFixed(2)}
                        {' / ' + editAmount}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-4">
                  <button
                    onClick={onSaveEdit}
                    className="flex-1 bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    disabled={loading || !editDescription || !editAmount}
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setMode('view')}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500">Failed to load expense details</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Simple expense details modal component
function ExpenseDetailsModal({ 
  expense, 
  onClose 
}: { 
  expense: ExpenseDetails; 
  onClose: () => void; 
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Expense Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ❌
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-gray-900">{expense.description}</h4>
            <p className="text-lg font-bold">${expense.amount} {expense.currency}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-600">Paid by: {expense.paidBy.name || expense.paidBy.email}</p>
            <p className="text-sm text-gray-600">Split type: {expense.splitType}</p>
            <p className="text-sm text-gray-600">Date: {new Date(expense.date).toLocaleDateString()}</p>
          </div>

          <div>
            <h5 className="font-medium text-gray-900 mb-2">Split Details:</h5>
            <div className="space-y-1">
              {expense.splits.map((split, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>{split.user.name || split.user.email}</span>
                  <span>${split.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full bg-gray-100 text-gray-700 rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
