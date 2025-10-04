import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addMemberSchema, removeMemberSchema } from "@/lib/schemas";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requesterId = (session.user as any).id as string;
  const groupId = params.id;

  // Only group creator can add members for now
  const group = await prisma.group.findUnique({ select: { createdById: true }, where: { id: groupId } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (group.createdById !== requesterId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await req.json().catch(() => ({}));
  const parsed = addMemberSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { email, role } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    const member = await prisma.groupMember.create({
      data: {
        groupId,
        userId: user.id,
        role: (role as any) ?? "MEMBER",
      },
      select: { id: true },
    });
    return NextResponse.json({ memberId: member.id }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "User already a member" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requesterId = (session.user as any).id as string;
  const groupId = params.id;

  const group = await prisma.group.findUnique({ select: { createdById: true }, where: { id: groupId } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (group.createdById !== requesterId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await req.json().catch(() => ({}));
  const parsed = removeMemberSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { userId } = parsed.data;
  if (userId === group.createdById) {
    return NextResponse.json({ error: "Cannot remove the group owner" }, { status: 400 });
  }

  try {
    await prisma.groupMember.delete({
      where: {
        groupId_userId: { groupId, userId },
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
