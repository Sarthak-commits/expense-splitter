import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { settlementCreateSchema } from "@/lib/schemas";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requesterId = (session.user as any).id as string;
  const groupId = params.id;

  const json = await req.json().catch(() => ({}));
  const parsed = settlementCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { fromUserId, toUserId, amount } = parsed.data;
  if (fromUserId === toUserId) {
    return NextResponse.json({ error: "fromUserId and toUserId must differ" }, { status: 400 });
  }

  let decimalAmount: Prisma.Decimal;
  try {
    const asString = typeof amount === "number" ? amount.toString() : amount;
    decimalAmount = new Prisma.Decimal(asString);
    if (decimalAmount.lte(0)) throw new Error("non-positive");
  } catch {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  // Verify requester is a member and both from/to are members of the group
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });
  const memberSet = new Set(members.map((m) => m.userId));
  // creator is also implicitly a member via GroupMember OWNER creation
  if (!memberSet.has(requesterId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!memberSet.has(fromUserId) || !memberSet.has(toUserId)) {
    return NextResponse.json({ error: "Both users must be group members" }, { status: 400 });
  }

  try {
    const created = await prisma.settlement.create({
      data: { groupId, fromUserId, toUserId, amount: decimalAmount },
      select: { id: true },
    });
    return NextResponse.json({ settlementId: created.id }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to record settlement" }, { status: 500 });
  }
}
