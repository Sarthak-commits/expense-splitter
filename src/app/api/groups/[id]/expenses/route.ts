import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { expenseCreateSchema } from "@/lib/schemas";
import { computeEqualSplits } from "@/lib/split";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const groupId = params.id;

  const json = await req.json().catch(() => ({}));
  const parsed = expenseCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { description, amount, currency } = parsed.data;

  // parse amount safely into Decimal
  let decimalAmount: Prisma.Decimal;
  try {
    const asString = typeof amount === "number" ? amount.toString() : amount;
    decimalAmount = new Prisma.Decimal(asString);
    if (decimalAmount.lte(0)) throw new Error("non-positive");
  } catch {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  // Check membership and fetch members to split equally
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [
        { createdById: userId },
        { members: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      members: { select: { userId: true } },
    },
  });

  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const memberIds = group.members.map((m) => m.userId);
  if (memberIds.length === 0) {
    return NextResponse.json({ error: "Group has no members to split with" }, { status: 400 });
  }

  const splits = computeEqualSplits(decimalAmount, memberIds);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          groupId,
          paidById: userId, // for now, payer is the requesting user
          amount: decimalAmount,
          currency,
          description,
          splitType: "EQUAL",
        },
        select: { id: true },
      });

      await tx.expenseSplit.createMany({
        data: splits.map((s) => ({
          expenseId: expense.id,
          userId: s.userId,
          amount: s.amount,
        })),
      });

      return expense;
    });

    return NextResponse.json({ expenseId: created.id }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
