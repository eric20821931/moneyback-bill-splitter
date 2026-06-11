import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users2, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '@/src/contexts/AuthContext';
import { useBalances } from '@/src/hooks/useBalances';
import { Currency } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';

const CURRENCIES: Currency[] = ['TWD', 'USD', 'HKD', 'JPY', 'EUR', 'AUD'];

export const Friends: React.FC = () => {
  const { t } = useTranslation();
  const { profile, request, refreshProfile } = useAuth();
  const { balances, balancesByCurrency, names, loading } = useBalances(profile?.uid);

  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(profile?.preferredCurrency || 'TWD');
  const [displayRates, setDisplayRates] = useState<Record<string, number>>({});

  useEffect(() => {
    if (profile?.preferredCurrency) {
      setDisplayCurrency(profile.preferredCurrency);
    }
  }, [profile?.preferredCurrency]);

  useEffect(() => {
    const sourceCurrencies = Object.keys(balancesByCurrency).filter((currency) => currency !== displayCurrency);
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
        console.error('Failed to fetch friends exchange rates:', error);
        if (!cancelled) setDisplayRates({});
      });

    return () => {
      cancelled = true;
    };
  }, [balancesByCurrency, displayCurrency]);

  const convertFriendBalance = (uid: string) => {
    return roundMoney(Object.entries(balancesByCurrency).reduce((total, [currency, currencyBalances]) => {
      const rate = currency === displayCurrency ? 1 : displayRates[currency] || 0;
      if (rate <= 0) return total;
      return total + (currencyBalances[uid] || 0) * rate;
    }, 0));
  };

  const handleDisplayCurrencyChange = async (currency: Currency) => {
    setDisplayCurrency(currency);
    try {
      await request('profile.update', { preferredCurrency: currency });
      await refreshProfile();
    } catch (error) {
      console.error('Failed to update preferred currency:', error);
    }
  };

  const uniqueFriendIds = new Set<string>();

  if (profile?.friends) {
    profile.friends.forEach(f => uniqueFriendIds.add(f.uid));
  }

  Object.keys(balances).forEach(uid => {
    if (balances[uid] !== 0) {
      uniqueFriendIds.add(uid);
    }
  });

  const friendsList = Array.from(uniqueFriendIds).map(uid => {
    const friendFromProfile = profile?.friends?.find(f => f.uid === uid);
    return {
      uid,
      name: friendFromProfile?.displayName || names[uid] || t('unknown_user'),
      email: friendFromProfile?.email || '',
      photoURL: friendFromProfile?.photoURL || '',
      balance: convertFriendBalance(uid)
    };
  });

  const handleAddFriend = async () => {
    if (!friendEmail.trim() || !profile) return;
    setAddLoading(true);
    setErrorMsg('');

    try {
      if (friendEmail.trim().toLowerCase() === profile.email.toLowerCase()) {
        setErrorMsg(t('error_add_self'));
        setAddLoading(false);
        return;
      }

      if (profile.friends?.some(f => f.email.toLowerCase() === friendEmail.trim().toLowerCase())) {
        setErrorMsg(t('error_already_friend'));
        setAddLoading(false);
        return;
      }

      await request('friends.add', { email: friendEmail.trim().toLowerCase() });
      await refreshProfile();
      setIsAddingFriend(false);
      setFriendEmail('');
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'error_add_friend';
      setErrorMsg(t(message));
    } finally {
      setAddLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-black dark:border-white/20 dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-[#1ed760]"></span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('network')}</span>
          </div>
          <h2 className="text-xl font-black tracking-tight leading-none">{t('friends')}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-xs font-black uppercase tracking-widest shadow-none outline-none hover:bg-slate-100 dark:border-white/10 dark:bg-[#121212] dark:hover:bg-[#252525]">
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
          <Dialog open={isAddingFriend} onOpenChange={setIsAddingFriend}>
            <DialogTrigger className="inline-flex shrink-0 items-center justify-center rounded-full h-12 px-8 bg-black dark:bg-[#1ed760] text-white dark:text-black hover:bg-[#1ed760] dark:hover:bg-[#1ed760] hover:text-white dark:hover:text-black font-black text-sm uppercase tracking-tight transition-colors border border-transparent shadow-none">
              <Plus size={18} className="mr-2" />
              {t('add_friend')}
            </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-lg border border-slate-200 dark:border-white/10 dark:bg-[#121212] shadow-none">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">{t('add_friend')}</DialogTitle>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('email_address')}</label>
                <Input
                  value={friendEmail}
                  onChange={(e) => { setFriendEmail(e.target.value); setErrorMsg(''); }}
                  placeholder="friend@example.com"
                  className="rounded-full h-14 px-6 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 text-lg font-bold"
                  autoFocus
                />
              </div>
              {errorMsg && <p className="text-red-500 text-xs font-bold uppercase">{errorMsg}</p>}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsAddingFriend(false)} className="rounded-full px-6 font-bold uppercase tracking-widest text-xs">{t('cancel')}</Button>
              <Button onClick={handleAddFriend} disabled={!friendEmail.trim() || addLoading} className="rounded-full bg-black dark:bg-[#1ed760] text-white dark:text-black hover:bg-[#1ed760] hover:text-white font-bold uppercase tracking-widest text-xs px-8 shadow-none">
                {addLoading ? t('adding') : t('add_friend')}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {friendsList.length === 0 ? (
        <div className="py-20 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-100 dark:bg-[#1f1f1f] border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <Users2 size={32} />
          </div>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('no_friends')}</p>
          <Button variant="outline" onClick={() => setIsAddingFriend(true)} className="rounded-full font-bold">
            {t('add_friend')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {friendsList.map((friend) => (
            <motion.div
              key={friend.uid}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#181818]"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full border-2 border-white dark:border-[#0A0A0A] bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-lg font-black uppercase overflow-hidden">
                  {friend.photoURL ? (
                    <img src={friend.photoURL} alt={friend.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    Array.from(friend.name)[0]
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">{friend.name}</h3>
                  {friend.email && <p className="text-xs text-slate-500 font-medium">{friend.email}</p>}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10">
                {friend.balance === 0 ? (
                  <p className="text-sm font-bold uppercase tracking-widest text-slate-500">{t('all_settled')}</p>
                ) : friend.balance > 0 ? (
                  <div className="flex items-center gap-2 text-[#1ed760] font-black tracking-tight text-xl">
                    <ArrowUpRight size={20} />
                    <span>{t('owes_you_display', { currency: displayCurrency, amount: friend.balance.toFixed(2) })}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-500 font-black tracking-tight text-xl">
                    <ArrowDownLeft size={20} />
                    <span>{t('you_owe_display', { currency: displayCurrency, amount: Math.abs(friend.balance).toFixed(2) })}</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
