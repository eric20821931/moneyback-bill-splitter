import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Receipt,
  TrendingUp,
  Settings,
  ArrowLeft,
  UserPlus,
  Trash2,
  Pencil,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Group, Expense, Currency } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

const CURRENCIES: Currency[] = ['TWD', 'USD', 'HKD', 'JPY', 'EUR', 'AUD'];

export const GroupDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, request } = useAuth();
  const { t } = useTranslation();

  const getMemberName = (mId: string) => {
    const name = mId === profile?.uid
      ? profile?.displayName || group?.memberNames?.[mId] || profile?.email
      : group?.memberNames?.[mId];
    if (typeof name === 'string' && name.trim() && name !== mId) {
      return name;
    }
    return t('member');
  };

  const getMemberPhoto = (mId: string) => group?.memberPhotos?.[mId] || '';

  const getAvatarFallback = (mId: string) => {
    const name = getMemberName(mId);
    return Array.from(name)[0] || '?';
  };

  const renderYouBadge = (mId: string) => (
    mId === profile?.uid ? (
      <span className="inline-flex shrink-0 rounded-full bg-[#1ed760] px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-black">
        {t('you')}
      </span>
    ) : null
  );

  const renderMemberLabel = (mId: string, className = "min-w-0 truncate") => (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className={className}>{getMemberName(mId)}</span>
      {renderYouBadge(mId)}
    </span>
  );

  const renderMemberAvatar = (mId: string, className = "w-8 h-8", textClassName = "text-[10px]") => {
    const name = getMemberName(mId);
    const photo = getMemberPhoto(mId);

    return (
      <div className={`${className} rounded-full border-2 border-white dark:border-[#0A0A0A] bg-slate-200 dark:bg-slate-800 flex items-center justify-center ${textClassName} font-bold overflow-hidden`} title={name}>
        {photo ? (
          <img src={photo} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          getAvatarFallback(mId)
        )}
      </div>
    );
  };

  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceExchangeRates, setBalanceExchangeRates] = useState<Record<string, number>>({});
  const [isFetchingBalanceRates, setIsFetchingBalanceRates] = useState(false);

  // Add Expense Form
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState<Currency>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [payerId, setPayerId] = useState('');
  const [percentageSplits, setPercentageSplits] = useState<Record<string, string>>({});
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState<Currency>('USD');
  const [editExchangeRate, setEditExchangeRate] = useState(1);
  const [isFetchingEditRate, setIsFetchingEditRate] = useState(false);
  const [editPayerId, setEditPayerId] = useState('');
  const [editPercentageSplits, setEditPercentageSplits] = useState<Record<string, string>>({});
  const [editExpenseError, setEditExpenseError] = useState('');
  const [isUpdatingExpense, setIsUpdatingExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState('');
  const [selectedInviteFriendId, setSelectedInviteFriendId] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  // Settlement Form
  const [isSettling, setIsSettling] = useState(false);
  const [settlePayerId, setSettlePayerId] = useState('');
  const [settleSplitId, setSettleSplitId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settlementError, setSettlementError] = useState('');
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [deleteGroupError, setDeleteGroupError] = useState('');

  useEffect(() => {
    if (!id || !profile) return;

    let cancelled = false;
    const load = async () => {
      try {
        const [{ group: loadedGroup }, { expenses: loadedExpenses }] = await Promise.all([
          request<{ group: Group }>('groups.get', { groupId: id }),
          request<{ expenses: Expense[] }>('expenses.list', { groupId: id }),
        ]);

        if (cancelled) return;
        const memberIds = uniqueMemberIds(Array.isArray(loadedGroup.memberIds) ? loadedGroup.memberIds : []);
        setGroup({ ...loadedGroup, memberIds });
        setExpenses((loadedExpenses || []).map((expense) => ({
          ...expense,
          date: expense.date ? new Date(expense.date) : new Date(),
        })));
        setLoading(false);

        const initialPayerId = profile.uid;
        setPayerId((currentPayerId) => {
          if (currentPayerId && memberIds.includes(currentPayerId)) return currentPayerId;
          if (memberIds.includes(initialPayerId)) return initialPayerId;
          return memberIds[0] || '';
        });
      } catch (error) {
        console.error("Error fetching group:", error);
        navigate('/');
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [id, profile, request, navigate]);

  // Effect to set initial currency
  useEffect(() => {
    if (group && !isAddingExpense) {
      setExpenseCurrency(group.currency);
    }
  }, [group, isAddingExpense]);

  useEffect(() => {
    if (!group?.memberIds.length || !isAddingExpense) return;
    setPercentageSplits((currentSplits) => {
      const nextSplits = { ...currentSplits };
      let changed = false;

      group.memberIds.forEach((memberId) => {
        if (nextSplits[memberId] === undefined) {
          nextSplits[memberId] = '';
          changed = true;
        }
      });

      Object.keys(nextSplits).forEach((memberId) => {
        if (!group.memberIds.includes(memberId)) {
          delete nextSplits[memberId];
          changed = true;
        }
      });

      return changed ? nextSplits : currentSplits;
    });
  }, [group?.memberIds, isAddingExpense]);

  const handleGroupCurrencyChange = async (newCurrency: string) => {
    if (!group || !id) return;
    try {
      const data = await request<{ group: Group }>('groups.update', { groupId: id, currency: newCurrency });
      setGroup(data.group);
    } catch (e) {
      console.error("Failed to update group currency", e);
    }
  };

  // Effect to fetch exchange rate
  useEffect(() => {
    const fetchRate = async () => {
      if (!group || expenseCurrency === group.currency) {
        setExchangeRate(1);
        return;
      }
      setIsFetchingRate(true);
      try {
        setExchangeRate(1);
        const res = await fetch(`https://open.er-api.com/v6/latest/${expenseCurrency}`);
        const data = await res.json();
        if (data && data.rates && data.rates[group.currency]) {
          setExchangeRate(data.rates[group.currency]);
        } else {
          setExchangeRate(0);
        }
      } catch (e) {
        console.error("Failed to fetch exchange rate", e);
        setExchangeRate(0);
      } finally {
        setIsFetchingRate(false);
      }
    };
    fetchRate();
  }, [expenseCurrency, group]);

  useEffect(() => {
    const fetchRate = async () => {
      if (!group || !editingExpense || editCurrency === group.currency) {
        setEditExchangeRate(1);
        return;
      }
      setIsFetchingEditRate(true);
      try {
        setEditExchangeRate(1);
        const res = await fetch(`https://open.er-api.com/v6/latest/${editCurrency}`);
        const data = await res.json();
        const rate = data?.rates?.[group.currency];
        setEditExchangeRate(typeof rate === 'number' && Number.isFinite(rate) ? rate : 0);
      } catch (e) {
        console.error("Failed to fetch edit exchange rate", e);
        setEditExchangeRate(0);
      } finally {
        setIsFetchingEditRate(false);
      }
    };
    fetchRate();
  }, [editCurrency, editingExpense, group]);

  useEffect(() => {
    if (!group) return;

    const currenciesToConvert = Array.from(new Set(
      expenses
        .map(exp => exp.currency)
        .filter((currency): currency is Currency => Boolean(currency) && currency !== group.currency)
    ));

    if (currenciesToConvert.length === 0) {
      setBalanceExchangeRates({});
      setIsFetchingBalanceRates(false);
      return;
    }

    let cancelled = false;
    const fetchBalanceRates = async () => {
      setIsFetchingBalanceRates(true);
      try {
        const ratePairs = await Promise.all(
          currenciesToConvert.map(async (currency) => {
            const res = await fetch(`https://open.er-api.com/v6/latest/${currency}`);
            const data = await res.json();
            const rate = data?.rates?.[group.currency];
            return [currency, typeof rate === 'number' && Number.isFinite(rate) ? rate : 0] as const;
          })
        );

        if (!cancelled) {
          setBalanceExchangeRates(Object.fromEntries(ratePairs));
        }
      } catch (e) {
        console.error("Failed to fetch balance exchange rates", e);
        if (!cancelled) {
          setBalanceExchangeRates({});
        }
      } finally {
        if (!cancelled) {
          setIsFetchingBalanceRates(false);
        }
      }
    };

    fetchBalanceRates();

    return () => {
      cancelled = true;
    };
  }, [expenses, group?.currency]);

  const getExpenseConversionRate = (expense: Expense) => {
    if (!group) return 1;
    const expenseCurrency = expense.currency || group.currency;
    if (expenseCurrency === group.currency) return 1;
    const rate = balanceExchangeRates[expenseCurrency];
    return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : 1;
  };

  const getConvertedExpenseAmount = (expense: Expense) => {
    if (expense.originalCurrency && expense.originalCurrency === group?.currency && Number.isFinite(expense.originalAmount)) {
      return roundMoney(expense.originalAmount);
    }
    return roundMoney(expense.amount * getExpenseConversionRate(expense));
  };

  const getOriginalExpenseDisplay = (expense: Expense) => {
    const originalAmount = expense.originalAmount ?? expense.amount;
    const originalCurrency = expense.originalCurrency ?? expense.currency;

    if (!originalCurrency || !Number.isFinite(originalAmount) || originalCurrency === group?.currency) {
      return null;
    }

    return {
      amount: originalAmount,
      currency: originalCurrency,
      differsFromGroup: originalCurrency !== group?.currency || roundMoney(originalAmount) !== getConvertedExpenseAmount(expense),
    };
  };

  const getSplitBreakdown = (expense: Expense) => {
    const convertedAmount = getConvertedExpenseAmount(expense);
    const conversionRate = getExpenseConversionRate(expense);

    return Object.entries(expense.splits || {}).map(([uid, share]) => {
      const convertedShare = roundMoney(Number(share) * conversionRate);
      const savedPercentage = expense.splitPercentages?.[uid];
      const percentage = typeof savedPercentage === 'number' && Number.isFinite(savedPercentage)
        ? savedPercentage
        : convertedAmount > 0 ? roundMoney((convertedShare / convertedAmount) * 100) : 0;
      return {
        uid,
        name: getMemberName(uid),
        amount: convertedShare,
        percentage,
      };
    });
  };

  const getResolvedPayerId = () => {
    if (!group?.memberIds.length) return '';
    if (payerId && group.memberIds.includes(payerId)) return payerId;
    if (profile?.uid && group.memberIds.includes(profile.uid)) return profile.uid;
    return group.memberIds[0];
  };

  const getResolvedEditPayerId = () => {
    if (!group?.memberIds.length) return '';
    if (editPayerId && group.memberIds.includes(editPayerId)) return editPayerId;
    if (editingExpense?.payerId && group.memberIds.includes(editingExpense.payerId)) return editingExpense.payerId;
    if (profile?.uid && group.memberIds.includes(profile.uid)) return profile.uid;
    return group.memberIds[0];
  };

  const openEditExpense = (expense: Expense) => {
    if (!group || expense.isSettlement) return;
    const sourceCurrency = (expense.originalCurrency || expense.currency || group.currency) as Currency;
    const sourceAmount = expense.originalAmount ?? expense.amount;
    const percentages = group.memberIds.reduce<Record<string, string>>((splits, memberId) => {
      const savedPercentage = expense.splitPercentages?.[memberId];
      if (typeof savedPercentage === 'number' && Number.isFinite(savedPercentage)) {
        splits[memberId] = savedPercentage.toString();
        return splits;
      }
      const share = Number(expense.splits?.[memberId] || 0);
      splits[memberId] = expense.amount > 0 ? roundMoney((share / expense.amount) * 100).toString() : '0';
      return splits;
    }, {});

    setEditingExpense(expense);
    setEditDesc(expense.description);
    setEditAmount(sourceAmount.toString());
    setEditCurrency(sourceCurrency);
    setEditPayerId(expense.payerId);
    setEditPercentageSplits(percentages);
    setEditExpenseError('');
  };

  const buildExpensePayload = (
    description: string,
    rawAmount: string,
    sourceCurrency: Currency,
    rate: number,
    rawPayerId: string,
    rawPercentages: Record<string, string>,
  ) => {
    if (!group || !id) return null;
    const parsedAmount = parseFloat(rawAmount);
    const resolvedPayer = rawPayerId && group.memberIds.includes(rawPayerId) ? rawPayerId : getResolvedPayerId();
    const effectiveExchangeRate = sourceCurrency === group.currency ? 1 : rate;
    const finalAmount = roundMoney(parsedAmount * effectiveExchangeRate);
    const splits: Record<string, number> = {};
    const splitPercentages: Record<string, number> = {};
    let assignedAmount = 0;

    group.memberIds.forEach((memberId, index) => {
      const percentage = roundMoney(parseFloat(rawPercentages[memberId] || '0'));
      const isLastMember = index === group.memberIds.length - 1;
      const share = isLastMember ? roundMoney(finalAmount - assignedAmount) : roundMoney(finalAmount * percentage / 100);
      splits[memberId] = share;
      splitPercentages[memberId] = percentage;
      assignedAmount += share;
    });

    const payload: any = {
      groupId: id,
      description: description.trim(),
      amount: finalAmount,
      currency: group.currency,
      payerId: resolvedPayer,
      splitType: 'percentage',
      splits,
      splitPercentages,
      isSettlement: false,
    };

    if (sourceCurrency !== group.currency) {
      payload.originalCurrency = sourceCurrency;
      payload.originalAmount = parsedAmount;
      payload.exchangeRate = effectiveExchangeRate;
    }

    return payload;
  };

  const handleCreateExpense = async (isSettlement = false, settlePayerId = '', settleAmount = 0, settleSplitId = '') => {
    if (!id || !group) return;
    if (isSavingExpense) return;

    const parsedAmount = parseFloat(amount);
    const resolvedPayerId = isSettlement ? settlePayerId : getResolvedPayerId();
    const effectiveExchangeRate = !isSettlement && expenseCurrency === group.currency ? 1 : exchangeRate;

    if (!group.memberIds.length) {
      const message = t('error_no_members');
      isSettlement ? setSettlementError(message) : setExpenseError(message);
      return;
    }

    if (!isSettlement) {
      if (!desc.trim()) {
        setExpenseError(t('error_enter_description'));
        return;
      }
      if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
        setExpenseError(t('error_valid_amount'));
        return;
      }
      if (!resolvedPayerId) {
        setExpenseError(t('error_choose_payer'));
        return;
      }
      if (expenseCurrency !== group.currency && (isFetchingRate || !Number.isFinite(effectiveExchangeRate) || effectiveExchangeRate <= 0)) {
        setExpenseError(t('error_exchange_rate_not_ready'));
        return;
      }
      const totalPercentage = getPercentageTotal(group.memberIds, percentageSplits);
      const hasInvalidPercentage = group.memberIds.some((memberId) => {
        const value = parseFloat(percentageSplits[memberId] || '');
        return !Number.isFinite(value) || value < 0;
      });

      if (hasInvalidPercentage || Math.abs(totalPercentage - 100) > 0.01) {
        setExpenseError(t('error_percentage_total'));
        return;
      }
    }

    if (isSettlement) {
      if (!settlePayerId || !settleSplitId || settlePayerId === settleSplitId) {
        setSettlementError(t('error_select_different_members'));
        return;
      }
      if (isNaN(settleAmount) || settleAmount <= 0) {
        setSettlementError(t('error_valid_amount'));
        return;
      }
    }

    const baseAmount = isSettlement ? settleAmount : parsedAmount;

    // For normal expenses, convert amount if currencies differ
    const finalAmount = roundMoney(isSettlement ? baseAmount : baseAmount * effectiveExchangeRate);
    const splits: Record<string, number> = {};

    if (isSettlement) {
      splits[settleSplitId] = finalAmount;
    } else {
      let assignedAmount = 0;
      group.memberIds.forEach((mId, index) => {
        const isLastMember = index === group.memberIds.length - 1;
        const percentage = parseFloat(percentageSplits[mId] || '0');
        const share = isLastMember ? roundMoney(finalAmount - assignedAmount) : roundMoney(finalAmount * percentage / 100);
        splits[mId] = share;
        assignedAmount += share;
      });
    }

    const splitPercentages: Record<string, number> = {};
    if (!isSettlement) {
      group.memberIds.forEach((mId) => {
        splitPercentages[mId] = roundMoney(parseFloat(percentageSplits[mId] || '0'));
      });
    }

    const validSplits: Record<string, number> = {};
    for (const [key, value] of Object.entries(splits)) {
      if (key && typeof key === 'string' && key.trim() !== '') {
        validSplits[key] = value;
      }
    }

    if (!Object.keys(validSplits).length) {
      const message = t('error_no_valid_split_members');
      isSettlement ? setSettlementError(message) : setExpenseError(message);
      return;
    }

    const payload: any = {
      groupId: id,
      description: isSettlement ? 'Settlement' : desc.trim(),
      amount: finalAmount,
      currency: group.currency,
      payerId: resolvedPayerId,
      splitType: isSettlement ? 'exact' : 'percentage',
      splits: validSplits,
      splitPercentages,
      isSettlement,
      date: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!isSettlement && expenseCurrency !== group.currency) {
      payload.originalCurrency = expenseCurrency;
      payload.originalAmount = baseAmount;
      payload.exchangeRate = effectiveExchangeRate;
    }

    try {
      setIsSavingExpense(true);
      setExpenseError('');
      setSettlementError('');
      const data = await request<{ expense: Expense }>('expenses.create', payload);
      setExpenses((currentExpenses) => [
        { ...data.expense, date: data.expense.date ? new Date(data.expense.date) : new Date() },
        ...currentExpenses,
      ]);

      if (!isSettlement) {
        setDesc('');
        setAmount('');
        setIsAddingExpense(false);
      } else {
        setIsSettling(false);
        setSettleAmount('');
        setSettlePayerId('');
        setSettleSplitId('');
      }
    } catch (error) {
      console.error("Error creating expense:", error);
      const message = t('error_save_expense');
      isSettlement ? setSettlementError(message) : setExpenseError(message);
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense || !group || isUpdatingExpense) return;
    const parsedAmount = parseFloat(editAmount);
    const resolvedPayer = getResolvedEditPayerId();
    const effectiveRate = editCurrency === group.currency ? 1 : editExchangeRate;

    if (!editDesc.trim()) {
      setEditExpenseError(t('error_enter_description'));
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setEditExpenseError(t('error_valid_amount'));
      return;
    }
    if (!resolvedPayer) {
      setEditExpenseError(t('error_choose_payer'));
      return;
    }
    if (editCurrency !== group.currency && (isFetchingEditRate || !Number.isFinite(effectiveRate) || effectiveRate <= 0)) {
      setEditExpenseError(t('error_exchange_rate_not_ready'));
      return;
    }

    const totalPercentage = getPercentageTotal(group.memberIds, editPercentageSplits);
    const hasInvalidPercentage = group.memberIds.some((memberId) => {
      const value = parseFloat(editPercentageSplits[memberId] || '');
      return !Number.isFinite(value) || value < 0;
    });

    if (hasInvalidPercentage || Math.abs(totalPercentage - 100) > 0.01) {
      setEditExpenseError(t('error_percentage_total'));
      return;
    }

    const payload = buildExpensePayload(editDesc, editAmount, editCurrency, effectiveRate, resolvedPayer, editPercentageSplits);
    if (!payload) return;

    try {
      setIsUpdatingExpense(true);
      setEditExpenseError('');
      const data = await request<{ expense: Expense }>('expenses.update', {
        ...payload,
        expenseId: editingExpense.id,
      });
      const updatedExpense = { ...data.expense, date: data.expense.date ? new Date(data.expense.date) : new Date() };
      setExpenses((currentExpenses) => currentExpenses.map((expense) => (
        expense.id === updatedExpense.id ? updatedExpense : expense
      )));
      setEditingExpense(null);
    } catch (error) {
      console.error('Error updating expense:', error);
      setEditExpenseError(t('error_save_expense'));
    } finally {
      setIsUpdatingExpense(false);
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (deletingExpenseId) return;
    const confirmed = window.confirm(t('confirm_delete_expense'));
    if (!confirmed) return;

    try {
      setDeletingExpenseId(expense.id);
      await request('expenses.delete', { expenseId: expense.id });
      setExpenses((currentExpenses) => currentExpenses.filter((item) => item.id !== expense.id));
    } catch (error) {
      console.error('Error deleting expense:', error);
    } finally {
      setDeletingExpenseId('');
    }
  };

  const handleInviteFriend = async () => {
    if (!selectedInviteFriendId || !group || !id) return;
    const selectedFriend = profile?.friends?.find((friend) => friend.uid === selectedInviteFriendId);
    if (!selectedFriend?.email) return;

    try {
      const data = await request<{ group: Group }>('groups.addMemberByEmail', {
        groupId: id,
        email: selectedFriend.email.toLowerCase(),
      });
      setGroup(data.group);
      setSelectedInviteFriendId('');
      setIsInviting(false);
    } catch (error) {
      console.error("Error inviting friend:", error);
    }
  };

  const handleDeleteGroup = async () => {
    if (!id || !group || profile?.uid !== group.ownerId || isDeletingGroup) return;
    const confirmed = window.confirm(t('confirm_delete_group'));
    if (!confirmed) return;

    setIsDeletingGroup(true);
    setDeleteGroupError('');

    try {
      await request('groups.delete', { groupId: id });
      navigate('/');
    } catch (error) {
      console.error('Error deleting group:', error);
      setDeleteGroupError(t('error_delete_group'));
      setIsDeletingGroup(false);
    }
  };

  // Balance calculation
  const getBalances = () => {
    const balances: Record<string, number> = {};
    if (!group) return balances;

    group.memberIds.forEach(mId => balances[mId] = 0);

    expenses.forEach(exp => {
      const conversionRate = getExpenseConversionRate(exp);
      const convertedAmount = roundMoney(exp.amount * conversionRate);
      // Payer gets back some of what they paid (amount - their share)
      if (balances[exp.payerId] === undefined) {
        balances[exp.payerId] = 0;
      }
      balances[exp.payerId] += convertedAmount;
      // Everyone who shared owes their portion
      if (exp.splits) {
        Object.entries(exp.splits).forEach(([uId, share]) => {
          if (balances[uId] !== undefined) {
            balances[uId] -= roundMoney((share as number) * conversionRate);
          }
        });
      }
    });

    return balances;
  };

  if (loading || !group) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#1ed760] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const userBalances = getBalances();
  const resolvedPayerId = getResolvedPayerId();
  const parsedExpenseAmount = parseFloat(amount);
  const percentageTotal = getPercentageTotal(group.memberIds, percentageSplits);
  const isPercentageSplitValid =
    group.memberIds.length > 0 &&
    group.memberIds.every((memberId) => {
      const value = parseFloat(percentageSplits[memberId] || '');
      return Number.isFinite(value) && value >= 0;
    }) &&
    Math.abs(percentageTotal - 100) <= 0.01;
  const canSaveExpense =
    Boolean(desc.trim()) &&
    Number.isFinite(parsedExpenseAmount) &&
    parsedExpenseAmount > 0 &&
    Boolean(resolvedPayerId) &&
    group.memberIds.length > 0 &&
    isPercentageSplitValid &&
    !isFetchingRate &&
    (expenseCurrency === group.currency || (Number.isFinite(exchangeRate) && exchangeRate > 0)) &&
    !isSavingExpense;
  const convertedAmount = roundMoney((Number.isFinite(parsedExpenseAmount) ? parsedExpenseAmount : 0) * (expenseCurrency === group.currency ? 1 : exchangeRate));
  const parsedEditAmount = parseFloat(editAmount);
  const editPercentageTotal = getPercentageTotal(group.memberIds, editPercentageSplits);
  const isEditPercentageSplitValid =
    group.memberIds.length > 0 &&
    group.memberIds.every((memberId) => {
      const value = parseFloat(editPercentageSplits[memberId] || '');
      return Number.isFinite(value) && value >= 0;
    }) &&
    Math.abs(editPercentageTotal - 100) <= 0.01;
  const canSaveEditExpense =
    Boolean(editingExpense) &&
    Boolean(editDesc.trim()) &&
    Number.isFinite(parsedEditAmount) &&
    parsedEditAmount > 0 &&
    Boolean(getResolvedEditPayerId()) &&
    isEditPercentageSplitValid &&
    !isFetchingEditRate &&
    (editCurrency === group.currency || (Number.isFinite(editExchangeRate) && editExchangeRate > 0)) &&
    !isUpdatingExpense;
  const convertedEditAmount = roundMoney((Number.isFinite(parsedEditAmount) ? parsedEditAmount : 0) * (editCurrency === group.currency ? 1 : editExchangeRate));
  const availableInviteFriends = (profile?.friends || []).filter((friend) => !group.memberIds.includes(friend.uid));
  const selectedInviteFriend = availableInviteFriends.find((friend) => friend.uid === selectedInviteFriendId);

  return (
    <div className="space-y-8 pb-20">
      {/* Header Navigation */}
      <div className="mb-8 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="h-10 w-full justify-start rounded-full px-4 text-[11px] font-bold uppercase tracking-wide sm:w-auto sm:text-xs sm:tracking-widest"
        >
          <ArrowLeft className="mr-2 shrink-0" size={16} />
          <span className="min-w-0 truncate">{t('back_to_dashboard')}</span>
        </Button>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2 sm:flex sm:justify-end">
          <Dialog open={isInviting} onOpenChange={(open) => {
            setIsInviting(open);
            if (!open) setSelectedInviteFriendId('');
          }}>
            <DialogTrigger className="inline-flex h-10 min-w-0 items-center justify-center rounded-full border border-slate-200 bg-background px-4 text-[11px] font-bold uppercase tracking-wide shadow-none transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#121212] hover:dark:bg-[#1f1f1f] sm:w-auto sm:shrink-0 sm:px-6 sm:text-xs sm:tracking-widest">
              <UserPlus size={16} className="mr-2 shrink-0" />
              <span className="min-w-0 truncate">{t('invite_friends')}</span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-lg border border-slate-200 dark:border-white/10 dark:bg-[#121212] shadow-none">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">{t('invite_friends')}</DialogTitle>
              </DialogHeader>
              <div className="py-6 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('invite_friend_help')}</p>
                {availableInviteFriends.length > 0 ? (
                  <Select value={selectedInviteFriendId} onValueChange={setSelectedInviteFriendId}>
                    <SelectTrigger className="h-14 rounded-full px-6 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 font-bold shadow-none">
                      <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        {selectedInviteFriend ? (
                          <>
                            <FriendAvatar name={selectedInviteFriend.displayName} photoURL={selectedInviteFriend.photoURL} />
                            <span className="min-w-0 truncate">{selectedInviteFriend.displayName}</span>
                          </>
                        ) : (
                          <span className="min-w-0 truncate">{t('select_friend')}</span>
                        )}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {availableInviteFriends.map((friend) => (
                        <SelectItem key={friend.uid} value={friend.uid} className="py-2">
                          <span className="flex min-w-0 items-center gap-3">
                            <FriendAvatar name={friend.displayName} photoURL={friend.photoURL} />
                            <span className="min-w-0 truncate">{friend.displayName}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:border-white/10 dark:bg-[#1f1f1f] dark:text-slate-400">
                    {t('no_available_friends')}
                  </div>
                )}
              </div>
              <DialogFooter className="flex-col gap-3 sm:flex-row">
                <Button variant="ghost" onClick={() => setIsInviting(false)} className="h-14 w-full rounded-full px-6 text-sm font-bold uppercase tracking-widest sm:flex-1">{t('cancel')}</Button>
                <Button disabled={!selectedInviteFriendId} onClick={handleInviteFriend} className="h-14 w-full rounded-full bg-black text-sm font-bold uppercase tracking-widest text-white shadow-none hover:bg-[#1ed760] hover:text-black dark:bg-[#1ed760] dark:text-black sm:flex-1">{t('invite')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger
              aria-label={t('group_settings')}
              className="inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-white/10 bg-background dark:bg-[#121212] shadow-none h-10 w-10 hover:bg-slate-100 hover:dark:bg-[#1f1f1f] transition-colors"
            >
              <Settings size={16} />
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-lg border border-slate-200 dark:border-white/10 dark:bg-[#121212] shadow-none">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">{t('group_settings')}</DialogTitle>
              </DialogHeader>
              <div className="py-6 space-y-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('members')}</label>
                  <div className="space-y-2">
                    {group.memberIds.map((mId) => (
                      <div key={mId} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-[#1f1f1f]">
                        {renderMemberAvatar(mId, "h-10 w-10 shrink-0", "text-xs")}
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="min-w-0 truncate text-sm font-black tracking-tight">{getMemberName(mId)}</p>
                            {renderYouBadge(mId)}
                          </div>
                          {mId === group.ownerId && (
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('owner')}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {profile?.uid === group.ownerId && (
                  <div className="border-t border-slate-200 pt-4 dark:border-white/10">
                    {deleteGroupError && (
                      <p className="mb-3 rounded-md bg-red-50 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-600 dark:bg-red-500/10 dark:text-red-300">
                        {deleteGroupError}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      disabled={isDeletingGroup}
                      onClick={handleDeleteGroup}
                      className="h-12 w-full rounded-full border-[#f3727f] text-[#f3727f] hover:bg-[#f3727f] hover:text-white dark:hover:text-black font-bold uppercase tracking-widest text-xs gap-2 shadow-none"
                    >
                      <Trash2 size={16} />
                      {isDeletingGroup ? t('deleting') : t('delete_group')}
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={Boolean(editingExpense)} onOpenChange={(open) => {
            if (!open) {
              setEditingExpense(null);
              setEditExpenseError('');
            }
          }}>
            <DialogContent className="sm:max-w-md rounded-lg border border-slate-200 dark:border-white/10 dark:bg-[#121212] shadow-none">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">{t('edit_expense')}</DialogTitle>
              </DialogHeader>
              <div className="py-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('description')}</label>
                  <Input
                    value={editDesc}
                    onChange={(e) => {
                      setEditDesc(e.target.value);
                      setEditExpenseError('');
                    }}
                    className="h-14 rounded-full px-6 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 text-lg font-bold shadow-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('amount')}</label>
                  <div className="flex gap-2">
                    <Select value={editCurrency} onValueChange={(v: Currency) => {
                      setEditCurrency(v);
                      setEditExpenseError('');
                    }}>
                      <SelectTrigger className="w-[100px] h-14 rounded-full px-4 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 font-bold shadow-none text-center">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={editAmount}
                      onChange={(e) => {
                        setEditAmount(e.target.value);
                        setEditExpenseError('');
                      }}
                      min="0"
                      step="0.01"
                      className="flex-1 h-14 rounded-full px-6 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 text-2xl font-black shadow-none"
                    />
                  </div>
                  {editCurrency !== group.currency && editAmount && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 pl-4 mt-2">
                      {isFetchingEditRate
                        ? t('fetching_rate')
                        : editExchangeRate > 0
                          ? `≈ ${convertedEditAmount.toFixed(2)} ${group.currency}`
                          : t('exchange_rate_unavailable')}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('payer')}</label>
                  <Select value={getResolvedEditPayerId()} onValueChange={(value) => {
                    setEditPayerId(value);
                    setEditExpenseError('');
                  }}>
                    <SelectTrigger className="h-14 rounded-full px-6 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 font-bold shadow-none">
                      <span className="flex min-w-0 flex-1 text-left">
                        {getResolvedEditPayerId() ? renderMemberLabel(getResolvedEditPayerId()) : t('payer')}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {group.memberIds.map((memberId) => (
                        <SelectItem key={memberId} value={memberId}>{renderMemberLabel(memberId)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#1f1f1f]">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('percentage_split')}</p>
                    <p className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      isEditPercentageSplitValid ? "text-[#1ed760]" : "text-[#f3727f]"
                    )}>
                      {t('total')}: {editPercentageTotal.toFixed(2)}%
                    </p>
                  </div>
                  <div className="space-y-2">
                    {group.memberIds.map((memberId) => (
                      <div key={memberId} className="grid grid-cols-[1fr_96px] items-center gap-3">
                        <span className="min-w-0 text-xs font-bold uppercase tracking-widest">{renderMemberLabel(memberId)}</span>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={editPercentageSplits[memberId] || ''}
                            onChange={(e) => {
                              setEditPercentageSplits((currentSplits) => ({
                                ...currentSplits,
                                [memberId]: e.target.value,
                              }));
                              setEditExpenseError('');
                            }}
                            className="h-10 rounded-full pr-8 text-right font-black shadow-none"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {editExpenseError && (
                  <p className="rounded-md bg-red-50 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-600 dark:bg-red-500/10 dark:text-red-300">
                    {editExpenseError}
                  </p>
                )}
              </div>
              <DialogFooter className="flex-col gap-3 sm:flex-row">
                <Button variant="ghost" onClick={() => {
                  setEditExpenseError('');
                  setEditingExpense(null);
                }} className="h-14 w-full rounded-full px-6 text-sm font-bold uppercase tracking-widest sm:flex-1">{t('cancel')}</Button>
                <Button disabled={!canSaveEditExpense} onClick={handleUpdateExpense} className="h-14 w-full rounded-full bg-black text-sm font-bold uppercase tracking-widest text-white shadow-none hover:bg-[#1ed760] hover:text-black dark:bg-[#1ed760] dark:text-black sm:flex-1">
                  {isUpdatingExpense ? t('saving') : t('save')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-black tracking-tight leading-none">{group.name}</h2>
          </div>
          <div className="flex -space-x-2 mt-4">
            {group.memberIds.map((mId) => (
              <React.Fragment key={mId}>{renderMemberAvatar(mId)}</React.Fragment>
            ))}
          </div>

          <div className="mt-12">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("h-2 w-2 rounded-full", userBalances[profile?.uid || ''] >= 0 ? "bg-[#1ed760]" : "bg-red-500")}></span>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {t('net_balance')} {group.currency}{isFetchingBalanceRates ? ` · ${t('updating_rates')}` : ''}
              </span>
            </div>
            <h3 className="text-xl md:text-8xl font-black tracking-tight leading-none">
              {userBalances[profile?.uid || ''] >= 0 ? (
                <span className="text-[#1ed760]">+</span>
              ) : (
                <span className="text-[#f3727f]">-</span>
              )}
              {Math.abs(userBalances[profile?.uid || ''] || 0).toFixed(2)}
            </h3>
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-xs font-black uppercase tracking-widest shadow-none outline-none hover:bg-slate-100 dark:border-white/10 dark:bg-[#121212] dark:hover:bg-white/5">
              {group.currency}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[120px] border-slate-200 dark:border-white/10 dark:bg-[#121212]">
              {CURRENCIES.map((currency) => (
                <DropdownMenuItem
                  key={currency}
                  onClick={() => handleGroupCurrencyChange(currency)}
                  className="font-bold text-xs uppercase tracking-widest cursor-pointer"
                >
                  {currency}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={isAddingExpense} onOpenChange={(open) => {
            setIsAddingExpense(open);
            setExpenseError('');
            if (open && resolvedPayerId) {
              setPayerId(resolvedPayerId);
            }
            if (open && group.memberIds.length > 0) {
              setPercentageSplits(createEqualPercentageSplits(group.memberIds));
            }
          }}>
            <DialogTrigger className="inline-flex shrink-0 items-center justify-center rounded-full h-14 px-8 bg-black dark:bg-[#1ed760] text-white dark:text-black hover:bg-[#1ed760] hover:dark:bg-[#1ed760] hover:text-black font-black text-sm uppercase tracking-tight transition-colors border border-transparent shadow-none">
              {t('add_expense')}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-lg border border-slate-200 dark:border-white/10 dark:bg-[#121212] shadow-none">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">{t('add_expense')}</DialogTitle>
              </DialogHeader>
              <div className="py-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('description')}</label>
                  <Input
                    placeholder="e.g. Sushi Dinner"
                    value={desc}
                    onChange={(e) => {
                      setDesc(e.target.value);
                      setExpenseError('');
                    }}
                    aria-invalid={Boolean(expenseError && !desc.trim())}
                    className="h-14 rounded-full px-6 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 text-lg font-bold shadow-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('amount')}</label>
                  <div className="flex gap-2">
                    <Select value={expenseCurrency} onValueChange={(v: Currency) => {
                      setExpenseCurrency(v);
                      setExpenseError('');
                    }}>
                      <SelectTrigger className="w-[100px] h-14 rounded-full px-4 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 font-bold shadow-none text-center">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['USD', 'TWD', 'HKD', 'JPY', 'EUR', 'AUD'].map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setExpenseError('');
                      }}
                      min="0"
                      step="0.01"
                      aria-invalid={Boolean(expenseError && (!amount || !Number.isFinite(parsedExpenseAmount) || parsedExpenseAmount <= 0))}
                      className="flex-1 h-14 rounded-full px-6 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 text-2xl font-black shadow-none"
                    />
                  </div>
                  {expenseCurrency !== group.currency && amount && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 pl-4 mt-2">
                      {isFetchingRate
                        ? t('fetching_rate')
                        : exchangeRate > 0
                          ? `≈ ${convertedAmount.toFixed(2)} ${group.currency}`
                          : t('exchange_rate_unavailable')}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('payer')}</label>
                    <Select value={resolvedPayerId} onValueChange={(value) => {
                      setPayerId(value);
                      setExpenseError('');
                    }}>
                      <SelectTrigger className="h-14 rounded-full px-6 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 font-bold shadow-none">
                        <span className="flex min-w-0 flex-1 text-left">
                          {resolvedPayerId ? renderMemberLabel(resolvedPayerId) : t('payer')}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {group.memberIds.map(mId => (
                          <SelectItem key={mId} value={mId}>{renderMemberLabel(mId)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                </div>
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#1f1f1f]">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('percentage_split')}</p>
                    <p className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      isPercentageSplitValid ? "text-[#1ed760]" : "text-[#f3727f]"
                    )}>
                      {t('total')}: {percentageTotal.toFixed(2)}%
                    </p>
                  </div>
                  <div className="space-y-2">
                    {group.memberIds.map((mId) => (
                      <div key={mId} className="grid grid-cols-[1fr_96px] items-center gap-3">
                        <span className="min-w-0 text-xs font-bold uppercase tracking-widest">{renderMemberLabel(mId)}</span>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={percentageSplits[mId] || ''}
                            onChange={(e) => {
                              setPercentageSplits((currentSplits) => ({
                                ...currentSplits,
                                [mId]: e.target.value,
                              }));
                              setExpenseError('');
                            }}
                            className="h-10 rounded-full pr-8 text-right font-black shadow-none"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {expenseError && (
                  <p className="rounded-md bg-red-50 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-600 dark:bg-red-500/10 dark:text-red-300">
                    {expenseError}
                  </p>
                )}
              </div>
              <DialogFooter className="flex-col gap-3 sm:flex-row">
                <Button variant="ghost" onClick={() => {
                  setExpenseError('');
                  setIsAddingExpense(false);
                }} className="h-14 w-full rounded-full px-6 text-sm font-bold uppercase tracking-widest sm:flex-1">{t('cancel')}</Button>
                <Button disabled={!canSaveExpense} onClick={() => handleCreateExpense()} className="h-14 w-full rounded-full bg-black text-sm font-bold uppercase tracking-widest text-white shadow-none hover:bg-[#1ed760] hover:text-black dark:bg-[#1ed760] dark:text-black sm:flex-1">
                  {isSavingExpense ? t('saving') : t('save')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full mt-12">
        <TabsList className="bg-transparent border-b border-slate-200 dark:border-white/10 rounded-none p-0 mb-8 w-full justify-start h-auto gap-8 flex">
          <TabsTrigger value="list" className="rounded-none px-0 py-4 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-black dark:data-[state=active]:border-white font-bold uppercase tracking-widest text-xs data-[state=active]:opacity-100 opacity-40 hover:opacity-100 transition-opacity border-b-2 border-transparent">
            <Receipt size={16} className="mr-2" /> {t('expenses')}
          </TabsTrigger>
          <TabsTrigger value="report" className="rounded-none px-0 py-4 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-black dark:data-[state=active]:border-white font-bold uppercase tracking-widest text-xs data-[state=active]:opacity-100 opacity-40 hover:opacity-100 transition-opacity border-b-2 border-transparent">
            <TrendingUp size={16} className="mr-2" /> {t('balances')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6">
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {expenses.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <Receipt size={40} />
                  </div>
                  <p className="text-slate-400 font-medium">{t('no_expenses')}</p>
                </div>
              ) : (
                expenses.map((expense) => {
                  const originalDisplay = getOriginalExpenseDisplay(expense);
                  const splitBreakdown = getSplitBreakdown(expense);
                  return (
                    <motion.div
                      key={expense.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <Card className="rounded-lg border border-slate-200 dark:border-white/10 dark:bg-[#181818] shadow-none hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group overflow-hidden">
                        <div className="flex items-center p-6">
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
                              <span>{format(expense.date, 'MMM do, yyyy')}</span>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex min-w-0 items-center gap-2">
                                  {renderMemberLabel(expense.payerId)}
                                  <span className="shrink-0">{t('paid')}</span>
                                </span>
                                {!expense.isSettlement && (
                                  <button
                                    type="button"
                                    onClick={() => openEditExpense(expense)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-white hover:text-black dark:border-white/10 dark:hover:bg-white/10 dark:hover:text-white"
                                    aria-label={t('edit_expense')}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={deletingExpenseId === expense.id}
                                  onClick={() => handleDeleteExpense(expense)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 text-[#f3727f] hover:bg-[#f3727f] hover:text-white disabled:opacity-50 dark:border-[#f3727f]/30"
                                  aria-label={t('delete_expense')}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="text-xl font-black tracking-tight leading-none">{expense.description}</h4>
                              <div className="text-right">
                                {originalDisplay?.differsFromGroup && (
                                  <p className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                    {t('original_amount', { amount: originalDisplay.amount.toFixed(2), currency: originalDisplay.currency })}
                                  </p>
                                )}
                                <p className="text-xl font-black tracking-tight leading-none text-[#1ed760]">
                                  {getConvertedExpenseAmount(expense).toFixed(2)} {group.currency}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-3">
                               <div className="flex items-center gap-2">
                                  <div className="flex -space-x-2">
                                     {splitBreakdown.map((split) => (
                                       <React.Fragment key={split.uid}>{renderMemberAvatar(split.uid)}</React.Fragment>
                                     ))}
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-2">
                                    {t('shared_by_count', { count: splitBreakdown.length })}
                                  </span>
                               </div>
                               {!expense.isSettlement && splitBreakdown.length > 0 && (
                                 <div className="grid gap-2 sm:grid-cols-2">
                                   {splitBreakdown.map((split) => (
                                     <div key={split.uid} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:bg-[#1f1f1f] dark:text-slate-400">
                                       <span className="truncate pr-3">{split.name}</span>
                                       <span className="shrink-0 text-slate-900 dark:text-white">
                                         {split.percentage.toFixed(2)}% · {split.amount.toFixed(2)} {group.currency}
                                       </span>
                                     </div>
                                   ))}
                                 </div>
                               )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </TabsContent>

        <TabsContent value="report" className="space-y-8">
           <Card className="rounded-lg border border-slate-200 dark:border-white/10 dark:bg-[#181818] shadow-none p-8">
              <h3 className="text-2xl font-black uppercase tracking-tight mb-8">{t('balances')}</h3>
              <div className="space-y-6">
                {group.memberIds.map(mId => {
                  const bal = userBalances[mId] || 0;
                  const isYou = mId === profile?.uid;
                  const balanceLabel = bal > 0
                    ? t(isYou ? 'you_are_owed' : 'is_owed')
                    : bal < 0
                      ? t(isYou ? 'you_owe' : 'owes')
                      : t('all_settled');
                  return (
                    <div key={mId} className="flex items-center justify-between p-6 rounded-lg bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10">
                      <div className="flex items-center gap-4">
                        {renderMemberAvatar(mId, "w-12 h-12", "text-sm")}
                        <div>
                          <p className="font-bold uppercase tracking-widest text-xs">
                            {renderMemberLabel(mId)}
                          </p>
                          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400">
                            {balanceLabel}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "text-xl font-black tracking-tight leading-none",
                        bal > 0 ? "text-[#1ed760]" : bal < 0 ? "text-[#f3727f]" : "text-slate-300 dark:text-white/50"
                      )}>
                        {bal > 0 ? "+" : bal < 0 ? "-" : ""}{Math.abs(bal).toFixed(2)}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-10 flex gap-4">
                 <Dialog open={isSettling} onOpenChange={(open) => {
                   setIsSettling(open);
                   setSettlementError('');
                 }}>
                   <DialogTrigger className="inline-flex shrink-0 items-center justify-center flex-1 rounded-full h-14 bg-black dark:bg-[#1ed760] text-white dark:text-black hover:bg-[#1ed760] hover:text-black font-black uppercase tracking-widest text-xs shadow-none">
                     {t('settle_up')}
                   </DialogTrigger>
                   <DialogContent className="sm:max-w-md rounded-lg border border-slate-200 dark:border-white/10 dark:bg-[#121212] shadow-none">
                     <DialogHeader>
                       <DialogTitle className="text-2xl font-black uppercase tracking-tight">{t('settle_up')}</DialogTitle>
                     </DialogHeader>
                     <div className="py-6 space-y-6">
                       <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('who_paid')}</label>
                           <Select value={settlePayerId} onValueChange={(value) => {
                             setSettlePayerId(value);
                             setSettlementError('');
                           }}>
                             <SelectTrigger className="h-14 rounded-full px-6 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 font-bold shadow-none">
                               <span className="flex min-w-0 flex-1 text-left">
                                 {settlePayerId ? renderMemberLabel(settlePayerId) : t('select')}
                               </span>
                             </SelectTrigger>
                             <SelectContent>
                               {group.memberIds.map(mId => (
                                 <SelectItem key={mId} value={mId}>{renderMemberLabel(mId)}</SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </div>
                         <div className="space-y-2">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('to_whom')}</label>
                           <Select value={settleSplitId} onValueChange={(value) => {
                             setSettleSplitId(value);
                             setSettlementError('');
                           }}>
                             <SelectTrigger className="h-14 rounded-full px-6 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 font-bold shadow-none">
                               <span className="flex min-w-0 flex-1 text-left">
                                 {settleSplitId ? renderMemberLabel(settleSplitId) : t('select')}
                               </span>
                             </SelectTrigger>
                             <SelectContent>
                               {group.memberIds.map(mId => (
                                 <SelectItem key={mId} value={mId}>{renderMemberLabel(mId)}</SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </div>
                       </div>
                       <div className="space-y-2">
                         <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('amount')}</label>
                         <div className="relative">
                           <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-slate-400">{group.currency}</span>
                           <Input
                             type="number"
                             placeholder="0.00"
                             value={settleAmount}
                             onChange={(e) => {
                               setSettleAmount(e.target.value);
                               setSettlementError('');
                             }}
                             min="0"
                             step="0.01"
                             className="h-14 rounded-full pl-16 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 text-2xl font-black shadow-none"
                           />
                         </div>
                       </div>
                       {settlementError && (
                         <p className="rounded-md bg-red-50 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-600 dark:bg-red-500/10 dark:text-red-300">
                           {settlementError}
                         </p>
                       )}
                     </div>
                     <DialogFooter className="flex-col gap-3 sm:flex-row">
                       <Button variant="ghost" onClick={() => {
                         setSettlementError('');
                         setIsSettling(false);
                       }} className="h-14 w-full rounded-full px-6 text-sm font-bold uppercase tracking-widest sm:flex-1">{t('cancel')}</Button>
                       <Button
                         disabled={isSavingExpense}
                         onClick={() => handleCreateExpense(true, settlePayerId, parseFloat(settleAmount), settleSplitId)}
                         className="h-14 w-full rounded-full bg-black text-sm font-bold uppercase tracking-widest text-white shadow-none hover:bg-[#1ed760] hover:text-black dark:bg-[#1ed760] dark:text-black sm:flex-1"
                       >
                         {isSavingExpense ? t('saving') : t('save')}
                       </Button>
                     </DialogFooter>
                   </DialogContent>
                 </Dialog>
              </div>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function uniqueMemberIds(memberIds: string[]) {
  return Array.from(new Set(memberIds.filter(Boolean)));
}

function FriendAvatar({ name, photoURL }: { name: string; photoURL?: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-black uppercase text-slate-700 dark:bg-slate-800 dark:text-white">
      {photoURL ? (
        <img src={photoURL} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        Array.from(name)[0] || '?'
      )}
    </span>
  );
}

function createEqualPercentageSplits(memberIds: string[]) {
  if (memberIds.length === 0) return {};

  const perMember = roundMoney(100 / memberIds.length);
  let assignedPercentage = 0;

  return memberIds.reduce<Record<string, string>>((splits, memberId, index) => {
    const isLastMember = index === memberIds.length - 1;
    const percentage = isLastMember ? roundMoney(100 - assignedPercentage) : perMember;
    splits[memberId] = percentage.toString();
    assignedPercentage += percentage;
    return splits;
  }, {});
}

function getPercentageTotal(memberIds: string[], percentageSplits: Record<string, string>) {
  return roundMoney(memberIds.reduce((total, memberId) => {
    const value = parseFloat(percentageSplits[memberId] || '0');
    return total + (Number.isFinite(value) ? value : 0);
  }, 0));
}
