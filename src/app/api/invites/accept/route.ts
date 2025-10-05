import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emailService } from "@/lib/email";
import { z } from "zod";

const schema = z.object({ token: z.string().min(10) });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const userEmail = session.user?.email as string | undefined;
  const userName = session.user?.name as string | undefined;

  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ 
      error: "Invalid input", 
      details: parsed.error.issues 
    }, { status: 400 });
  }

  const { token } = parsed.data;
  
  // Get detailed invite information
  const invite = await prisma.invitation.findUnique({ 
    where: { token }, 
    include: {
      group: {
        select: { 
          id: true,
          name: true,
          createdById: true
        }
      },
      invitedBy: {
        select: { name: true, email: true }
      }
    }
  });
  
  if (!invite) {
    return NextResponse.json({ error: "Invalid or expired invitation token" }, { status: 404 });
  }
  
  if (invite.acceptedAt) {
    return NextResponse.json({ 
      error: "Invitation has already been accepted", 
      group: {
        id: invite.group.id,
        name: invite.group.name
      }
    }, { status: 409 });
  }
  
  // Check if invitation has expired
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
  }
  
  // Verify email match
  if (!userEmail || userEmail.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json({ 
      error: "This invitation was sent to a different email address", 
      expectedEmail: invite.email,
      currentEmail: userEmail
    }, { status: 400 });
  }

  try {
    // Check if user is already a member
    const existingMembership = await prisma.groupMember.findUnique({ 
      where: { groupId_userId: { groupId: invite.groupId, userId } }, 
      select: { id: true, role: true, joinedAt: true } 
    });
    
    let membershipCreated = false;
    let membership = existingMembership;
    
    if (!existingMembership) {
      // Create new membership
      membership = await prisma.groupMember.create({ 
        data: { 
          groupId: invite.groupId, 
          userId, 
          role: "MEMBER" 
        },
        select: { id: true, role: true, joinedAt: true }
      });
      membershipCreated = true;
    }
    
    // Mark invitation as accepted
    await prisma.invitation.update({ 
      where: { id: invite.id }, 
      data: { acceptedAt: new Date() } 
    });

    // Send notification emails if enabled
    if (emailService.isEmailEnabled()) {
      try {
        // Notify the inviter that their invitation was accepted
        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const groupUrl = `${baseUrl}/groups/${invite.groupId}`;
        
        await emailService.sendNotificationEmail({
          recipientEmail: invite.invitedBy.email,
          recipientName: invite.invitedBy.name || undefined,
          subject: `${userName || userEmail} joined "${invite.group.name}"`,
          message: `Great news! ${userName || userEmail} has accepted your invitation and joined the group "${invite.group.name}".`,
          actionUrl: groupUrl,
          actionText: "View Group"
        });
      } catch (emailErr) {
        console.error("Failed to send acceptance notification:", emailErr);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully joined "${invite.group.name}"`,
      group: {
        id: invite.group.id,
        name: invite.group.name
      },
      membership: {
        role: membership?.role,
        joinedAt: membership?.joinedAt,
        wasAlreadyMember: !membershipCreated
      },
      redirectUrl: `/groups/${invite.groupId}`
    });
  } catch (err: any) {
    console.error("Accept invitation error:", err);
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "You are already a member of this group" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}
