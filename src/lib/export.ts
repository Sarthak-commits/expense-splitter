// CSV export utilities for expense splitter data

interface ExpenseExportData {
  id: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  splitType: string;
  paidBy: {
    name: string | null;
    email: string;
  };
  splits: Array<{
    user: {
      name: string | null;
      email: string;
    };
    amount: string;
  }>;
}

interface SettlementExportData {
  id: string;
  amount: string;
  createdAt: string;
  from: {
    name: string | null;
    email: string;
  };
  to: {
    name: string | null;
    email: string;
  };
}

interface MemberExportData {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  joinedAt: string;
  isCreator: boolean;
}

interface BalanceExportData {
  userId: string;
  name: string | null;
  email: string;
  balance: string;
  status: 'owes' | 'is_owed' | 'settled';
}

// Utility function to escape CSV fields
function escapeCSVField(field: any): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  // Escape quotes by doubling them and wrap in quotes if contains comma, quote, or newline
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Convert array of objects to CSV string
function arrayToCSV(data: any[], headers: string[]): string {
  const csvHeaders = headers.map(escapeCSVField).join(',');
  const csvRows = data.map(row => 
    headers.map(header => escapeCSVField(row[header])).join(',')
  );
  return [csvHeaders, ...csvRows].join('\n');
}

// Export expenses to CSV format
export function exportExpensesToCSV(expenses: ExpenseExportData[], groupName: string): string {
  const flattenedData = expenses.flatMap(expense => 
    expense.splits.map(split => ({
      expense_id: expense.id,
      description: expense.description,
      total_amount: expense.amount,
      currency: expense.currency,
      date: expense.date,
      split_type: expense.splitType,
      paid_by_name: expense.paidBy.name || '',
      paid_by_email: expense.paidBy.email,
      split_user_name: split.user.name || '',
      split_user_email: split.user.email,
      split_amount: split.amount,
    }))
  );

  const headers = [
    'expense_id',
    'description', 
    'total_amount',
    'currency',
    'date',
    'split_type',
    'paid_by_name',
    'paid_by_email',
    'split_user_name',
    'split_user_email',
    'split_amount'
  ];

  const csvContent = arrayToCSV(flattenedData, headers);
  const timestamp = new Date().toISOString().split('T')[0];
  const header = `# Expenses Export for "${groupName}"\n# Generated on ${timestamp}\n# Total expenses: ${expenses.length}\n\n`;
  
  return header + csvContent;
}

// Export settlements to CSV format
export function exportSettlementsToCSV(settlements: SettlementExportData[], groupName: string): string {
  const flattenedData = settlements.map(settlement => ({
    settlement_id: settlement.id,
    amount: settlement.amount,
    date: settlement.createdAt,
    from_name: settlement.from.name || '',
    from_email: settlement.from.email,
    to_name: settlement.to.name || '',
    to_email: settlement.to.email,
  }));

  const headers = [
    'settlement_id',
    'amount',
    'date',
    'from_name',
    'from_email',
    'to_name',
    'to_email'
  ];

  const csvContent = arrayToCSV(flattenedData, headers);
  const timestamp = new Date().toISOString().split('T')[0];
  const header = `# Settlements Export for "${groupName}"\n# Generated on ${timestamp}\n# Total settlements: ${settlements.length}\n\n`;
  
  return header + csvContent;
}

// Export members to CSV format
export function exportMembersToCSV(members: MemberExportData[], groupName: string): string {
  const flattenedData = members.map(member => ({
    user_id: member.userId,
    name: member.name || '',
    email: member.email,
    role: member.role,
    joined_at: member.joinedAt,
    is_creator: member.isCreator ? 'Yes' : 'No'
  }));

  const headers = [
    'user_id',
    'name',
    'email',
    'role',
    'joined_at',
    'is_creator'
  ];

  const csvContent = arrayToCSV(flattenedData, headers);
  const timestamp = new Date().toISOString().split('T')[0];
  const header = `# Members Export for "${groupName}"\n# Generated on ${timestamp}\n# Total members: ${members.length}\n\n`;
  
  return header + csvContent;
}

// Export balances to CSV format
export function exportBalancesToCSV(balances: BalanceExportData[], groupName: string): string {
  const flattenedData = balances.map(balance => ({
    user_id: balance.userId,
    name: balance.name || '',
    email: balance.email,
    balance: balance.balance,
    status: balance.status
  }));

  const headers = [
    'user_id',
    'name',
    'email',
    'balance',
    'status'
  ];

  const csvContent = arrayToCSV(flattenedData, headers);
  const timestamp = new Date().toISOString().split('T')[0];
  const header = `# Balances Export for "${groupName}"\n# Generated on ${timestamp}\n# Export includes current member balances\n\n`;
  
  return header + csvContent;
}

// Export comprehensive group data
export function exportGroupSummaryToCSV(data: {
  groupName: string;
  expenses: ExpenseExportData[];
  settlements: SettlementExportData[];
  members: MemberExportData[];
  balances: BalanceExportData[];
}): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const totalExpenseAmount = data.expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
  const totalSettlementAmount = data.settlements.reduce((sum, settlement) => sum + parseFloat(settlement.amount), 0);
  
  let summary = `# Complete Group Export for "${data.groupName}"\n`;
  summary += `# Generated on ${timestamp}\n\n`;
  summary += `## Summary Statistics\n`;
  summary += `# Total Members: ${data.members.length}\n`;
  summary += `# Total Expenses: ${data.expenses.length}\n`;
  summary += `# Total Expense Amount: $${totalExpenseAmount.toFixed(2)}\n`;
  summary += `# Total Settlements: ${data.settlements.length}\n`;
  summary += `# Total Settlement Amount: $${totalSettlementAmount.toFixed(2)}\n\n`;

  // Add each section
  summary += `## MEMBERS\n`;
  summary += exportMembersToCSV(data.members, data.groupName).split('\n').slice(4).join('\n') + '\n\n';

  summary += `## EXPENSES\n`;
  summary += exportExpensesToCSV(data.expenses, data.groupName).split('\n').slice(4).join('\n') + '\n\n';

  if (data.settlements.length > 0) {
    summary += `## SETTLEMENTS\n`;
    summary += exportSettlementsToCSV(data.settlements, data.groupName).split('\n').slice(4).join('\n') + '\n\n';
  }

  summary += `## CURRENT BALANCES\n`;
  summary += exportBalancesToCSV(data.balances, data.groupName).split('\n').slice(4).join('\n') + '\n';

  return summary;
}

// Generate filename for exports
export function generateExportFilename(groupName: string, type: string): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const sanitizedGroupName = groupName.replace(/[^a-zA-Z0-9\-_]/g, '_').toLowerCase();
  return `${sanitizedGroupName}_${type}_${timestamp}.csv`;
}

// Export types for use in API routes
export type { 
  ExpenseExportData, 
  SettlementExportData, 
  MemberExportData, 
  BalanceExportData 
};