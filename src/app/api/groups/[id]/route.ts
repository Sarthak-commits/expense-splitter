import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const groupId = params.id;

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { createdById: true } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (group.createdById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.expenseSplit.deleteMany({ where: { expense: { groupId } } });
      await tx.expense.deleteMany({ where: { groupId } });
      await tx.settlement.deleteMany({ where: { groupId } });
      await tx.groupMember.deleteMany({ where: { groupId } });
      await tx.invitation.deleteMany({ where: { groupId } });
      await tx.group.delete({ where: { id: groupId } });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 });
  }
}