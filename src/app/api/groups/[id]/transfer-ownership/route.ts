import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({ toUserId: z.string().min(1) });

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requesterId = (session.user as any).id as string;
  const groupId = params.id;

  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { toUserId } = parsed.data;

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { createdById: true } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (group.createdById !== requesterId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: toUserId } }, select: { id: true } });
  if (!member) return NextResponse.json({ error: "Target must be a group member" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.group.update({ where: { id: groupId }, data: { createdById: toUserId } });
    await tx.groupMember.update({ where: { groupId_userId: { groupId, userId: toUserId } }, data: { role: "OWNER" } });
    await tx.groupMember.updateMany({ where: { groupId, userId: requesterId }, data: { role: "ADMIN" } });
  });

  return NextResponse.json({ ok: true });
}