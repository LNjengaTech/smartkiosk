// frontend/src/app/(dashboard)/reports/page.tsx
// Purpose: Multi-tab business intelligence reports page (Sales, Stock, Profit, Attendants, Expenses)
//          driven by URL search parameters for date ranges, complete with Recharts charts,
//          CSV export triggers, and RoleGate checks.

'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Cell,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import {
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  DollarSign,
  Package,
  Calendar,
  Layers,
  Users,
  CreditCard,
  Percent,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleGate } from '@/components/shared/role-gate';
import { DateRangePicker } from '@/components/reports/date-range-picker';
import { ExportButton } from '@/components/reports/export-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatNumber, getErrorMessage } from '@/lib/utils';
import apiClient from '@/lib/api/client';
import type {
  SalesReport,
  StockReport,
  ProfitReport,
  AttendantPerformance,
  ExpenseReport,
} from '@/types/reports';

// ─── Chart Colors (HSL Theme Compliant) ───────────────────────────────────────

const COLORS = [
  'hsl(var(--primary))',
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#10b981', // Emerald
];

// ─── Custom Chart Tooltip ─────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  valuePrefix = '',
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
  valuePrefix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-card p-3 shadow-md text-sm">
      <p className="font-semibold text-foreground mb-1">
        {label && label.includes('-') ? format(parseISO(label), 'dd MMM yyyy') : label}
      </p>
      <div className="space-y-1">
        {payload.map((item, idx) => (
          <p key={idx} className="text-muted-foreground flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.name === 'Revenue' ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }} />
            <span>{item.name}:</span>
            <span className="font-semibold text-foreground">
              {valuePrefix === '$' ? formatCurrency(item.value) : formatNumber(item.value)}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── Access Restricted Fallback ────────────────────────────────────────────────

function AccessRestricted() {
  return (
    <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2 border-border bg-card">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Lock className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Access Restricted</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        This profit report contains sensitive business intelligence data and is restricted to store owners and super administrators only.
      </p>
    </Card>
  );
}

// ─── Main Reports Page ─────────────────────────────────────────────────────────

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const printAreaRef = React.useRef<HTMLDivElement>(null);

  // Date range from URL params or default (last 30 days)
  const from = searchParams.get('from') || format(subDays(new Date(), 29), 'yyyy-MM-dd');
  const to = searchParams.get('to') || format(new Date(), 'yyyy-MM-dd');

  const [salesChartType, setSalesChartType] = React.useState<'line' | 'bar'>('bar');
  const [groupBy, setGroupBy] = React.useState<'day' | 'week' | 'month'>('day');
  const [activeTab, setActiveTab] = React.useState<string>('sales');

  // ── 1. Sales Report Query ──────────────────────────────────────────────────
  const { data: salesData, isLoading: salesLoading } = useQuery<SalesReport>({
    queryKey: ['sales-report', from, to, groupBy],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: SalesReport }>(
        `/reports/sales?from=${from}&to=${to}&group_by=${groupBy}`
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });

  // ── 2. Stock Report Query ──────────────────────────────────────────────────
  const { data: stockData, isLoading: stockLoading } = useQuery<StockReport>({
    queryKey: ['stock-report'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: StockReport }>('/reports/stock');
      return res.data.data;
    },
    staleTime: 60_000,
    enabled: activeTab === 'stock',
  });

  // ── 3. Profit Report Query (Owner Only) ────────────────────────────────────
  const isOwner = user?.roles.includes('owner') || user?.roles.includes('super_admin');
  const { data: profitData, isLoading: profitLoading } = useQuery<ProfitReport>({
    queryKey: ['profit-report', from, to],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ProfitReport }>(
        `/reports/profit?from=${from}&to=${to}`
      );
      return res.data.data;
    },
    staleTime: 60_000,
    enabled: activeTab === 'profit' && isOwner,
  });

  // ── 4. Attendant Report Query ──────────────────────────────────────────────
  const { data: attendantData, isLoading: attendantLoading } = useQuery<AttendantPerformance[]>({
    queryKey: ['attendants-report', from, to],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: AttendantPerformance[] }>(
        `/reports/attendants?from=${from}&to=${to}`
      );
      return res.data.data;
    },
    staleTime: 60_000,
    enabled: activeTab === 'attendants',
  });

  // ── 5. Expense Report Query ────────────────────────────────────────────────
  const { data: expenseData, isLoading: expenseLoading } = useQuery<ExpenseReport>({
    queryKey: ['expense-report', from, to],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ExpenseReport }>(
        `/reports/expenses?from=${from}&to=${to}`
      );
      return res.data.data;
    },
    staleTime: 60_000,
    enabled: activeTab === 'expenses',
  });

  // ── Format Payment Data for Pie Chart ──────────────────────────────────────
  const paymentBreakdownData = salesData
    ? [
        { name: 'Cash', value: salesData.paymentBreakdown.cash },
        { name: 'M-Pesa', value: salesData.paymentBreakdown.mpesa },
        { name: 'Bank', value: salesData.paymentBreakdown.bank },
        { name: 'Mixed', value: salesData.paymentBreakdown.mixed },
      ].filter((item) => item.value > 0)
    : [];

  // ── Format Expense Data for Pie Chart ──────────────────────────────────────
  const expenseBreakdownData = expenseData
    ? expenseData.byCategory.map((cat) => ({
        name: cat.category.charAt(0).toUpperCase() + cat.category.slice(1),
        value: cat.total,
      }))
    : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Analyze sales performance, product trends, stock valuation, and profit margins.
          </p>
        </div>
        <ExportButton
          type={activeTab as any}
          from={from}
          to={to}
          printRef={printAreaRef}
        />
      </div>

      {/* Date range picker */}
      <DateRangePicker />

      {/* Main reports tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-xl flex flex-wrap h-auto gap-1">
          <TabsTrigger value="sales" className="rounded-lg text-sm px-4 py-2">
            Sales Analysis
          </TabsTrigger>
          <TabsTrigger value="stock" className="rounded-lg text-sm px-4 py-2">
            Stock Valuation
          </TabsTrigger>
          <TabsTrigger value="profit" className="rounded-lg text-sm px-4 py-2">
            Profit Margin
          </TabsTrigger>
          <TabsTrigger value="attendants" className="rounded-lg text-sm px-4 py-2">
            Attendant Rates
          </TabsTrigger>
          <TabsTrigger value="expenses" className="rounded-lg text-sm px-4 py-2">
            Expenses Summary
          </TabsTrigger>
        </TabsList>

        <div ref={printAreaRef} className="print:p-8 print:bg-white print:text-black">
          {/* Print Header (Only visible during print) */}
          <div className="hidden print:block mb-8">
            <h1 className="text-2xl font-bold">SmartKiosk Business Report</h1>
            <p className="text-sm text-gray-500">
              Period: {from} to {to}
            </p>
            <p className="text-sm text-gray-500">
              Generated on: {format(new Date(), 'yyyy-MM-dd HH:mm')}
            </p>
            <hr className="mt-4 border-gray-300" />
          </div>

          {/* ─── SALES TAB ──────────────────────────────────────────────────── */}
          <TabsContent value="sales" className="space-y-6 mt-0">
            {salesLoading ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-[100px] w-full rounded-2xl" />
                  ))}
                </div>
                <Skeleton className="h-[380px] w-full rounded-2xl" />
              </div>
            ) : salesData ? (
              <>
                {/* Sales metric summaries */}
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(salesData.totalRevenue)}</div>
                      <p className="text-xs text-muted-foreground mt-1">For selected date range</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                      <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatNumber(salesData.totalOrders)}</div>
                      <p className="text-xs text-muted-foreground mt-1">Completed sale transactions</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
                      <Percent className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(salesData.averageOrderValue)}</div>
                      <p className="text-xs text-muted-foreground mt-1">AOV per receipt checkout</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Estimated Gross Profit</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {isOwner ? (
                        <>
                          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(salesData.totalProfit)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {((salesData.totalProfit / (salesData.totalRevenue || 1)) * 100).toFixed(1)}% gross margin
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="text-lg font-semibold text-muted-foreground flex items-center gap-1.5 mt-1">
                            <Lock className="h-3.5 w-3.5" /> Muted
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5">Restricted to owners</p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Sales Chart Section */}
                <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                  <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>Sales Trend</CardTitle>
                        <CardDescription>Revenue and profit over time</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={salesChartType === 'bar' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSalesChartType('bar')}
                          className="h-8 text-xs"
                        >
                          Bar
                        </Button>
                        <Button
                          variant={salesChartType === 'line' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSalesChartType('line')}
                          className="h-8 text-xs"
                        >
                          Line
                        </Button>
                        <select
                          value={groupBy}
                          onChange={(e) => setGroupBy(e.target.value as any)}
                          className="border rounded-md text-xs h-8 px-2 bg-card text-foreground"
                        >
                          <option value="day">Daily</option>
                          <option value="week">Weekly</option>
                          <option value="month">Monthly</option>
                        </select>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={320}>
                        {salesChartType === 'bar' ? (
                          <BarChart data={salesData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(str) => {
                                try {
                                  return format(parseISO(str), groupBy === 'day' ? 'dd MMM' : 'MMM yyyy');
                                } catch {
                                  return str;
                                }
                              }}
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                            <Tooltip content={<ChartTooltip valuePrefix="$" />} />
                            <Legend />
                            <Bar name="Revenue" dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            {isOwner && (
                              <Bar name="Profit" dataKey="profit" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                            )}
                          </BarChart>
                        ) : (
                          <LineChart data={salesData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(str) => {
                                try {
                                  return format(parseISO(str), groupBy === 'day' ? 'dd MMM' : 'MMM yyyy');
                                } catch {
                                  return str;
                                }
                              }}
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                            <Tooltip content={<ChartTooltip valuePrefix="$" />} />
                            <Legend />
                            <Line
                              name="Revenue"
                              type="monotone"
                              dataKey="revenue"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2.5}
                              dot={{ r: 3 }}
                            />
                            {isOwner && (
                              <Line
                                name="Profit"
                                type="monotone"
                                dataKey="profit"
                                stroke="hsl(var(--destructive))"
                                strokeWidth={2.5}
                                dot={{ r: 3 }}
                              />
                            )}
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Payment Breakdown Pie */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Payment Methods</CardTitle>
                      <CardDescription>Sales distribution by checkout method</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center">
                      {paymentBreakdownData.length === 0 ? (
                        <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
                          No transactions found
                        </div>
                      ) : (
                        <>
                          <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                              <Pie
                                data={paymentBreakdownData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={85}
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {paymentBreakdownData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: unknown) => formatCurrency(Number(v || 0))} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 text-xs w-full">
                            {paymentBreakdownData.map((item, idx) => {
                              const total = paymentBreakdownData.reduce((acc, curr) => acc + curr.value, 0);
                              const pct = ((item.value / (total || 1)) * 100).toFixed(1);
                              return (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                  <span className="font-medium text-foreground truncate">{item.name}</span>
                                  <span className="text-muted-foreground ml-auto">{pct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-center p-8 text-muted-foreground">Failed to load sales report</div>
            )}
          </TabsContent>

          {/* ─── STOCK TAB ──────────────────────────────────────────────────── */}
          <TabsContent value="stock" className="space-y-6 mt-0">
            {stockLoading ? (
              <Skeleton className="h-[400px] w-full rounded-2xl" />
            ) : stockData ? (
              <>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">{formatCurrency(stockData.totalValue)}</div>
                      <p className="text-xs text-muted-foreground mt-1">Buying price × stock count</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Total Unique Products</CardTitle>
                      <Layers className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatNumber(stockData.totalProducts)}</div>
                      <p className="text-xs text-muted-foreground mt-1">Active inventory listing count</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {formatNumber(stockData.lowStockCount)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Quantity is below reorder limits</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
                      <AlertTriangle className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                        {formatNumber(stockData.outOfStockCount)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Critical items needing attention</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Stock Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Inventory Valuation Ledger</CardTitle>
                    <CardDescription>Current quantity levels, pricing, and gross value per SKU.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-center">Stock Level</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-right">Unit cost</TableHead>
                          <TableHead className="text-right">Retail price</TableHead>
                          <TableHead className="text-right">Valuation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockData.items.map((item) => (
                          <TableRow key={item.productId} className="hover:bg-muted/10 transition-colors">
                            <TableCell className="font-medium text-foreground py-2.5">
                              {item.name}
                              {item.sku && <span className="block text-[10px] text-muted-foreground font-mono mt-0.5">{item.sku}</span>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground py-2.5">{item.categoryName || 'Uncategorized'}</TableCell>
                            <TableCell className="text-center font-medium py-2.5">
                              {item.quantity} <span className="text-[10px] text-muted-foreground">{item.unit}</span>
                            </TableCell>
                            <TableCell className="text-center py-2.5">
                              <Badge
                                variant="outline"
                                className={
                                  item.status === 'in_stock'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
                                    : item.status === 'low_stock'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400'
                                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400'
                                }
                              >
                                {item.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right py-2.5">{formatCurrency(item.buyingPrice)}</TableCell>
                            <TableCell className="text-right py-2.5">{formatCurrency(item.sellingPrice)}</TableCell>
                            <TableCell className="text-right font-semibold py-2.5">{formatCurrency(item.stockValue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center p-8 text-muted-foreground">Failed to load stock valuation report</div>
            )}
          </TabsContent>

          {/* ─── PROFIT TAB (OWNER ONLY) ────────────────────────────────────── */}
          <TabsContent value="profit" className="space-y-6 mt-0">
            <RoleGate anyRole={['owner', 'super_admin']} fallback={<AccessRestricted />}>
              {profitLoading ? (
                <Skeleton className="h-[400px] w-full rounded-2xl" />
              ) : profitData ? (
                <>
                  {/* Profit metric summaries */}
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(profitData.grossRevenue)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total revenue over period</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Cost of Goods Sold (COGS)</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                          {formatCurrency(profitData.costOfGoodsSold)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Total purchasing cost value</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Gross Profit Margin</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(profitData.grossProfit)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Gross earnings profit amount</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Profit Margin Percentage</CardTitle>
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-primary">{profitData.grossMargin.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground mt-1">Return rate per currency unit</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                    {/* Daily Profit Trend Chart */}
                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle>Daily Profit Margin Trend</CardTitle>
                        <CardDescription>Timeline of daily profit versus revenue</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={profitData.dailyProfit}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(str) => {
                                try {
                                  return format(parseISO(str), 'dd MMM');
                                } catch {
                                  return str;
                                }
                              }}
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                            <Tooltip content={<ChartTooltip valuePrefix="$" />} />
                            <Legend />
                            <Area
                              name="Revenue"
                              type="monotone"
                              dataKey="revenue"
                              stroke="hsl(var(--primary))"
                              fill="hsl(var(--primary))"
                              fillOpacity={0.05}
                            />
                            <Area
                              name="Profit"
                              type="monotone"
                              dataKey="profit"
                              stroke="hsl(var(--destructive))"
                              fill="hsl(var(--destructive))"
                              fillOpacity={0.1}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Top Profit Margins Table */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Top Profit Products</CardTitle>
                        <CardDescription>Highest absolute profit yielders</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0 overflow-y-auto max-h-[320px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-right">Profit</TableHead>
                              <TableHead className="text-right">Margin</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {profitData.topProfitProducts.map((p) => (
                              <TableRow key={p.productId} className="hover:bg-muted/10">
                                <TableCell className="font-medium text-xs py-2 truncate max-w-[120px]">{p.name}</TableCell>
                                <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400 text-xs py-2">
                                  {formatCurrency(p.profit)}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground py-2">
                                  {p.margin.toFixed(0)}%
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <div className="text-center p-8 text-muted-foreground">Failed to load profit report</div>
              )}
            </RoleGate>
          </TabsContent>

          {/* ─── ATTENDANTS TAB ─────────────────────────────────────────────── */}
          <TabsContent value="attendants" className="space-y-6 mt-0">
            {attendantLoading ? (
              <Skeleton className="h-[300px] w-full rounded-2xl" />
            ) : attendantData ? (
              <Card>
                <CardHeader>
                  <CardTitle>Attendant Performance Ledger</CardTitle>
                  <CardDescription>Check transaction volumes, total revenue, voids, and cashier void rates.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  {attendantData.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      No cashier data found for this date range.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead>Cashier Name</TableHead>
                          <TableHead className="text-center">Sales count</TableHead>
                          <TableHead className="text-right">Total Revenue</TableHead>
                          <TableHead className="text-center">Voids Count</TableHead>
                          <TableHead className="text-center">Void Rate</TableHead>
                          <TableHead className="text-right">Avg Ticket Size</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendantData.map((att) => (
                          <TableRow key={att.userId} className="hover:bg-muted/10 transition-colors">
                            <TableCell className="font-medium text-foreground py-3 flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                {att.name.charAt(0).toUpperCase()}
                              </div>
                              {att.name}
                            </TableCell>
                            <TableCell className="text-center font-semibold py-3">{formatNumber(att.salesCount)}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 py-3">
                              {formatCurrency(att.totalRevenue)}
                            </TableCell>
                            <TableCell className="text-center py-3">
                              <span className={att.voidCount > 0 ? 'text-rose-600 font-semibold' : 'text-muted-foreground'}>
                                {att.voidCount}
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-3">
                              <Badge
                                variant="outline"
                                className={
                                  att.voidRate > 5
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
                                }
                              >
                                {att.voidRate.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right py-3">{formatCurrency(att.averageOrderValue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="text-center p-8 text-muted-foreground">Failed to load attendant performance report</div>
            )}
          </TabsContent>

          {/* ─── EXPENSES TAB ───────────────────────────────────────────────── */}
          <TabsContent value="expenses" className="space-y-6 mt-0">
            {expenseLoading ? (
              <div className="space-y-6">
                <Skeleton className="h-[100px] w-full rounded-2xl" />
                <div className="grid gap-6 md:grid-cols-2">
                  <Skeleton className="h-[280px] w-full rounded-2xl" />
                  <Skeleton className="h-[280px] w-full rounded-2xl" />
                </div>
              </div>
            ) : expenseData ? (
              <>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                        {formatCurrency(expenseData.totalExpenses)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Aggregated operational cost outflow</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                  {/* Category Breakdown Table */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Expense Outflows by Category</CardTitle>
                      <CardDescription>Total expenses grouping breakdown</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                      {expenseData.byCategory.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                          No expense logs registered for this date range.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Category</TableHead>
                              <TableHead className="text-center">Count</TableHead>
                              <TableHead className="text-right">Total Outflow</TableHead>
                              <TableHead className="text-right">Percentage</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {expenseData.byCategory.map((cat, index) => (
                              <TableRow key={index} className="hover:bg-muted/10">
                                <TableCell className="font-semibold py-2.5">
                                  {cat.category.charAt(0).toUpperCase() + cat.category.slice(1)}
                                </TableCell>
                                <TableCell className="text-center py-2.5">{cat.count}</TableCell>
                                <TableCell className="text-right font-bold text-rose-600 dark:text-rose-400 py-2.5">
                                  {formatCurrency(cat.total)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground py-2.5">
                                  {cat.percentage.toFixed(1)}%
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  {/* Expenses Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Category Distribution</CardTitle>
                      <CardDescription>Share percentages of business expenses</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center">
                      {expenseBreakdownData.length === 0 ? (
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                          No expenses registered
                        </div>
                      ) : (
                        <>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={expenseBreakdownData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={75}
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {expenseBreakdownData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: unknown) => formatCurrency(Number(v || 0))} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 text-xs w-full">
                            {expenseBreakdownData.map((item, idx) => {
                              const pct = ((item.value / (expenseData.totalExpenses || 1)) * 100).toFixed(1);
                              return (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                  <span className="font-medium text-foreground truncate">{item.name}</span>
                                  <span className="text-muted-foreground ml-auto">{pct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-center p-8 text-muted-foreground">Failed to load expense report</div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
