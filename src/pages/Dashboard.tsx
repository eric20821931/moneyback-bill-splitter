import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Plus,
  ChevronRight,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Users2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Group } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'motion/react';

import { useBalances } from '@/hooks/useBalances';
import { Currency } from '@/types';

const CURRENCIES: Currency[] = ['TWD', 'USD', 'HKD', 'JPY', 'EUR', 'AUD'];
type CurrencyTotals = { totalBalance: number; totalOwedToYou: number; totalYouOwe: number };

export const Dashboard: React.FC = () => {
  const { profile, request, refreshProfile } = useAuth();
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(profile?.preferredCurrency || 'TWD');
  const [newGroupCurrency, setNewGroupCurrency] = useState<Currency>(profile?.preferredCurrency || 'TWD');
  const [displayRates, setDisplayRates] = useState<Record<string, number>>({});
  const [groupBalanceRates, setGroupBalanceRates] = useState<Record<string, number>>({});

  const { totalsByCurrency, groupTotalsByCurrency } = useBalances(profile?.uid);

  useEffect(() => {
    if (profile?.preferredCurrency) {
      setDisplayCurrency(profile.preferredCurrency);
      setNewGroupCurrency(profile.preferredCurrency);
    }
  }, [profile?.preferredCurrency]);

  useEffect(() => {
    const sourceCurrencies = Object.keys(totalsByCurrency).filter((currency) => currency !== displayCurrency);
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
        console.error('Failed to fetch dashboard exchange rates:', error);
        if (!cancelled) setDisplayRates({});
      });

    return () => {
      cancelled = true;
    };
  }, [totalsByCurrency, displayCurrency]);

  useEffect(() => {
    if (!profile) return;

    let cancelled = false;
    setLoading(true);
    request<{ groups: Group[] }>('groups.list')
      .then((data) => {
        if (!cancelled) setGroups(data.groups || []);
      })
      .catch((error) => {
        console.error("Error fetching groups:", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile, request]);

  useEffect(() => {
    const ratePairs = groups.flatMap((group) =>
      Object.entries(groupTotalsByCurrency)
        .filter(([, groupBalances]) => Number.isFinite(Number(groupBalances[group.id])) && Math.abs(Number(groupBalances[group.id])) >= 0.01)
        .map(([sourceCurrency]) => ({ sourceCurrency, targetCurrency: group.currency }))
        .filter(({ sourceCurrency, targetCurrency }) => sourceCurrency !== targetCurrency)
    );

    const uniquePairs = Array.from(
      new Map(ratePairs.map((pair) => [`${pair.sourceCurrency}:${pair.targetCurrency}`, pair])).values()
    );

    if (uniquePairs.length === 0) {
      setGroupBalanceRates({});
      return;
    }

    let cancelled = false;
    Promise.all(
      uniquePairs.map(async ({ sourceCurrency, targetCurrency }) => {
        const response = await fetch(`https://open.er-api.com/v6/latest/${sourceCurrency}`);
        const data = await response.json();
        const rate = data?.rates?.[targetCurrency];
        return [
          `${sourceCurrency}:${targetCurrency}`,
          typeof rate === 'number' && Number.isFinite(rate) ? rate : 0,
        ] as const;
      })
    )
      .then((pairs) => {
        if (!cancelled) setGroupBalanceRates(Object.fromEntries(pairs));
      })
      .catch((error) => {
        console.error('Failed to fetch group balance exchange rates:', error);
        if (!cancelled) setGroupBalanceRates({});
      });

    return () => {
      cancelled = true;
    };
  }, [groups, groupTotalsByCurrency]);

  const handleCreateGroup = async () => {
    if (!profile || !newGroupName.trim()) return;

    try {
      const data = await request<{ group: Group }>('groups.create', {
        name: newGroupName.trim(),
        currency: newGroupCurrency,
      });
      setGroups((currentGroups) => [data.group, ...currentGroups]);
      setNewGroupName('');
      setIsAddingGroup(false);
    } catch (error) {
      console.error("Error creating group:", error);
    }
  };

  const handleDisplayCurrencyChange = async (currency: Currency) => {
    setDisplayCurrency(currency);
    setNewGroupCurrency(currency);
    try {
      await request('profile.update', { preferredCurrency: currency });
      await refreshProfile();
    } catch (error) {
      console.error('Failed to update preferred currency:', error);
    }
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const convertTotals = () => {
    return (Object.entries(totalsByCurrency) as [string, CurrencyTotals][]).reduce(
      (totals, [currency, values]) => {
        const rate = currency === displayCurrency ? 1 : displayRates[currency] || 0;
        if (rate <= 0) return totals;
        totals.totalBalance += values.totalBalance * rate;
        totals.totalOwedToYou += values.totalOwedToYou * rate;
        totals.totalYouOwe += values.totalYouOwe * rate;
        return totals;
      },
      { totalBalance: 0, totalOwedToYou: 0, totalYouOwe: 0 }
    );
  };

  const convertedTotals = convertTotals();

  const getGroupBalance = (group: Group) => {
    const balance = Object.entries(groupTotalsByCurrency).reduce((total, [sourceCurrency, groupBalances]) => {
      const value = Number(groupBalances[group.id] || 0);
      if (!Number.isFinite(value) || Math.abs(value) < 0.01) return total;
      const rate = sourceCurrency === group.currency ? 1 : groupBalanceRates[`${sourceCurrency}:${group.currency}`] || 0;
      if (rate <= 0) return total;
      return total + value * rate;
    }, 0);
    return Math.abs(balance) < 0.01 ? 0 : balance;
  };

  const getGroupBalanceLabel = (group: Group) => {
    const balance = getGroupBalance(group);
    const amount = Math.abs(balance).toFixed(2);
    if (balance === 0) return `${group.currency} 0.00`;
    return `${group.currency} ${amount}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-4 border-[#1ed760] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-[#1ed760]"></span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('overview')}</span>
          </div>
          <h2 className="text-xl font-black tracking-tight leading-none">{t('groups')}</h2>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-4">
            {t('welcome_back', { name: profile?.displayName || t('member') })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-xs font-black uppercase tracking-widest shadow-none outline-none hover:bg-slate-100 dark:border-white/10 dark:bg-[#121212] dark:hover:bg-[#252525]">
              {newGroupCurrency}
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
          <Dialog open={isAddingGroup} onOpenChange={setIsAddingGroup}>
            <DialogTrigger className="inline-flex shrink-0 items-center justify-center rounded-full h-12 px-8 bg-black dark:bg-[#1ed760] text-white dark:text-black hover:bg-[#1ed760] dark:hover:bg-[#1ed760] hover:text-black font-black text-sm uppercase tracking-tight transition-colors border border-transparent shadow-none">
              <Plus size={18} className="mr-2" />
              {t('add_group')}
            </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-lg border border-slate-200 dark:border-white/10 dark:bg-[#121212] shadow-none">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">{t('add_group')}</DialogTitle>
            </DialogHeader>
            <div className="py-8 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('group_name')}</label>
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder={t('group_name_placeholder')}
                  className="rounded-full h-14 px-6 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 text-lg font-bold"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsAddingGroup(false)} className="rounded-full px-6 font-bold uppercase tracking-widest text-xs">{t('cancel')}</Button>
              <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()} className="rounded-full bg-black dark:bg-[#1ed760] text-white dark:text-black hover:bg-[#1ed760] hover:text-black font-bold uppercase tracking-widest text-xs px-8 shadow-none">
                {t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#181818] shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Wallet size={16} />
              {t('total_balance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-left text-2xl font-black tracking-tight mb-1 ${convertedTotals.totalBalance < 0 ? 'text-red-500' : convertedTotals.totalBalance > 0 ? 'text-[#1ed760]' : ''}`}>
              {displayCurrency} {Math.abs(convertedTotals.totalBalance).toFixed(2)}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {t('across_groups', { count: groups.length })}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#181818] shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <ArrowUpRight size={16} className="text-[#1ed760]" />
              {t('you_are_owed')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-black tracking-tight text-[#1ed760]">{displayCurrency} {convertedTotals.totalOwedToYou.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#181818] shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <ArrowDownLeft size={16} className="text-red-500" />
              {t('you_owe')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-black tracking-tight text-red-500">{displayCurrency} {convertedTotals.totalYouOwe.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and List */}
      <div className="space-y-6">
        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" size={18} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_groups')}
            className="pl-14 rounded-full h-14 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 font-bold text-sm shadow-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredGroups.length === 0 ? (
              <div className="col-span-full py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-100 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <Users2 size={32} />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('no_groups')}</p>
                <Button variant="outline" onClick={() => setIsAddingGroup(true)} className="rounded-full font-bold">
                  {t('add_group')}
                </Button>
              </div>
            ) : (
              filteredGroups.map((group) => (
                <motion.div
                  key={group.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Link to={`/group/${group.id}`}>
                    <Card className="rounded-lg border border-slate-200 dark:border-white/10 hover:dark:border-white/20 transition-all duration-300 group cursor-pointer h-full relative overflow-hidden bg-white dark:bg-[#181818] shadow-none">
                      <CardHeader className="relative">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            {t('member_count', { count: group.memberIds.length })}
                          </span>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-[10px] font-black tracking-widest px-3 py-1 bg-[#1ed760] text-black rounded-full uppercase">
                              {group.currency}
                            </span>
                            <span className={`text-sm font-black uppercase tracking-tight ${
                              getGroupBalance(group) > 0
                                ? 'text-[#1ed760]'
                                : getGroupBalance(group) < 0
                                  ? 'text-red-500'
                                  : 'text-slate-400 dark:text-slate-500'
                            }`}>
                              {getGroupBalanceLabel(group)}
                            </span>
                          </div>
                        </div>
                        <CardTitle className="text-2xl font-bold">{group.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="relative flex justify-between items-end">
                        <div className="flex -space-x-2">
                          {group.memberIds.slice(0, 4).map((m, i) => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-[#0A0A0A] bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                              {group.memberPhotos?.[m] ? (
                                <img src={group.memberPhotos[m]} alt={group.memberNames?.[m] || t('member')} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                group.memberNames && group.memberNames[m] ? Array.from(group.memberNames[m] as string)[0] : '?'
                              )}
                            </div>
                          ))}
                          {group.memberIds.length > 4 && (
                            <div className="w-8 h-8 rounded-full border-2 border-white dark:border-[#0A0A0A] bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                              +{group.memberIds.length - 4}
                            </div>
                          )}
                        </div>
                        <div className="p-2 rounded-full border border-slate-200 dark:border-white/10 dark:text-white/50 group-hover:dark:opacity-100 group-hover:translate-x-1 transition-all">
                          <ChevronRight size={20} />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
