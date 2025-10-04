"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ExpenseActions({ expenseId, canModify }: { expenseId: string; canModify: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canModify) return null;

  async function onDelete() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/expenses/${expenseId}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Failed to delete expense");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={onDelete} className="text-red-600 hover:underline" disabled={loading}>
        {loading ? "Deleting..." : "Delete"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}