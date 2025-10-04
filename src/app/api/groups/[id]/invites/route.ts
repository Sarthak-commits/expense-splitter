import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({ email: z.string().email() });

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requesterId = (session.user as any).id as string;
  const groupId = params.id;

  const group = await prisma.group.findUnique({ select: { createdById: true }, where: { id: groupId } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (group.createdById !== requesterId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { email } = parsed.data;
  const existingMember = await prisma.groupMember.findFirst({ where: { groupId, user: { email } }, select: { id: true } });
  if (existingMember) return NextResponse.json({ error: "User already a member" }, { status: 409 });

  const token = (await import("crypto")).randomBytes(24).toString("hex");

  const invite = await prisma.invitation.upsert({
    where: { groupId_email: { groupId, email } },
    update: { token, invitedById: requesterId, acceptedAt: null },
    create: { groupId, email, token, invitedById: requesterId },
    select: { token: true },
  });

  return NextResponse.json({ token: invite.token }, { status: 201 });
}