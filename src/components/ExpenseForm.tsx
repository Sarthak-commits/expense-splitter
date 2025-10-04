"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { expenseCreateSchema } from "@/lib/schemas";

export default function ExpenseForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = expenseCreateSchema.safeParse({ description, amount, currency });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message || "Please provide valid inputs");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/groups/${groupId}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
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
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="border rounded p-3 space-y-3">
      <div className="flex items-center gap-2">
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
        <button
          type="submit"
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Adding..." : "Add expense"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-600">Split equally among group members.</p>
    </form>
  );
}
