"use client";

import { useState, FormEvent } from "react";

export default function CreateGroupForm() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Failed to create group");
    } else {
      setName("");
      // refresh the page to show the new group
      window.location.reload();
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input
        type="text"
        className="border rounded px-3 py-2 flex-1"
        placeholder="New group name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <button
        type="submit"
        className="bg-black text-white rounded px-4 py-2 disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "Creating..." : "Create"}
      </button>
      {error && <span className="text-sm text-red-600 ml-2">{error}</span>}
    </form>
  );
}
