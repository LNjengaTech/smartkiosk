// frontend/src/types/reports.ts
// Purpose: All report response interfaces matching the Laravel ReportService DTOs.

export interface DashboardSummary {
  todayRevenue: number;
  todayOrderCount: number;
  todayProfit: number;
  todayProfitMargin: number; // percentage
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number;
  topProductsToday: TopProduct[];
  recentTransactions: RecentTransaction[];
  comparedToYesterday: {
    revenueChange: number; // percentage — positive = up, negative = down
    orderCountChange: number;
  };
}

export interface TopProduct {
  productId: string;
  name: string;
  imageUrl: string | null;
  revenue: number;
  unitsSold: number;
}

export interface RecentTransaction {
  saleId: string;
  receiptNumber: string;
  cashierName: string;
  totalAmount: number;
  paymentMethod: string;
  status: 'completed' | 'voided' | 'refunded';
  soldAt: string;
}

export interface DailyRevenuePoint {
  date: string; // ISO date string
  revenue: number;
  orderCount: number;
  profit: number;
}

export interface SalesReport {
  period: { from: string; to: string };
  totalRevenue: number;
  totalOrders: number;
  totalProfit: number;
  averageOrderValue: number;
  dataPoints: DailyRevenuePoint[];
  paymentBreakdown: PaymentBreakdown;
}

export interface PaymentBreakdown {
  cash: number;
  mpesa: number;
  bank: number;
  mixed: number;
  cashPercentage: number;
  mpesaPercentage: number;
  bankPercentage: number;
  mixedPercentage: number;
}

export interface ProfitReport {
  period: { from: string; to: string };
  grossRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMargin: number; // percentage
  topProfitProducts: ProfitProduct[];
  dailyProfit: DailyRevenuePoint[];
}

export interface ProfitProduct {
  productId: string;
  name: string;
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
}

export interface AttendantPerformance {
  userId: string;
  name: string;
  salesCount: number;
  totalRevenue: number;
  voidCount: number;
  voidRate: number; // percentage
  averageOrderValue: number;
}

export interface ExpenseReport {
  period: { from: string; to: string };
  totalExpenses: number;
  byCategory: ExpenseCategorySummary[];
}

export interface ExpenseCategorySummary {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface StockReport {
  totalValue: number;
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number;
  items: StockReportItem[];
}

export interface StockReportItem {
  productId: string;
  name: string;
  sku: string | null;
  categoryName: string | null;
  quantity: number;
  reorderLevel: number;
  unit: 'piece' | 'kg' | 'litre' | 'pack';
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  buyingPrice: number;
  sellingPrice: number;
  stockValue: number;
}
