import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const expenseSchema = z.object({
  description: z.string().min(1).max(200),
  amount: z.union([z.string(), z.number()]),
  currency: z.string().min(3).max(10).default("USD"),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const groupId = params.id;

  const json = await req.json().catch(() => ({}));
  const parsed = expenseSchema.safeParse(json);
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

  // Equal split among all members
  const n = new Prisma.Decimal(memberIds.length);
  const base = decimalAmount.dividedBy(n);
  // Round to 2 decimals for display friendliness
  const baseRounded = new Prisma.Decimal(base.toFixed(2));
  // Distribute remainder to first few members to ensure sum == amount
  const totalRounded = baseRounded.mul(n);
  let remainder = decimalAmount.minus(totalRounded); // could be negative due to rounding

  const splits = memberIds.map((uid) => {
    let amt = baseRounded;
    if (!remainder.isZero()) {
      // Adjust by 0.01 towards the remainder's sign until remainder zero
      const step = new Prisma.Decimal(remainder.greaterThan(0) ? "0.01" : "-0.01");
      amt = amt.plus(step);
      remainder = remainder.minus(step);
    }
    return { userId: uid, amount: amt };
  });

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
