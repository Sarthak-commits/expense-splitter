import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const groupId = params.id;

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { createdById: true } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (group.createdById === userId) return NextResponse.json({ error: "Owner cannot leave. Transfer or delete the group." }, { status: 400 });

  await prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } }).catch(() => null);
  return NextResponse.json({ ok: true });
}