"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Member {
  userId: string;
  name?: string | null;
  email: string;
  role: string;
  joinedAt?: string;
  isCreator?: boolean;
}

interface Invitation {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string | null;
  invitedBy: {
    name: string | null;
    email: string;
  };
}

export default function MemberManager({
  groupId,
  members,
  ownerUserId,
  currentUserId,
}: {
  groupId: string;
  members: Member[];
  ownerUserId: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const currentMember = members.find(m => m.userId === currentUserId);
  const isOwner = currentUserId === ownerUserId;
  const isAdmin = currentMember?.role === 'ADMIN';
  const canManageMembers = isOwner || isAdmin;
  
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  // Load invitations when switching to invitations tab
  useEffect(() => {
    if (activeTab === 'invitations') {
      loadInvitations();
    }
  }, [activeTab, groupId]);

  async function loadInvitations() {
    setLoadingInvitations(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/invites`);
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invites || []);
      }
    } catch (err) {
      console.error('Failed to load invitations:', err);
    }
    setLoadingInvitations(false);
  }

  if (!canManageMembers) {
    return (
      <div className="text-sm text-gray-500 italic">
        Only group owners and admins can manage members.
      </div>
    );
  }

  async function sendInvitation(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!email) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email, 
          role: isOwner ? inviteRole : 'MEMBER',
          sendEmail 
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data?.error || "Failed to send invitation");
        return;
      }
      
      setSuccess(`Invitation sent to ${email}! ${data.emailSent ? 'Email notification sent.' : 'No email sent.'}`);
      setEmail("");
      
      // Refresh invitations list
      if (activeTab === 'invitations') {
        await loadInvitations();
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function removeMember(member: Member) {
    if (!confirm(`Are you sure you want to remove ${member.name || member.email} from the group?`)) {
      return;
    }
    
    setError(null);
    setSuccess(null);
    setLoading(true);
    
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data?.error || "Failed to remove member");
        return;
      }
      
      setSuccess(`${member.name || member.email} has been removed from the group`);
      router.refresh();
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function updateMemberRole(member: Member, newRole: 'MEMBER' | 'ADMIN') {
    setError(null);
    setSuccess(null);
    setLoading(true);
    
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, role: newRole }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data?.error || "Failed to update member role");
        return;
      }
      
      setSuccess(`${member.name || member.email}'s role updated to ${newRole}`);
      setEditingRole(null);
      router.refresh();
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function canRemoveMember(member: Member): boolean {
    if (member.userId === ownerUserId) return false; // Cannot remove owner
    if (!isOwner && member.role === 'ADMIN') return false; // Admin cannot remove admin
    return true;
  }

  function canEditRole(member: Member): boolean {
    return isOwner && member.userId !== ownerUserId;
  }

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'members'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('members')}
        >
          👥 Members ({members.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'invitations'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('invitations')}
        >
          ✉️ Invitations
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

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* Invite Form */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium text-gray-900 mb-3">✉️ Invite New Member</h3>
            <form onSubmit={sendInvitation} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {isOwner && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'MEMBER' | 'ADMIN')}
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                )}
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading || !email}
                  >
                    {loading ? 'Sending...' : 'Send Invitation'}
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="sendEmail" className="ml-2 text-sm text-gray-600">
                  Send email invitation
                </label>
              </div>
            </form>
          </div>

          {/* Members List */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">👥 Current Members</h3>
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.userId} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {member.name || member.email}
                      </span>
                      {member.userId === ownerUserId && (
                        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                          👑 Owner
                        </span>
                      )}
                      {member.role === 'ADMIN' && member.userId !== ownerUserId && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          🔧 Admin
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{member.email}</p>
                    {member.joinedAt && (
                      <p className="text-xs text-gray-500">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {canEditRole(member) && (
                      <div className="relative">
                        {editingRole === member.userId ? (
                          <div className="flex items-center gap-1">
                            <select
                              className="text-sm border rounded px-2 py-1"
                              defaultValue={member.role}
                              onChange={(e) => {
                                updateMemberRole(member, e.target.value as 'MEMBER' | 'ADMIN');
                              }}
                            >
                              <option value="MEMBER">Member</option>
                              <option value="ADMIN">Admin</option>
                            </select>
                            <button
                              onClick={() => setEditingRole(null)}
                              className="text-gray-400 hover:text-gray-600 text-sm"
                            >
                              ❌
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingRole(member.userId)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                            disabled={loading}
                          >
                            Edit Role
                          </button>
                        )}
                      </div>
                    )}
                    
                    {canRemoveMember(member) && (
                      <button
                        onClick={() => removeMember(member)}
                        className="text-red-600 hover:text-red-800 text-sm"
                        disabled={loading}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === 'invitations' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">✉️ Pending Invitations</h3>
            <button
              onClick={loadInvitations}
              className="text-sm text-blue-600 hover:text-blue-800"
              disabled={loadingInvitations}
            >
              {loadingInvitations ? 'Loading...' : '🔄 Refresh'}
            </button>
          </div>
          
          {loadingInvitations ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-500 mt-2">Loading invitations...</p>
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">📫 No pending invitations</p>
              <p className="text-xs text-gray-400 mt-1">Sent invitations will appear here until they are accepted.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{invitation.email}</p>
                    <p className="text-sm text-gray-600">
                      Invited by {invitation.invitedBy.name || invitation.invitedBy.email}
                    </p>
                    <p className="text-xs text-gray-500">
                      Sent {new Date(invitation.createdAt).toLocaleDateString()}
                      {invitation.expiresAt && (
                        <span> • Expires {new Date(invitation.expiresAt).toLocaleDateString()}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-sm text-amber-600">
                    ⏳ Pending
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
