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
  const { description, amount, currency, splitType, splits } = parsed.data as any;

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

  let splitRows: { userId: string; amount: Prisma.Decimal }[] = [];
  if (splitType && splitType === "EXACT") {
    // Validate provided splits
    if (!Array.isArray(splits)) {
      return NextResponse.json({ error: "splits array required for EXACT" }, { status: 400 });
    }
    const provided = new Map<string, Prisma.Decimal>();
    try {
      for (const s of splits) {
        if (typeof s?.userId !== "string" || (typeof s?.amount !== "string" && typeof s?.amount !== "number")) {
          return NextResponse.json({ error: "Invalid splits format" }, { status: 400 });
        }
        const amtStr = typeof s.amount === "number" ? s.amount.toString() : s.amount;
        const dec = new Prisma.Decimal(amtStr);
        if (dec.lt(0)) return NextResponse.json({ error: "Split amounts must be >= 0" }, { status: 400 });
        provided.set(s.userId, new Prisma.Decimal(dec.toFixed(2)));
      }
    } catch {
      return NextResponse.json({ error: "Invalid split amounts" }, { status: 400 });
    }
    // Ensure all and only group members are present
    for (const uid of memberIds) {
      if (!provided.has(uid)) return NextResponse.json({ error: "All members must have a split amount" }, { status: 400 });
    }
    if (provided.size !== memberIds.length) {
      return NextResponse.json({ error: "Unexpected users in splits" }, { status: 400 });
    }
    const sum = Array.from(provided.values()).reduce((acc, d) => acc.plus(d), new Prisma.Decimal(0));
    if (!sum.equals(new Prisma.Decimal(decimalAmount.toFixed(2)))) {
      return NextResponse.json({ error: "Split amounts must sum to total amount" }, { status: 400 });
    }
    splitRows = memberIds.map((uid) => ({ userId: uid, amount: provided.get(uid)! }));
  } else {
    splitRows = computeEqualSplits(decimalAmount, memberIds);
  }

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
