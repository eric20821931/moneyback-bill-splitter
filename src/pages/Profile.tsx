import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Camera,
  RefreshCw,
  User,
  LogOut
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Currency } from '@/types';

const CURRENCIES: Currency[] = ['TWD', 'USD', 'HKD', 'JPY', 'EUR', 'AUD'];

export const Profile: React.FC = () => {
  const { profile, request, refreshProfile, signOut } = useAuth();
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isFetchingRates, setIsFetchingRates] = useState(false);
  const [usdRates, setUsdRates] = useState<Partial<Record<Currency, number>>>({ USD: 1 });
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<Date | null>(null);
  const [profileError, setProfileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDisplayName(profile?.displayName || '');
    setPhotoURL(profile?.photoURL || '');
  }, [profile?.displayName, profile?.photoURL]);

  useEffect(() => {
    let isMounted = true;

    const fetchUsdRates = async () => {
      setIsFetchingRates(true);
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();
        if (!isMounted) return;

        const nextRates = CURRENCIES.reduce<Partial<Record<Currency, number>>>((rates, currency) => {
          const value = currency === 'USD' ? 1 : Number(data?.rates?.[currency]);
          if (Number.isFinite(value) && value > 0) {
            rates[currency] = value;
          }
          return rates;
        }, { USD: 1 });

        const apiUpdatedAt = Number(data?.time_last_update_unix);
        setUsdRates(nextRates);
        setRatesUpdatedAt(new Date(Number.isFinite(apiUpdatedAt) ? apiUpdatedAt * 1000 : Date.now()));
      } catch (error) {
        console.error('Failed to fetch USD exchange rates:', error);
        if (isMounted) {
          setUsdRates({ USD: 1 });
          setRatesUpdatedAt(null);
        }
      } finally {
        if (isMounted) {
          setIsFetchingRates(false);
        }
      }
    };

    fetchUsdRates();

    return () => {
      isMounted = false;
    };
  }, []);

  const formattedRatesUpdatedAt = ratesUpdatedAt
    ? new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    }).format(ratesUpdatedAt)
    : null;

  const handleSaveProfile = async () => {
    if (!profile || !displayName.trim() || isSavingName) return;
    setIsSavingName(true);
    setProfileError('');
    try {
      await request('profile.update', { displayName: displayName.trim(), photoURL: photoURL.trim() });
      await refreshProfile();
    } catch (error) {
      console.error('Failed to update profile:', error);
      const messageKey = error instanceof Error ? error.message : 'error_update_profile';
      setProfileError(t(messageKey));
    } finally {
      setIsSavingName(false);
    }
  };

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!profile || !file) return;

    setIsUploadingPhoto(true);
    setProfileError('');
    try {
      const resizedPhoto = await resizeImage(file);
      setPhotoURL(resizedPhoto);
      await request('profile.update', { displayName: displayName.trim() || profile.displayName, photoURL: resizedPhoto });
      await refreshProfile();
    } catch (error) {
      console.error('Failed to update profile photo:', error);
      setProfileError(t('error_update_profile'));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-20 sm:space-y-10">
      <header className="mb-6 sm:mb-12">
        <h2 className="mb-3 text-lg font-black uppercase leading-none tracking-tight sm:mb-4 sm:text-xl">{t('settings')}</h2>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-xs sm:tracking-widest">{t('settings_subtitle')}</p>
      </header>

      {/* Profile Card */}
      <Card className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-none dark:border-white/10 dark:bg-[#121212] sm:p-8">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
          <div className="relative self-start">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white disabled:opacity-60 dark:border-white/10 dark:bg-[#121212] sm:h-24 sm:w-24"
              aria-label={t('profile_photo')}
            >
               {profile?.photoURL ? (
                 <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
               ) : (
                 <User className="text-black dark:text-white" size={40} />
               )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Camera size={22} />
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelected}
              className="hidden"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:tracking-widest">{t('display_name')}</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                    setProfileError('');
                  }}
                  className="h-12 rounded-full bg-white px-5 text-base font-black tracking-tight shadow-none dark:bg-[#1f1f1f] sm:text-lg"
                />
                <Button
                  disabled={!displayName.trim() || (displayName.trim() === profile?.displayName && photoURL.trim() === (profile?.photoURL || '')) || isSavingName}
                  onClick={handleSaveProfile}
                  className="h-12 w-full rounded-full bg-black px-6 text-xs font-bold uppercase tracking-widest text-white shadow-none hover:bg-[#1ed760] hover:text-black dark:bg-[#1ed760] dark:text-black sm:w-auto"
                >
                  {isSavingName ? t('saving') : t('save')}
                </Button>
              </div>
              {profileError && (
                <p className="rounded-md bg-red-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-red-600 dark:bg-red-500/10 dark:text-red-300 sm:tracking-widest">
                  {profileError}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:tracking-widest">{t('email_address')}</label>
              <div className="flex h-12 min-w-0 items-center truncate rounded-full border border-slate-200 bg-white px-5 text-xs font-bold tracking-wide text-slate-500 dark:border-white/10 dark:bg-[#1f1f1f] dark:text-slate-400 sm:uppercase sm:tracking-widest">
                {profile?.email}
              </div>
            </div>
            <div className="mt-6 flex gap-2">
               <span className="rounded-full bg-[#1ed760] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black">{t('verified')}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-none dark:border-white/10 dark:bg-[#121212] sm:p-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-[#1f1f1f] dark:text-white/60 sm:h-12 sm:w-12">
            <RefreshCw size={20} />
          </div>
          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-black uppercase tracking-wide sm:tracking-widest">{t('exchange_rate_title')}</h3>
            <p className="text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
              {t('exchange_rate_help')}
            </p>
            <a
              href="https://www.exchangerate-api.com/docs/free"
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-xs font-black uppercase tracking-wide text-green-600 hover:text-green-700 dark:text-[#1ed760] sm:tracking-widest"
            >
              {t('exchange_rate_source')}
            </a>
            <div className="pt-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:tracking-widest">
                  {t('usd_rate_base')}
                </p>
                {formattedRatesUpdatedAt && (
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500 sm:tracking-widest">
                    {t('rates_updated_at', { date: formattedRatesUpdatedAt })}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CURRENCIES.map((currency) => {
                  const rate = usdRates[currency];
                  const rateText = Number.isFinite(rate)
                    ? rate!.toFixed(currency === 'JPY' || currency === 'TWD' ? 2 : 4)
                    : isFetchingRates
                      ? '...'
                      : '--';

                  return (
                    <div
                      key={currency}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#1f1f1f]"
                    >
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500 sm:tracking-widest">
                        {currency}
                      </p>
                      <p className="mt-1 text-sm font-black tabular-nums tracking-tight text-slate-900 dark:text-white">
                        {rateText}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-8">
        <Button
          variant="outline"
          onClick={() => signOut()}
          className="mt-4 h-14 w-full gap-3 rounded-full border border-[#f3727f] text-xs font-bold uppercase tracking-widest text-[#f3727f] shadow-none hover:bg-[#f3727f] hover:text-white dark:hover:text-black sm:mt-8 sm:h-16"
        >
          <LogOut size={20} /> {t('logout')}
        </Button>
      </div>
    </div>
  );
};

function resizeImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      image.onload = () => {
        const maxSize = 256;
        const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('canvas_unavailable'));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.onerror = () => reject(new Error('image_load_failed'));
      image.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });
}
