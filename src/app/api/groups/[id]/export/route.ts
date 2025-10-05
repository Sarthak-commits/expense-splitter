import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeBalances } from "@/lib/balances";
import {
  exportExpensesToCSV,
  exportSettlementsToCSV,
  exportMembersToCSV,
  exportBalancesToCSV,
  exportGroupSummaryToCSV,
  generateExportFilename,
  type ExpenseExportData,
  type SettlementExportData,
  type MemberExportData,
  type BalanceExportData
} from "@/lib/export";
import { Prisma } from "@prisma/client";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const groupId = params.id;

  // Verify group access
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [
        { createdById: userId },
        { members: { some: { userId } } }
      ]
    },
    select: {
      id: true,
      name: true,
      createdById: true,
      members: {
        select: { userId: true, role: true }
      }
    }
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found or access denied" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const exportType = searchParams.get('type') || 'summary';
    const format = searchParams.get('format') || 'csv';

    // Only support CSV for now
    if (format !== 'csv') {
      return NextResponse.json({ error: "Only CSV format is currently supported" }, { status: 400 });
    }

    // Validate export type
    const validTypes = ['expenses', 'settlements', 'members', 'balances', 'summary'];
    if (!validTypes.includes(exportType)) {
      return NextResponse.json({ 
        error: "Invalid export type", 
        validTypes 
      }, { status: 400 });
    }

    // Fetch all necessary data
    const [expenses, settlements, members] = await Promise.all([
      // Expenses with splits
      prisma.expense.findMany({
        where: { groupId },
        include: {
          paidBy: { select: { name: true, email: true } },
          splits: {
            include: {
              user: { select: { name: true, email: true } }
            }
          }
        },
        orderBy: { date: 'desc' }
      }),

      // Settlements
      prisma.settlement.findMany({
        where: { groupId },
        include: {
          from: { select: { name: true, email: true } },
          to: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),

      // Members
      prisma.groupMember.findMany({
        where: { groupId },
        include: {
          user: { select: { name: true, email: true } }
        },
        orderBy: [
          { role: 'asc' },
          { joinedAt: 'asc' }
        ]
      })
    ]);

    // Transform data for export
    const expenseExportData: ExpenseExportData[] = expenses.map(expense => ({
      id: expense.id,
      description: expense.description,
      amount: expense.amount.toString(),
      currency: expense.currency,
      date: expense.date.toISOString(),
      splitType: expense.splitType,
      paidBy: expense.paidBy,
      splits: expense.splits.map(split => ({
        user: split.user,
        amount: split.amount.toString()
      }))
    }));

    const settlementExportData: SettlementExportData[] = settlements.map(settlement => ({
      id: settlement.id,
      amount: settlement.amount.toString(),
      createdAt: settlement.createdAt.toISOString(),
      from: settlement.from,
      to: settlement.to
    }));

    const memberExportData: MemberExportData[] = members.map(member => ({
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
      isCreator: member.userId === group.createdById
    }));

    // Calculate balances
    const memberIds = members.map(m => m.userId);
    const expensesForBalance = expenses.map(e => ({ paidById: e.paidById, amount: e.amount }));
    const splitsForBalance = expenses.flatMap(e => 
      e.splits.map(s => ({ userId: s.userId, amount: s.amount }))
    );
    const settlementsForBalance = settlements.map(s => ({
      fromUserId: s.fromUserId,
      toUserId: s.toUserId,
      amount: s.amount
    }));

    const balances = computeBalances(memberIds, expensesForBalance, splitsForBalance, settlementsForBalance);
    const balanceExportData: BalanceExportData[] = members.map(member => {
      const balance = balances[member.userId] || new Prisma.Decimal(0);
      const balanceNumber = parseFloat(balance.toFixed(2));
      
      return {
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        balance: balance.toFixed(2),
        status: balanceNumber > 0.01 ? 'is_owed' : balanceNumber < -0.01 ? 'owes' : 'settled'
      };
    });

    // Generate appropriate export based on type
    let csvContent: string;
    let filename: string;

    switch (exportType) {
      case 'expenses':
        csvContent = exportExpensesToCSV(expenseExportData, group.name);
        filename = generateExportFilename(group.name, 'expenses');
        break;

      case 'settlements':
        csvContent = exportSettlementsToCSV(settlementExportData, group.name);
        filename = generateExportFilename(group.name, 'settlements');
        break;

      case 'members':
        csvContent = exportMembersToCSV(memberExportData, group.name);
        filename = generateExportFilename(group.name, 'members');
        break;

      case 'balances':
        csvContent = exportBalancesToCSV(balanceExportData, group.name);
        filename = generateExportFilename(group.name, 'balances');
        break;

      case 'summary':
      default:
        csvContent = exportGroupSummaryToCSV({
          groupName: group.name,
          expenses: expenseExportData,
          settlements: settlementExportData,
          members: memberExportData,
          balances: balanceExportData
        });
        filename = generateExportFilename(group.name, 'complete');
        break;
    }

    // Return CSV file as download
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }
}

// POST endpoint for custom export configurations
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const groupId = params.id;

  // Verify group access
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [
        { createdById: userId },
        { members: { some: { userId } } }
      ]
    },
    select: { id: true, name: true }
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found or access denied" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      types = ['summary'],
      dateFrom,
      dateTo,
      includeSettlements = true,
      format = 'csv'
    } = body;

    // Only support CSV for now
    if (format !== 'csv') {
      return NextResponse.json({ error: "Only CSV format is currently supported" }, { status: 400 });
    }

    // Build date filter for expenses
    const dateFilter: any = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);
    
    const whereClause: any = { groupId };
    if (Object.keys(dateFilter).length > 0) {
      whereClause.date = dateFilter;
    }

    // Fetch filtered data
    const [expenses, settlements, members] = await Promise.all([
      prisma.expense.findMany({
        where: whereClause,
        include: {
          paidBy: { select: { name: true, email: true } },
          splits: {
            include: {
              user: { select: { name: true, email: true } }
            }
          }
        },
        orderBy: { date: 'desc' }
      }),

      includeSettlements ? prisma.settlement.findMany({
        where: {
          groupId,
          ...(dateFrom || dateTo ? {
            createdAt: dateFilter
          } : {})
        },
        include: {
          from: { select: { name: true, email: true } },
          to: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
      }) : [],

      prisma.groupMember.findMany({
        where: { groupId },
        include: {
          user: { select: { name: true, email: true } }
        },
        orderBy: [
          { role: 'asc' },
          { joinedAt: 'asc' }
        ]
      })
    ]);

    return NextResponse.json({
      success: true,
      message: "Custom export configuration processed",
      summary: {
        groupName: group.name,
        expenseCount: expenses.length,
        settlementCount: settlements.length,
        memberCount: members.length,
        dateRange: {
          from: dateFrom || null,
          to: dateTo || null
        }
      },
      downloadUrl: `/api/groups/${groupId}/export?type=summary&format=csv${dateFrom ? `&from=${dateFrom}` : ''}${dateTo ? `&to=${dateTo}` : ''}`
    });

  } catch (err) {
    console.error("Custom export error:", err);
    return NextResponse.json({ error: "Failed to process custom export" }, { status: 500 });
  }
}