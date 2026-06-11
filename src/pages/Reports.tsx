import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, TrendingUp, Wallet, List, Calendar } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useReportsData } from '@/hooks/useReportsData';
import { Currency } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];
const CURRENCIES: Currency[] = ['TWD', 'USD', 'HKD', 'JPY', 'EUR', 'AUD'];

export const Reports: React.FC = () => {
  const { t } = useTranslation();
  const { profile, request, refreshProfile } = useAuth();
  const { expenses, groups, loading } = useReportsData(profile?.uid);

  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(profile?.preferredCurrency || 'TWD');
  const [displayRates, setDisplayRates] = useState<Record<string, number>>({});

  useEffect(() => {
    if (profile?.preferredCurrency) {
      setDisplayCurrency(profile.preferredCurrency);
    }
  }, [profile?.preferredCurrency]);

  useEffect(() => {
    const sourceCurrencies = Array.from(new Set(
      expenses
        .map((expense) => expense.currency)
        .filter((currency): currency is Currency => Boolean(currency) && currency !== displayCurrency)
    ));

    if (sourceCurrencies.length === 0) {
      setDisplayRates({});
      return;
    }

    let cancelled = false;
    Promise.all(
      sourceCurrencies.map(async (currency) => {
        const response = await fetch(`https://open.er-api.com/v6/latest/${currency}`);
        const data = await response.json();
        const rate = data?.rates?.[displayCurrency];
        return [currency, typeof rate === 'number' && Number.isFinite(rate) ? rate : 0] as const;
      })
    )
      .then((pairs) => {
        if (!cancelled) setDisplayRates(Object.fromEntries(pairs));
      })
      .catch((error) => {
        console.error('Failed to fetch reports exchange rates:', error);
        if (!cancelled) setDisplayRates({});
      });

    return () => {
      cancelled = true;
    };
  }, [expenses, displayCurrency]);

  const handleDisplayCurrencyChange = async (currency: Currency) => {
    setDisplayCurrency(currency);
    try {
      await request('profile.update', { preferredCurrency: currency });
      await refreshProfile();
    } catch (error) {
      console.error('Failed to update preferred currency:', error);
    }
  };

  const convertAmount = (amount: number, currency: string) => {
    const rate = currency === displayCurrency ? 1 : displayRates[currency] || 0;
    return rate > 0 ? amount * rate : 0;
  };

  const filteredExpenses = useMemo(() => {
    let result = expenses;
    if (selectedGroupId !== 'all') {
      result = result.filter(e => e.groupId === selectedGroupId);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      result = result.filter(e => {
        if (!e.date) return false;
        const eDate = new Date(e.date);
        if (Number.isNaN(eDate.getTime())) return false;
        if (dateFilter === 'this_month') {
          return eDate.getMonth() === now.getMonth() && eDate.getFullYear() === now.getFullYear();
        }
        if (dateFilter === 'last_month') {
          const lastMonth = now.getMonth() - 1;
          const year = lastMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
          const month = lastMonth < 0 ? 11 : lastMonth;
          return eDate.getMonth() === month && eDate.getFullYear() === year;
        }
        if (dateFilter === 'this_year') {
          return eDate.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }

    // Sort chronologically (descending)
    return [...result].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }, [expenses, selectedGroupId, dateFilter]);

  const { totalMyShare, totalPaidByMe, monthlyData, groupData } = useMemo(() => {
    if (!profile || filteredExpenses.length === 0) {
      return { totalMyShare: 0, totalPaidByMe: 0, monthlyData: [], groupData: [] };
    }

    let myShare = 0;
    let paidByMe = 0;

    const monthlyMap = new Map<string, number>();
    const groupMap = new Map<string, number>();

    const monthKeys = new Set<string>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleString(undefined, { month: 'short' });
      monthKeys.add(key);
      monthlyMap.set(label, 0);
    }

    filteredExpenses.forEach(exp => {
      const isSettlement = isSettlementExpense(exp);

      if (isSettlement) return;

      if (exp.payerId === profile.uid) {
        paidByMe += convertAmount(exp.amount, exp.currency);
      }

      if (exp.splits && exp.splits[profile.uid] !== undefined) {
        const myExpShare = convertAmount(exp.splits[profile.uid], exp.currency);
        myShare += myExpShare;

        const currentGroupShare = groupMap.get(exp.groupId) || 0;
        groupMap.set(exp.groupId, currentGroupShare + myExpShare);

        if (exp.date) {
          const expDate = new Date(exp.date);
          if (Number.isNaN(expDate.getTime())) return;
          const key = `${expDate.getFullYear()}-${expDate.getMonth()}`;
          if (monthKeys.has(key)) {
            const expMonth = expDate.toLocaleString(undefined, { month: 'short' });
            monthlyMap.set(expMonth, monthlyMap.get(expMonth)! + myExpShare);
          }
        }
      }
    });

    const mData = Array.from(monthlyMap.entries()).map(([month, amount]) => ({
      month,
      amount
    }));

    const gData = Array.from(groupMap.entries())
      .filter(([_, amount]) => amount > 0)
      .map(([groupId, amount]) => {
        const group = groups.find(g => g.id === groupId);
        return {
          name: group?.name || t('unknown_group'),
          amount
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return { totalMyShare: myShare, totalPaidByMe: paidByMe, monthlyData: mData, groupData: gData };
  }, [filteredExpenses, profile, groups, displayCurrency, displayRates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 py-32">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-black dark:border-white/20 dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 w-full max-w-7xl mx-auto px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-purple-500"></span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('analytics')}</span>
          </div>
          <h2 className="text-xl font-black tracking-tight leading-none">{t('reports')}</h2>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-xs font-black uppercase tracking-widest shadow-none outline-none hover:bg-slate-100 dark:border-white/10 dark:bg-[#121212] dark:hover:bg-white/5">
            {displayCurrency}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[120px] border-slate-200 dark:border-white/10 dark:bg-[#121212]">
            {CURRENCIES.map((currency) => (
              <DropdownMenuItem
                key={currency}
                onClick={() => handleDisplayCurrencyChange(currency)}
                className="font-bold text-xs uppercase tracking-widest cursor-pointer"
              >
                {currency}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expenses.length === 0 ? (
        <div className="py-20 text-center space-y-4 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#181818]">
          <div className="w-16 h-16 bg-slate-100 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <BarChart3 size={32} />
          </div>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('no_report_expenses')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="rounded-lg border-slate-200 dark:border-white/10 bg-background dark:bg-[#121212] shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest flex items-center text-slate-500 dark:text-slate-400">
                  <TrendingUp size={14} className="mr-2" />
                  {t('total_spending_share')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black tracking-tight mb-1">{displayCurrency} {totalMyShare.toFixed(2)}</div>
                <p className="text-xs font-medium text-slate-500">{t('excludes_settlements')}</p>
              </CardContent>
            </Card>

            <Card className="rounded-lg border-slate-200 dark:border-white/10 bg-background dark:bg-[#121212] shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest flex items-center text-slate-500 dark:text-slate-400">
                  <Wallet size={14} className="mr-2" />
                  {t('total_paid_by_you')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black tracking-tight mb-1 text-[#1ed760]">{displayCurrency} {totalPaidByMe.toFixed(2)}</div>
                <p className="text-xs font-medium text-slate-500">{t('includes_paid_for_others')}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Monthly Chart */}
            <Card className="rounded-lg border-slate-200 dark:border-white/10 bg-background dark:bg-[#121212] shadow-none">
              <CardHeader>
                <CardTitle className="text-lg font-black uppercase tracking-tight">{t('monthly_spending')}</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.2} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700 }} tickFormatter={(value) => `${displayCurrency} ${value}`} />
                    <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '1rem', border: 'none', backgroundColor: '#111', color: '#fff', fontWeight: 700 }} />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Group Distribution */}
            <Card className="rounded-lg border-slate-200 dark:border-white/10 bg-background dark:bg-[#121212] shadow-none">
              <CardHeader>
                <CardTitle className="text-lg font-black uppercase tracking-tight">{t('by_group')}</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupData}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                    >
                      {groupData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '1rem', border: 'none', backgroundColor: '#111', color: '#fff', fontWeight: 700 }} formatter={(value: number) => `${displayCurrency} ${value.toFixed(2)}`} />
                    <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 700 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Expenses List */}
          <Card className="rounded-lg border-slate-200 dark:border-white/10 bg-background dark:bg-[#121212] shadow-none">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
              <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center">
                <List size={18} className="mr-2" />
                {t('all_expenses')}
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger className="w-full sm:w-[180px] rounded-full border-slate-200 dark:border-white/10 h-10 font-bold text-xs uppercase tracking-widest bg-slate-50 dark:bg-[#1f1f1f]">
                    <span className="flex flex-1 text-left truncate">
                      {selectedGroupId === 'all' ? t('all_groups') : groups.find(g => g.id === selectedGroupId)?.name || t('unknown_group')}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="rounded-md border-slate-200 dark:border-white/10 dark:bg-[#0f0f0f]">
                    <SelectItem value="all" className="font-bold text-xs uppercase tracking-widest">{t('all_groups')}</SelectItem>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id!} className="font-bold text-xs uppercase tracking-widest">{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-full sm:w-[150px] rounded-full border-slate-200 dark:border-white/10 h-10 font-bold text-xs uppercase tracking-widest bg-slate-50 dark:bg-[#1f1f1f]">
                    <Calendar size={14} className="mr-2 inline-block opacity-50" />
                    <span className="flex flex-1 text-left truncate">{t(dateFilter)}</span>
                  </SelectTrigger>
                  <SelectContent className="rounded-md border-slate-200 dark:border-white/10 dark:bg-[#0f0f0f]">
                    <SelectItem value="all" className="font-bold text-xs uppercase tracking-widest">{t('all')}</SelectItem>
                    <SelectItem value="this_month" className="font-bold text-xs uppercase tracking-widest">{t('this_month')}</SelectItem>
                    <SelectItem value="last_month" className="font-bold text-xs uppercase tracking-widest">{t('last_month')}</SelectItem>
                    <SelectItem value="this_year" className="font-bold text-xs uppercase tracking-widest">{t('this_year')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredExpenses.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
                  {t('no_matching_expenses')}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredExpenses.map(expense => {
                    const group = groups.find(g => g.id === expense.groupId);
                    const isSettlement = isSettlementExpense(expense);

                    return (
                      <div key={expense.id} className="p-4 sm:px-6 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors flex items-center justify-between">
                        <div className="flex items-start gap-3 overflow-hidden">
                          <div className="mt-1 w-10 h-10 shrink-0 rounded-full bg-slate-100 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 flex items-center justify-center text-lg font-black uppercase">
                            {group?.name ? Array.from(group.name)[0] : '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-base truncate">{expense.description}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                              <span className="truncate">{group?.name || t('unknown_group')}</span>
                              <span>•</span>
                              <span>{expense.date ? new Date(expense.date).toLocaleDateString() : t('no_date')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <div className={`font-black tracking-tight text-lg ${isSettlement ? 'text-[#1ed760]' : ''}`}>
                            {displayCurrency} {convertAmount(expense.amount, expense.currency).toFixed(2)}
                          </div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">
                            {expense.payerId === profile?.uid ? t('you_paid') : t('someone_paid')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

function isSettlementExpense(expense: { isSettlement?: boolean; description?: string }) {
  const description = expense.description?.toLowerCase() || '';
  return Boolean(expense.isSettlement) || description.includes('settlement') || description.includes('settled');
}
