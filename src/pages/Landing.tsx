import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { ArrowRight, Globe, Languages, Moon, ShieldCheck, Sun } from 'lucide-react';
import { SignInButton } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { ProjectIcon } from '@/components/ProjectIcon';
import { cn } from '@/lib/utils';

export const Landing: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem('moneyback_theme') === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('moneyback_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => current === 'dark' ? 'light' : 'dark');
  };

  const toggleLanguage = async () => {
    const nextLanguage = i18n.language === 'en' ? 'zh' : 'en';
    window.localStorage.setItem('moneyback_language', nextLanguage);
    await i18n.changeLanguage(nextLanguage);
  };

  const isDark = theme === 'dark';

  return (
    <div className={cn(
      "min-h-screen overflow-hidden font-sans transition-colors",
      isDark ? "bg-[#121212] text-white" : "bg-[#f6f6f6] text-[#121212]"
    )}>
      <header className={cn(
        "relative z-10 mx-auto flex max-w-screen-2xl items-center justify-between border-b p-5 lg:p-6",
        isDark ? "border-[#2a2a2a]" : "border-slate-200"
      )}>
        <div className="flex items-center gap-3">
          <ProjectIcon />
          <h1 className="text-2xl font-black leading-none tracking-tight">{t('app_name')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? t('light') : t('dark')}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
              isDark ? "border-white/15 text-white hover:bg-[#1f1f1f]" : "border-slate-300 text-[#121212] hover:bg-white"
            )}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={t('language')}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border px-3 text-[11px] font-black uppercase tracking-[1.2px] transition-colors",
              isDark ? "border-white/15 text-white hover:bg-[#1f1f1f]" : "border-slate-300 text-[#121212] hover:bg-white"
            )}
          >
            <Languages size={16} />
            {i18n.language === 'en' ? '中' : 'EN'}
          </button>
          <SignInButton mode="modal">
            <Button variant="ghost" className={cn(
              "hidden rounded-full border px-6 text-xs font-bold uppercase tracking-[1.6px] sm:flex",
              isDark ? "border-[#7c7c7c] text-white hover:border-white hover:bg-[#1f1f1f]" : "border-slate-300 text-[#121212] hover:border-[#121212] hover:bg-white"
            )}>
              {t('landing_login')}
            </Button>
          </SignInButton>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-screen-2xl items-center gap-10 px-5 pb-24 pt-14 lg:grid-cols-[0.9fr_1.1fr] lg:px-6">
        <motion.div
          initial={{ opacity: 0, x: -32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className={cn(
            "mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2",
            isDark ? "bg-[#1f1f1f]" : "bg-white"
          )}>
            <span className="h-2 w-2 rounded-full bg-[#1ed760]" />
            <span className={cn("text-xs font-bold uppercase tracking-[1.6px]", isDark ? "text-[#b3b3b3]" : "text-slate-500")}>{t('landing_badge')}</span>
          </div>
          <h2 className="mb-6 max-w-2xl text-5xl font-black leading-none tracking-tight lg:text-7xl">
            {t('landing_title')} <span className="text-[#1ed760]">{t('landing_title_accent')}</span>
          </h2>
          <p className={cn("mb-10 max-w-lg text-base font-normal leading-6", isDark ? "text-[#b3b3b3]" : "text-slate-600")}>
            {t('landing_subtitle')}
          </p>
          <SignInButton mode="modal">
            <Button size="lg" className="h-14 rounded-full bg-[#1ed760] px-9 text-xs font-black uppercase tracking-[1.8px] text-black shadow-[rgba(0,0,0,0.5)_0px_8px_24px] transition-transform hover:scale-[1.02] hover:bg-[#1ed760] hover:text-black">
              {t('landing_cta')} <ArrowRight className="ml-2" />
            </Button>
          </SignInButton>

          <div className={cn("mt-12 flex items-center gap-6 border-t pt-6", isDark ? "border-[#2a2a2a]" : "border-slate-200")}>
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className={isDark ? "text-[#b3b3b3]" : "text-slate-500"} />
              <span className={cn("text-[10px] font-bold uppercase tracking-[1.6px]", isDark ? "text-[#b3b3b3]" : "text-slate-500")}>{t('landing_secure_login')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe size={20} className={isDark ? "text-[#b3b3b3]" : "text-slate-500"} />
              <span className={cn("text-[10px] font-bold uppercase tracking-[1.6px]", isDark ? "text-[#b3b3b3]" : "text-slate-500")}>{t('landing_multi_currency')}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative"
        >
          <div className={cn(
            "relative z-10 rounded-lg p-5 shadow-[rgba(0,0,0,0.18)_0px_8px_24px] lg:p-6",
            isDark ? "bg-[#181818]" : "bg-white"
          )}>
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-2xl font-black tracking-tight">{t('landing_demo_group')}</h3>
              <span className="rounded-full bg-[#1ed760] px-3 py-1 text-[10px] font-black uppercase tracking-[1.6px] text-black">{t('landing_demo_currency')}</span>
            </div>

            <div className="space-y-2">
              {[
                { name: t('landing_demo_dinner'), amount: '¥12,400', payer: 'Alex', color: isDark ? 'bg-[#1f1f1f] text-white' : 'bg-slate-100 text-[#121212]' },
                { name: t('landing_demo_train'), amount: '¥3,200', payer: 'Sarah', color: isDark ? 'bg-[#1f1f1f] text-white' : 'bg-slate-100 text-[#121212]' },
                { name: t('landing_demo_hotel'), amount: '¥45,000', payer: t('you'), color: 'bg-[#1ed760] text-black' },
              ].map((item) => (
                <div key={item.name} className={cn(
                  "flex items-center justify-between rounded-md p-4 transition-colors",
                  isDark ? "bg-[#1f1f1f] hover:bg-[#252525]" : "bg-slate-50 hover:bg-slate-100"
                )}>
                  <div className="flex items-center gap-4">
                    <div className={`${item.color} flex h-12 w-12 items-center justify-center rounded-full text-sm font-black`}>
                      {Array.from(item.payer)[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{item.name}</p>
                      <p className={cn("text-xs font-normal", isDark ? "text-[#b3b3b3]" : "text-slate-500")}>{t('landing_paid_by', { name: item.payer })}</p>
                    </div>
                  </div>
                  <span className="text-base font-black leading-none">{item.amount}</span>
                </div>
              ))}
            </div>

            <div className={cn("mt-8 flex items-center justify-between border-t pt-6", isDark ? "border-[#2a2a2a]" : "border-slate-200")}>
              <div>
                <p className={cn("mb-2 text-[10px] font-bold uppercase tracking-[1.6px]", isDark ? "text-[#b3b3b3]" : "text-slate-500")}>{t('landing_you_are_owed')}</p>
                <p className="text-2xl font-black leading-none text-[#1ed760]">¥21,500</p>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};
