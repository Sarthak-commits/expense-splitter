import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({ token: z.string().min(10) });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const userEmail = session.user?.email as string | undefined;

  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { token } = parsed.data;
  const invite = await prisma.invitation.findUnique({ where: { token }, select: { id: true, groupId: true, email: true, acceptedAt: true } });
  if (!invite) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (invite.acceptedAt) return NextResponse.json({ error: "Already accepted" }, { status: 409 });
  if (!userEmail || userEmail.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json({ error: "Token email mismatch" }, { status: 400 });
  }

  const membership = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: invite.groupId, userId } }, select: { userId: true } });
  if (!membership) {
    await prisma.groupMember.create({ data: { groupId: invite.groupId, userId, role: "MEMBER" } });
  }
  await prisma.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  return NextResponse.json({ ok: true });
}