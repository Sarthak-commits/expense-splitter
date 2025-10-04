import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { expenseCreateSchema } from "@/lib/schemas";
import { computeEqualSplits } from "@/lib/split";

async function canModify(expenseId: string, userId: string) {
  const exp = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: {
      id: true,
      groupId: true,
      paidById: true,
      group: { select: { createdById: true } },
    },
  });
  if (!exp) return { allow: false, groupId: null } as const;
  const isOwner = exp.group.createdById === userId;
  const isPayer = exp.paidById === userId;
  return { allow: isOwner || isPayer, groupId: exp.groupId } as const;
}

export async function DELETE(
  _req: Request,
  { params }: { params: { expenseId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const { expenseId } = params;

  const { allow } = await canModify(expenseId, userId);
  if (!allow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.expenseSplit.deleteMany({ where: { expenseId } });
      await tx.expense.delete({ where: { id: expenseId } });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { expenseId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const { expenseId } = params;

  const body = await req.json().catch(() => ({}));
  const parsed = expenseCreateSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { allow, groupId } = await canModify(expenseId, userId);
  if (!allow || !groupId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const toUpdate: any = {};
  if (typeof parsed.data?.description === "string") toUpdate.description = parsed.data.description;
  if (typeof parsed.data?.currency === "string") toUpdate.currency = parsed.data.currency;

  let decimalAmount: Prisma.Decimal | undefined;
  if (parsed.data?.amount !== undefined) {
    try {
      const asString = typeof parsed.data.amount === "number" ? parsed.data.amount.toString() : parsed.data.amount;
      decimalAmount = new Prisma.Decimal(asString);
      if (decimalAmount.lte(0)) throw new Error("non-positive");
      toUpdate.amount = decimalAmount;
    } catch {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }
  }

  // If amount changed, recompute equal splits for now
  try {
    await prisma.$transaction(async (tx) => {
      await tx.expense.update({ where: { id: expenseId }, data: toUpdate });

      if (decimalAmount) {
        const members = await tx.groupMember.findMany({
          where: { groupId },
          select: { userId: true },
        });
        const memberIds = members.map((m) => m.userId);
        const splits = computeEqualSplits(decimalAmount!, memberIds);
        await tx.expenseSplit.deleteMany({ where: { expenseId } });
        await tx.expenseSplit.createMany({
          data: splits.map((s) => ({ expenseId, userId: s.userId, amount: s.amount })),
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}