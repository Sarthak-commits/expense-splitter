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
    return NextResponse.json({ 
      error: "Invalid input", 
      details: parsed.error.issues 
    }, { status: 400 });
  }
  const { fromUserId, toUserId, amount } = parsed.data;
  if (fromUserId === toUserId) {
    return NextResponse.json({ error: "fromUserId and toUserId must differ" }, { status: 400 });
  }

  let decimalAmount: Prisma.Decimal;
  try {
    const asString = String(amount);
    decimalAmount = new Prisma.Decimal(asString);
    if (decimalAmount.lte(0)) throw new Error("non-positive");
  } catch {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  // Verify group exists and requester has access
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        select: { userId: true, role: true }
      }
    }
  });
  
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  // Check if requester is a member or creator
  const memberSet = new Set(group.members.map((m) => m.userId));
  const isCreator = group.createdById === requesterId;
  const isMember = memberSet.has(requesterId);
  
  if (!isCreator && !isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify both from/to users are members of the group
  if (!memberSet.has(fromUserId) || !memberSet.has(toUserId)) {
    return NextResponse.json({ error: "Both users must be group members" }, { status: 400 });
  }

  // Additional validation: only allow the payer (fromUserId) or group owner to record settlements
  if (requesterId !== fromUserId && !isCreator) {
    return NextResponse.json({ 
      error: "Only the payer or group owner can record this settlement" 
    }, { status: 403 });
  }

  try {
    const created = await prisma.settlement.create({
      data: { 
        groupId, 
        fromUserId, 
        toUserId, 
        amount: decimalAmount 
      },
      include: {
        from: { select: { name: true, email: true } },
        to: { select: { name: true, email: true } },
        group: { select: { name: true } }
      }
    });
    
    return NextResponse.json({ 
      settlementId: created.id,
      settlement: {
        id: created.id,
        amount: created.amount.toString(),
        from: created.from,
        to: created.to,
        group: created.group,
        createdAt: created.createdAt
      }
    }, { status: 201 });
  } catch (err) {
    console.error("Settlement creation error:", err);
    return NextResponse.json({ error: "Failed to record settlement" }, { status: 500 });
  }
}

// GET endpoint to retrieve settlements for a group
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const groupId = params.id;

  // Verify membership
  const isMember = await prisma.group.findFirst({
    where: { 
      id: groupId, 
      OR: [
        { createdById: userId }, 
        { members: { some: { userId } } }
      ] 
    },
    select: { id: true }
  });
  
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const cursor = searchParams.get("cursor");

    const settlements = await prisma.settlement.findMany({
      where: { groupId },
      include: {
        from: { select: { name: true, email: true } },
        to: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 })
    });

    const hasNextPage = settlements.length > limit;
    const items = hasNextPage ? settlements.slice(0, -1) : settlements;
    const nextCursor = hasNextPage ? items[items.length - 1]?.id : null;

    return NextResponse.json({
      settlements: items.map(s => ({
        id: s.id,
        amount: s.amount.toString(),
        from: s.from,
        to: s.to,
        createdAt: s.createdAt
      })),
      pagination: {
        hasNextPage,
        nextCursor
      }
    });
  } catch (err) {
    console.error("Settlement retrieval error:", err);
    return NextResponse.json({ error: "Failed to retrieve settlements" }, { status: 500 });
  }
}
