import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addMemberSchema, removeMemberSchema } from "@/lib/schemas";
import { z } from "zod";

const updateMemberRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"])
});

// GET endpoint to list all members of a group
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requesterId = (session.user as any).id as string;
  const groupId = params.id;

  // Verify group access
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [
        { createdById: requesterId },
        { members: { some: { userId: requesterId } } }
      ]
    },
    select: { id: true, name: true, createdById: true }
  });
  
  if (!group) {
    return NextResponse.json({ error: "Group not found or access denied" }, { status: 403 });
  }

  try {
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true
          }
        }
      },
      orderBy: [
        { role: "asc" }, // OWNER first, then ADMIN, then MEMBER
        { joinedAt: "asc" } // Earlier joiners first within same role
      ]
    });

    const membersWithDetails = members.map(member => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      user: {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        memberSince: member.user.createdAt
      },
      isCreator: member.userId === group.createdById
    }));

    return NextResponse.json({
      members: membersWithDetails,
      totalCount: members.length,
      group: {
        id: group.id,
        name: group.name,
        createdById: group.createdById
      }
    });
  } catch (err) {
    console.error("Members list error:", err);
    return NextResponse.json({ error: "Failed to retrieve members" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requesterId = (session.user as any).id as string;
  const groupId = params.id;

  // Get group and requester's membership info
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        where: { userId: requesterId },
        select: { role: true }
      }
    }
  });
  
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  
  // Check permissions: Only OWNER or ADMIN can add members
  const requesterMembership = group.members[0];
  const isCreator = group.createdById === requesterId;
  const canAddMembers = isCreator || (requesterMembership && ["OWNER", "ADMIN"].includes(requesterMembership.role));
  
  if (!canAddMembers) {
    return NextResponse.json({ error: "Only group owners or admins can add members" }, { status: 403 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = addMemberSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ 
      error: "Invalid input", 
      details: parsed.error.issues 
    }, { status: 400 });
  }

  const { email, role = "MEMBER" } = parsed.data;
  
  // Validate role assignment permissions
  if (role === "OWNER") {
    return NextResponse.json({ error: "Cannot assign OWNER role. Use transfer ownership instead." }, { status: 400 });
  }
  
  // Only existing OWNER can assign ADMIN role
  if (role === "ADMIN" && !isCreator) {
    return NextResponse.json({ error: "Only group owner can assign ADMIN role" }, { status: 403 });
  }

  const targetUser = await prisma.user.findUnique({ 
    where: { email }, 
    select: { id: true, name: true, email: true } 
  });
  if (!targetUser) {
    return NextResponse.json({ error: "User with this email not found" }, { status: 404 });
  }

  try {
    const member = await prisma.groupMember.create({
      data: {
        groupId,
        userId: targetUser.id,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    return NextResponse.json({ 
      memberId: member.id,
      member: {
        id: member.id,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
        user: member.user
      }
    }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "User is already a member of this group" }, { status: 409 });
    }
    console.error("Add member error:", err);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requesterId = (session.user as any).id as string;
  const groupId = params.id;

  // Get group and requester's membership info
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        where: { userId: requesterId },
        select: { role: true }
      }
    }
  });
  
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const json = await req.json().catch(() => ({}));
  const parsed = removeMemberSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ 
      error: "Invalid input", 
      details: parsed.error.issues 
    }, { status: 400 });
  }

  const { userId } = parsed.data;
  
  // Prevent removal of group creator
  if (userId === group.createdById) {
    return NextResponse.json({ error: "Cannot remove the group owner" }, { status: 400 });
  }

  // Get target member's info
  const targetMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true, user: { select: { name: true, email: true } } }
  });
  
  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Check permissions
  const requesterMembership = group.members[0];
  const isCreator = group.createdById === requesterId;
  const requesterRole = isCreator ? "OWNER" : requesterMembership?.role;
  
  // Permission hierarchy: OWNER > ADMIN > MEMBER
  const canRemove = 
    isCreator || 
    (requesterRole === "ADMIN" && targetMember.role === "MEMBER") ||
    (requesterId === userId); // Members can remove themselves
    
  if (!canRemove) {
    return NextResponse.json({ 
      error: "Insufficient permissions to remove this member" 
    }, { status: 403 });
  }

  try {
    await prisma.groupMember.delete({
      where: {
        groupId_userId: { groupId, userId },
      },
    });
    
    return NextResponse.json({ 
      success: true,
      message: `${targetMember.user.name || targetMember.user.email} has been removed from the group`
    });
  } catch (err) {
    console.error("Remove member error:", err);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}

// PATCH endpoint to update member roles
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requesterId = (session.user as any).id as string;
  const groupId = params.id;

  // Get group and verify ownership (only owner can change roles)
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { createdById: true }
  });
  
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  if (group.createdById !== requesterId) {
    return NextResponse.json({ error: "Only group owner can change member roles" }, { status: 403 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = updateMemberRoleSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ 
      error: "Invalid input", 
      details: parsed.error.issues 
    }, { status: 400 });
  }

  const { userId, role } = parsed.data;
  
  // Cannot change owner's role
  if (userId === group.createdById) {
    return NextResponse.json({ error: "Cannot change group owner's role" }, { status: 400 });
  }
  
  // Cannot assign OWNER role (use transfer ownership instead)
  if (role === "OWNER") {
    return NextResponse.json({ error: "Use transfer ownership to assign OWNER role" }, { status: 400 });
  }

  try {
    const updatedMember = await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    return NextResponse.json({
      success: true,
      member: {
        id: updatedMember.id,
        userId: updatedMember.userId,
        role: updatedMember.role,
        joinedAt: updatedMember.joinedAt,
        user: updatedMember.user
      },
      message: `${updatedMember.user.name || updatedMember.user.email}'s role updated to ${role}`
    });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    console.error("Update member role error:", err);
    return NextResponse.json({ error: "Failed to update member role" }, { status: 500 });
  }
}
