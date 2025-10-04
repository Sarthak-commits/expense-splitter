"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { settlementCreateSchema } from "@/lib/schemas";

export default function SettlementForm({
  groupId,
  members,
  currentUserId,
}: {
  groupId: string;
  members: { id: string; name?: string | null; email: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [fromUserId, setFromUserId] = useState(currentUserId);
  const [toUserId, setToUserId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = settlementCreateSchema.safeParse({ fromUserId, toUserId, amount });
    if (!parsed.success || parsed.data.fromUserId === parsed.data.toUserId) {
      setError("Please select two different users and provide a positive amount");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/groups/${groupId}/settlements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromUserId, toUserId, amount }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Failed to record settlement");
      return;
    }
    setAmount("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="border rounded p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="border rounded px-2 py-2"
          value={fromUserId}
          onChange={(e) => setFromUserId(e.target.value)}
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || m.email}
            </option>
          ))}
        </select>
        <span className="text-sm">paid</span>
        <select
          className="border rounded px-2 py-2"
          value={toUserId}
          onChange={(e) => setToUserId(e.target.value)}
        >
          <option value="">Select receiver</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || m.email}
            </option>
          ))}
        </select>
        <span className="text-sm">amount</span>
        <input
          type="number"
          step="0.01"
          min="0.01"
          className="border rounded px-3 py-2 w-32"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button
          type="submit"
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Recording..." : "Record settlement"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
