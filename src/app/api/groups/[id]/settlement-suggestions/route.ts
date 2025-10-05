import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeBalances } from "@/lib/balances";
import { Prisma } from "@prisma/client";

type BalanceUser = {
  userId: string;
  name: string | null;
  email: string;
  amount: Prisma.Decimal;
};

type SettlementSuggestion = {
  fromUserId: string;
  fromName: string | null;
  fromEmail: string;
  toUserId: string;
  toName: string | null;
  toEmail: string;
  amount: string;
};

// Advanced debt optimization algorithm to minimize number of transactions
function optimizeSettlements(creditors: BalanceUser[], debtors: BalanceUser[]): SettlementSuggestion[] {
  const suggestions: SettlementSuggestion[] = [];
  
  // Create working copies
  const workingCreditors = creditors.map(c => ({ ...c, amount: new Prisma.Decimal(c.amount.toString()) }));
  const workingDebtors = debtors.map(d => ({ ...d, amount: new Prisma.Decimal(d.amount.toString()) }));
  
  // Sort by amount descending for better optimization
  workingCreditors.sort((a, b) => b.amount.comparedTo(a.amount));
  workingDebtors.sort((a, b) => b.amount.comparedTo(a.amount));
  
  let creditorIndex = 0;
  let debtorIndex = 0;
  
  while (creditorIndex < workingCreditors.length && debtorIndex < workingDebtors.length) {
    const creditor = workingCreditors[creditorIndex];
    const debtor = workingDebtors[debtorIndex];
    
    // Skip if amounts are essentially zero (less than 1 cent)
    if (creditor.amount.lessThan(0.01)) {
      creditorIndex++;
      continue;
    }
    if (debtor.amount.lessThan(0.01)) {
      debtorIndex++;
      continue;
    }
    
    // Calculate the settlement amount (minimum of what creditor is owed and debtor owes)
    const settlementAmount = Prisma.Decimal.min(creditor.amount, debtor.amount);
    
    // Only create settlement if amount is meaningful (>= 1 cent)
    if (settlementAmount.greaterThanOrEqualTo(0.01)) {
      suggestions.push({
        fromUserId: debtor.userId,
        fromName: debtor.name,
        fromEmail: debtor.email,
        toUserId: creditor.userId,
        toName: creditor.name,
        toEmail: creditor.email,
        amount: settlementAmount.toFixed(2)
      });
      
      // Update remaining amounts
      creditor.amount = creditor.amount.minus(settlementAmount);
      debtor.amount = debtor.amount.minus(settlementAmount);
    }
    
    // Move to next creditor/debtor if current one is settled
    if (creditor.amount.lessThan(0.01)) creditorIndex++;
    if (debtor.amount.lessThan(0.01)) debtorIndex++;
  }
  
  return suggestions;
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const groupId = params.id;

  // Verify membership and get group info
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
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      }
    },
  });
  
  if (!group) {
    return NextResponse.json({ error: "Group not found or access denied" }, { status: 403 });
  }

  try {
    // Get all financial data for the group
    const memberIds = group.members.map((m) => m.userId);
    const expenses = await prisma.expense.findMany({ 
      where: { groupId }, 
      select: { paidById: true, amount: true } 
    });
    const splits = await prisma.expenseSplit.findMany({ 
      where: { expense: { groupId } }, 
      select: { userId: true, amount: true } 
    });
    const settlements = await prisma.settlement.findMany({ 
      where: { groupId }, 
      select: { fromUserId: true, toUserId: true, amount: true } 
    });

    // Compute net balances
    const net = computeBalances(memberIds, expenses, splits, settlements);
    
    // Create user lookup map
    const userMap = new Map<string, { name: string | null; email: string }>();
    group.members.forEach(m => {
      userMap.set(m.userId, { name: m.user.name, email: m.user.email });
    });
    
    // Separate creditors and debtors with user details
    const creditors: BalanceUser[] = [];
    const debtors: BalanceUser[] = [];
    
    for (const uid of memberIds) {
      const val = net[uid] ?? new Prisma.Decimal(0);
      const roundedBalance = new Prisma.Decimal(val.toFixed(2));
      const userInfo = userMap.get(uid);
      
      if (!userInfo) continue; // Skip if user info not found
      
      if (roundedBalance.greaterThan(0.009)) {
        creditors.push({ 
          userId: uid, 
          name: userInfo.name, 
          email: userInfo.email, 
          amount: roundedBalance 
        });
      } else if (roundedBalance.lessThan(-0.009)) {
        debtors.push({ 
          userId: uid, 
          name: userInfo.name, 
          email: userInfo.email, 
          amount: roundedBalance.abs() 
        });
      }
    }

    // Generate optimized settlement suggestions
    const suggestions = optimizeSettlements(creditors, debtors);
    
    // Calculate summary statistics
    const totalDebt = debtors.reduce((sum, debtor) => sum.plus(debtor.amount), new Prisma.Decimal(0));
    const numTransactions = suggestions.length;
    
    const { searchParams } = new URL(req.url);
    const includeDetails = searchParams.get('details') === 'true';

    const response: any = {
      suggestions,
      summary: {
        totalDebt: totalDebt.toFixed(2),
        numTransactions,
        numCreditors: creditors.length,
        numDebtors: debtors.length
      }
    };
    
    // Include detailed balance information if requested
    if (includeDetails) {
      response.balanceDetails = {
        creditors: creditors.map(c => ({
          userId: c.userId,
          name: c.name,
          email: c.email,
          balance: c.amount.toFixed(2)
        })),
        debtors: debtors.map(d => ({
          userId: d.userId,
          name: d.name,
          email: d.email,
          balance: `-${d.amount.toFixed(2)}`
        })),
        settled: memberIds
          .filter(uid => {
            const val = net[uid] ?? new Prisma.Decimal(0);
            const rounded = new Prisma.Decimal(val.toFixed(2));
            return rounded.abs().lessThan(0.01);
          })
          .map(uid => {
            const userInfo = userMap.get(uid);
            return {
              userId: uid,
              name: userInfo?.name || null,
              email: userInfo?.email || '',
              balance: '0.00'
            };
          })
      };
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("Settlement suggestions error:", err);
    return NextResponse.json({ error: "Failed to generate settlement suggestions" }, { status: 500 });
  }
}
