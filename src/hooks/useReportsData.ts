import { useState, useEffect } from 'react';
import { Group, Expense } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export const useReportsData = (profileUid: string | undefined) => {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const { request } = useAuth();

  useEffect(() => {
    if (!profileUid) {
      setExpenses([]);
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;
    request('reports.data')
      .then((data) => {
        if (cancelled) return;
        setGroups(data.groups || []);
        setExpenses((data.expenses || []).map((expense: Expense) => ({
          ...expense,
          date: expense.date ? new Date(expense.date) : new Date(),
        })));
      })
      .catch((error) => {
        console.error("Error fetching reports:", error);
        setExpenses([]);
        setGroups([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileUid, request]);

  return { expenses, groups, loading };
};
