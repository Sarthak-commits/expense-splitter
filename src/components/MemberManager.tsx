"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MemberManager({
  groupId,
  members,
  ownerUserId,
  currentUserId,
}: {
  groupId: string;
  members: { userId: string; name?: string | null; email: string; role: string }[];
  ownerUserId: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const isOwner = currentUserId === ownerUserId;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOwner) return null;

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email) return;
    setLoading(true);
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Failed to add member");
      return;
    }
    setEmail("");
    router.refresh();
  }

  async function removeMember(userId: string) {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Failed to remove member");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <form onSubmit={addMember} className="flex items-center gap-2">
        <input
          type="email"
          placeholder="Invite by email"
          className="border rounded px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Adding..." : "Add member"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="space-y-1">
        {members.map((m) => (
          <li key={m.userId} className="text-sm flex items-center justify-between">
            <div>
              <span className="font-medium">{m.name || m.email}</span>
              <span className="text-gray-600"> — {m.role}</span>
            </div>
            {m.userId !== ownerUserId && (
              <button
                onClick={() => removeMember(m.userId)}
                className="text-red-600 hover:underline"
                disabled={loading}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
