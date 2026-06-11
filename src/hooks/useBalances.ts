import { useState, useEffect } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';

export interface FriendBalance {
  uid: string;
  name: string;
  balance: number; // positive = they owe me, negative = I owe them
}

interface BalanceSummary {
  balances?: Record<string, number>;
  names?: Record<string, string>;
  totalOwedToYou?: number;
  totalYouOwe?: number;
  totalBalance?: number;
  balancesByCurrency?: Record<string, Record<string, number>>;
  totalsByCurrency?: Record<string, { totalBalance: number; totalOwedToYou: number; totalYouOwe: number }>;
  groupTotalsByCurrency?: Record<string, Record<string, number>>;
}

export const useBalances = (profileUid: string | undefined) => {
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [totalOwedToYou, setTotalOwedToYou] = useState(0);
  const [totalYouOwe, setTotalYouOwe] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [balancesByCurrency, setBalancesByCurrency] = useState<Record<string, Record<string, number>>>({});
  const [totalsByCurrency, setTotalsByCurrency] = useState<Record<string, { totalBalance: number; totalOwedToYou: number; totalYouOwe: number }>>({});
  const [groupTotalsByCurrency, setGroupTotalsByCurrency] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const { request } = useAuth();

  useEffect(() => {
    if (!profileUid) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    request<BalanceSummary>('balances.summary')
      .then((data) => {
        if (cancelled) return;
        setBalances(data.balances || {});
        setNames(data.names || {});
        setTotalOwedToYou(Number(data.totalOwedToYou || 0));
        setTotalYouOwe(Number(data.totalYouOwe || 0));
        setTotalBalance(Number(data.totalBalance || 0));
        setBalancesByCurrency(data.balancesByCurrency || {});
        setTotalsByCurrency(data.totalsByCurrency || {});
        setGroupTotalsByCurrency(data.groupTotalsByCurrency || {});
      })
      .catch((error) => {
        console.error("Error fetching balances:", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileUid, request]);

  return { balances, names, loading, totalOwedToYou, totalYouOwe, totalBalance, balancesByCurrency, totalsByCurrency, groupTotalsByCurrency };
};
