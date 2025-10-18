"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { expenseCreateSchema } from "@/lib/schemas";

// Expense categories with display labels and icons
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

export default function ExpenseForm({ groupId, members }: { groupId: string; members: { id: string; name?: string | null; email: string }[] }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [category, setCategory] = useState("OTHER");
  const [splitMode, setSplitMode] = useState<"EQUAL" | "EXACT">("EQUAL");
  const [customSplits, setCustomSplits] = useState<Record<string, string>>(() => Object.fromEntries(members.map(m => [m.id, ""])));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = expenseCreateSchema.safeParse({ description, amount, currency, category });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message || "Please provide valid inputs");
      return;
    }
    setLoading(true);
    const payload: any = parsed.data;
    if (splitMode === "EXACT") {
      payload.splitType = "EXACT";
      payload.splits = members.map((m) => ({ userId: m.id, amount: customSplits[m.id] || "0" }));
      // basic client-side sum check
      const sum = payload.splits.reduce((acc: number, s: any) => acc + parseFloat(s.amount || "0"), 0);
      if (isFinite(sum)) {
        const amt = parseFloat(payload.amount);
        if (Math.abs(sum - amt) > 0.009) {
          setError("Custom splits must sum to the total amount");
          setLoading(false);
          return;
        }
      }
    }
    const res = await fetch(`/api/groups/${groupId}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Failed to add expense");
      return;
    }
    setDescription("");
    setAmount("");
    setCurrency("USD");
    setCategory("OTHER");
    setSplitMode("EQUAL");
    setCustomSplits(Object.fromEntries(members.map(m => [m.id, ""])));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="border rounded p-3 space-y-3">
      <div className="flex flex-col md:flex-row gap-3 md:gap-2">
        {/* First row: Description, Amount, Currency */}
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            placeholder="Description"
            className="border rounded px-3 py-2 flex-1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Amount"
            className="border rounded px-3 py-2 w-32"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <select
            className="border rounded px-2 py-2"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="USD">USD</option>
          </select>
        </div>

        {/* Second row: Category, Split Type, Submit */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Dropdown */}
          <div className="flex-1 min-w-[140px]">
            <select
              className="border rounded px-3 py-2 w-full text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              title="Expense Category"
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
          
          {/* Split Type */}
          <div className="flex items-center gap-2">
            <label className="text-sm whitespace-nowrap">Split:</label>
            <label className="text-sm flex items-center gap-1">
              <input type="radio" name="split" checked={splitMode === "EQUAL"} onChange={() => setSplitMode("EQUAL")} />
              Equal
            </label>
            <label className="text-sm flex items-center gap-1">
              <input type="radio" name="split" checked={splitMode === "EXACT"} onChange={() => setSplitMode("EXACT")} />
              Custom
            </label>
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-60 whitespace-nowrap"
            disabled={loading}
          >
            {loading ? "Adding..." : "Add expense"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {splitMode === "EXACT" ? (
        <div className="text-sm border rounded p-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {members.map((m) => (
              <label key={m.id} className="flex items-center justify-between gap-2">
                <span>{m.name || m.email}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="border rounded px-2 py-1 w-32 text-right"
                  value={customSplits[m.id] || ""}
                  onChange={(e) => setCustomSplits((cs) => ({ ...cs, [m.id]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">Custom amounts must sum exactly to the total.</p>
        </div>
      ) : (
        <p className="text-xs text-gray-600">Split equally among group members.</p>
      )}
    </form>
  );
}
