import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { expenseCreateSchema } from "@/lib/schemas";
import { computeEqualSplits } from "@/lib/split";
import { z } from "zod";

const expenseUpdateSchema = z.object({
  description: z.string().min(1).max(200).optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  splitType: z.enum(["EQUAL", "EXACT", "PERCENT"]).optional(),
  category: z.string().optional(),
  splits: z.array(z.object({
    userId: z.string(),
    amount: z.union([z.string(), z.number()]),
  })).optional(),
});

async function canModify(expenseId: string, userId: string) {
  const exp = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: {
      id: true,
      groupId: true,
      paidById: true,
      amount: true,
      description: true,
      date: true,
      splitType: true,
      category: true,
      group: { 
        select: { 
          id: true,
          createdById: true,
          name: true,
          members: {
            where: { userId },
            select: { role: true }
          }
        } 
      },
      paidBy: {
        select: { name: true, email: true }
      },
      splits: {
        include: {
          user: { select: { name: true, email: true } }
        }
      }
    },
  });
  
  if (!exp) return { 
    allow: false, 
    groupId: null, 
    expense: null,
    reason: "Expense not found" 
  } as const;
  
  const isGroupOwner = exp.group.createdById === userId;
  const isPayer = exp.paidById === userId;
  const isMember = exp.group.members.length > 0;
  const memberRole = exp.group.members[0]?.role;
  
  // Allow modification if user is:
  // 1. The person who paid for the expense, OR
  // 2. The group owner, OR 
  // 3. An admin of the group
  const canModify = isPayer || isGroupOwner || (isMember && memberRole === "ADMIN");
  
  return { 
    allow: canModify, 
    groupId: exp.groupId,
    expense: exp,
    isPayer,
    isGroupOwner,
    memberRole,
    reason: canModify ? null : "Only the payer, group owner, or group admin can modify this expense"
  } as const;
}

// GET endpoint to retrieve expense details
export async function GET(
  _req: Request,
  { params }: { params: { expenseId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const { expenseId } = params;

  const { allow, expense, reason } = await canModify(expenseId, userId);
  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  // Allow viewing if user is a group member (even if they can't modify)
  const isMember = await prisma.groupMember.findFirst({
    where: { groupId: expense.groupId, userId },
    select: { id: true }
  });
  
  const isGroupOwner = expense.group.createdById === userId;
  if (!isMember && !isGroupOwner) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  return NextResponse.json({
    expense: {
      id: expense.id,
      description: expense.description,
      amount: expense.amount.toString(),
      date: expense.date,
      splitType: expense.splitType,
      paidBy: expense.paidBy,
      splits: expense.splits.map(split => ({
        userId: split.userId,
        amount: split.amount.toString(),
        user: split.user
      })),
      group: {
        name: expense.group.name
      },
      category: expense.category,
      canModify: allow,
      modifyReason: reason
    }
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { expenseId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const { expenseId } = params;

  const { allow, expense, reason } = await canModify(expenseId, userId);
  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }
  if (!allow) {
    return NextResponse.json({ error: reason || "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Delete all expense splits first
      await tx.expenseSplit.deleteMany({ where: { expenseId } });
      // Then delete the expense
      await tx.expense.delete({ where: { id: expenseId } });
    });
    
    return NextResponse.json({ 
      success: true,
      message: `Expense "${expense.description}" has been deleted`,
      deletedExpense: {
        id: expense.id,
        description: expense.description,
        amount: expense.amount.toString()
      }
    });
  } catch (err: any) {
    console.error("Delete expense error:", err);
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
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
  const parsed = expenseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ 
      error: "Invalid input", 
      details: parsed.error.issues 
    }, { status: 400 });
  }

  const { allow, groupId, expense, reason } = await canModify(expenseId, userId);
  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }
  if (!allow || !groupId) {
    return NextResponse.json({ error: reason || "Forbidden" }, { status: 403 });
  }

  const toUpdate: any = {};
  if (parsed.data.description !== undefined) toUpdate.description = parsed.data.description;
  if (parsed.data.currency !== undefined) toUpdate.currency = parsed.data.currency;
  if (parsed.data.splitType !== undefined) toUpdate.splitType = parsed.data.splitType;
  if (parsed.data.category !== undefined) toUpdate.category = String(parsed.data.category).toUpperCase();

  let decimalAmount: Prisma.Decimal | undefined;
  if (parsed.data.amount !== undefined) {
    try {
      const asString = typeof parsed.data.amount === "number" ? parsed.data.amount.toString() : parsed.data.amount;
      decimalAmount = new Prisma.Decimal(asString);
      if (decimalAmount.lte(0)) throw new Error("non-positive");
      toUpdate.amount = decimalAmount;
    } catch {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }
  }

  // Handle split updates
  const shouldUpdateSplits = decimalAmount || parsed.data.splitType || parsed.data.splits;
  
  try {
    const updatedExpense = await prisma.$transaction(async (tx) => {
      // Update the expense
      const updated = await tx.expense.update({ 
        where: { id: expenseId }, 
        data: toUpdate,
        include: {
          paidBy: { select: { name: true, email: true } },
          group: { select: { name: true } }
        }
      });

      if (shouldUpdateSplits) {
        // Get all group members
        const members = await tx.groupMember.findMany({
          where: { groupId },
          select: { userId: true },
        });
        const memberIds = members.map((m) => m.userId);
        
        // Delete existing splits
        await tx.expenseSplit.deleteMany({ where: { expenseId } });
        
        const finalAmount = decimalAmount || expense.amount;
        const splitType = parsed.data.splitType || expense.splitType;
        
        let splits: { userId: string; amount: Prisma.Decimal }[] = [];
        
        if (splitType === "EQUAL" || !parsed.data.splits) {
          // Recompute equal splits
          splits = computeEqualSplits(finalAmount, memberIds);
        } else if (splitType === "EXACT" && parsed.data.splits) {
          // Validate exact splits
          const providedSplits = parsed.data.splits;
          let totalSplitAmount = new Prisma.Decimal(0);
          
          splits = providedSplits.map(split => {
            const amount = new Prisma.Decimal(split.amount.toString());
            totalSplitAmount = totalSplitAmount.plus(amount);
            return { userId: split.userId, amount };
          });
          
          // Validate that splits sum to total amount
          if (!totalSplitAmount.equals(finalAmount)) {
            throw new Error(`Split amounts (${totalSplitAmount}) must sum to total amount (${finalAmount})`);
          }
        }
        
        // Create new splits
        await tx.expenseSplit.createMany({
          data: splits.map((s) => ({ expenseId, userId: s.userId, amount: s.amount })),
        });
      }
      
      return updated;
    });

    // Fetch the complete updated expense with splits
    const completeExpense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        paidBy: { select: { name: true, email: true } },
        group: { select: { name: true } },
        splits: {
          include: {
            user: { select: { name: true, email: true } }
          }
        }
      }
    });

    return NextResponse.json({ 
      success: true,
      message: "Expense updated successfully",
      expense: {
        id: completeExpense!.id,
        description: completeExpense!.description,
        amount: completeExpense!.amount.toString(),
        currency: completeExpense!.currency,
        splitType: completeExpense!.splitType,
        category: completeExpense!.category,
        date: completeExpense!.date,
        paidBy: completeExpense!.paidBy,
        group: completeExpense!.group,
        splits: completeExpense!.splits.map(split => ({
          userId: split.userId,
          amount: split.amount.toString(),
          user: split.user
        }))
      }
    });
  } catch (err: any) {
    console.error("Update expense error:", err);
    if (err?.message?.includes("Split amounts")) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}
