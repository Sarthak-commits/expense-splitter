import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emailService } from "@/lib/email";
import { z } from "zod";

const createInviteSchema = z.object({ 
  email: z.string().email(),
  sendEmail: z.boolean().optional().default(true),
  message: z.string().max(500).optional()
});

// GET endpoint to list pending invitations
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requesterId = (session.user as any).id as string;
  const groupId = params.id;

  // Verify requester has permission to view invites (owner or admin)
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
  
  const isOwner = group.createdById === requesterId;
  const isAdmin = group.members[0]?.role === "ADMIN";
  
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Only group owners and admins can view invitations" }, { status: 403 });
  }

  try {
    const invites = await prisma.invitation.findMany({
      where: { 
        groupId,
        acceptedAt: null // Only pending invites
      },
      include: {
        invitedBy: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({
      invites: invites.map(invite => ({
        id: invite.id,
        email: invite.email,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
        invitedBy: invite.invitedBy,
        token: isOwner ? invite.token : undefined // Only show token to owner
      })),
      totalCount: invites.length
    });
  } catch (err) {
    console.error("Get invites error:", err);
    return NextResponse.json({ error: "Failed to retrieve invites" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requesterId = (session.user as any).id as string;
  const groupId = params.id;

  // Get group with more details and check permissions
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        where: { userId: requesterId },
        select: { role: true }
      },
      createdBy: {
        select: { name: true, email: true }
      }
    }
  });
  
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  
  // Check if requester can send invites (owner or admin)
  const isOwner = group.createdById === requesterId;
  const isAdmin = group.members[0]?.role === "ADMIN";
  
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Only group owners and admins can send invitations" }, { status: 403 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = createInviteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ 
      error: "Invalid input", 
      details: parsed.error.issues 
    }, { status: 400 });
  }

  const { email, sendEmail, message } = parsed.data;
  
  // Check if user is already a member
  const existingMember = await prisma.groupMember.findFirst({ 
    where: { groupId, user: { email } }, 
    select: { id: true } 
  });
  if (existingMember) {
    return NextResponse.json({ error: "User is already a member of this group" }, { status: 409 });
  }

  // Generate secure token
  const token = (await import("crypto")).randomBytes(32).toString("hex");
  
  // Set expiration date (7 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  try {
    // Create or update invitation
    const invite = await prisma.invitation.upsert({
      where: { groupId_email: { groupId, email } },
      update: { 
        token, 
        invitedById: requesterId, 
        acceptedAt: null,
        expiresAt,
        createdAt: new Date() // Reset creation date for new invite
      },
      create: { 
        groupId, 
        email, 
        token, 
        invitedById: requesterId,
        expiresAt
      },
      include: {
        invitedBy: {
          select: { name: true, email: true }
        },
        group: {
          select: { name: true }
        }
      }
    });

    let emailSent = false;
    let emailError = null;

    // Send invitation email if requested
    if (sendEmail && emailService.isEmailEnabled()) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const acceptUrl = `${baseUrl}/invites/accept?token=${token}`;
        
        // Check if the email corresponds to an existing user for personalization
        const existingUser = await prisma.user.findUnique({
          where: { email },
          select: { name: true }
        });

        emailSent = await emailService.sendInvitationEmail({
          recipientEmail: email,
          recipientName: existingUser?.name || undefined,
          inviterName: invite.invitedBy.name || invite.invitedBy.email,
          inviterEmail: invite.invitedBy.email,
          groupName: invite.group.name,
          inviteToken: token,
          acceptUrl
        });
      } catch (err) {
        console.error("Failed to send invitation email:", err);
        emailError = "Failed to send invitation email";
      }
    }

    return NextResponse.json({
      success: true,
      message: "Invitation created successfully",
      invite: {
        id: invite.id,
        email: invite.email,
        token: invite.token,
        expiresAt: invite.expiresAt,
        invitedBy: invite.invitedBy,
        group: invite.group
      },
      emailSent,
      emailError,
      acceptUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/invites/accept?token=${token}`
    }, { status: 201 });
  } catch (err: any) {
    console.error("Create invitation error:", err);
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Invitation already exists for this email" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  }
}
