import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { ArrowRight, Globe, ShieldCheck } from 'lucide-react';
import { SignInButton } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { ProjectIcon } from '@/components/ProjectIcon';

export const Landing: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen overflow-hidden bg-[#121212] font-sans text-white">
      <header className="relative z-10 mx-auto flex max-w-screen-2xl items-center justify-between border-b border-[#2a2a2a] p-5 lg:p-6">
        <div className="flex items-center gap-3">
          <ProjectIcon />
          <h1 className="text-2xl font-black leading-none tracking-tight">{t('app_name')}</h1>
        </div>
        <SignInButton mode="modal">
          <Button variant="ghost" className="hidden rounded-full border border-[#7c7c7c] px-6 text-xs font-bold uppercase tracking-[1.6px] text-white hover:border-white hover:bg-[#1f1f1f] sm:flex">
            {t('landing_login')}
          </Button>
        </SignInButton>
      </header>

      <main className="relative z-10 mx-auto grid max-w-screen-2xl items-center gap-10 px-5 pb-24 pt-14 lg:grid-cols-[0.9fr_1.1fr] lg:px-6">
        <motion.div
          initial={{ opacity: 0, x: -32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#1f1f1f] px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-[#1ed760]" />
            <span className="text-xs font-bold uppercase tracking-[1.6px] text-[#b3b3b3]">{t('landing_badge')}</span>
          </div>
          <h2 className="mb-6 max-w-2xl text-5xl font-black leading-none tracking-tight lg:text-7xl">
            {t('landing_title')} <span className="text-[#1ed760]">{t('landing_title_accent')}</span>
          </h2>
          <p className="mb-10 max-w-lg text-base font-normal leading-6 text-[#b3b3b3]">
            {t('landing_subtitle')}
          </p>
          <SignInButton mode="modal">
            <Button size="lg" className="h-14 rounded-full bg-[#1ed760] px-9 text-xs font-black uppercase tracking-[1.8px] text-black shadow-[rgba(0,0,0,0.5)_0px_8px_24px] transition-transform hover:scale-[1.02] hover:bg-[#1ed760] hover:text-black">
              {t('landing_cta')} <ArrowRight className="ml-2" />
            </Button>
          </SignInButton>

          <div className="mt-12 flex items-center gap-6 border-t border-[#2a2a2a] pt-6">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-[#b3b3b3]" />
              <span className="text-[10px] font-bold uppercase tracking-[1.6px] text-[#b3b3b3]">{t('landing_secure_login')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe size={20} className="text-[#b3b3b3]" />
              <span className="text-[10px] font-bold uppercase tracking-[1.6px] text-[#b3b3b3]">{t('landing_multi_currency')}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative"
        >
          <div className="relative z-10 rounded-lg bg-[#181818] p-5 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-6">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-2xl font-black tracking-tight">{t('landing_demo_group')}</h3>
              <span className="rounded-full bg-[#1ed760] px-3 py-1 text-[10px] font-black uppercase tracking-[1.6px] text-black">{t('landing_demo_currency')}</span>
            </div>

            <div className="space-y-2">
              {[
                { name: t('landing_demo_dinner'), amount: '¥12,400', payer: 'Alex', color: 'bg-[#1f1f1f] text-white' },
                { name: t('landing_demo_train'), amount: '¥3,200', payer: 'Sarah', color: 'bg-[#1f1f1f] text-white' },
                { name: t('landing_demo_hotel'), amount: '¥45,000', payer: t('you'), color: 'bg-[#1ed760] text-black' },
              ].map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-md bg-[#1f1f1f] p-4 hover:bg-[#252525]">
                  <div className="flex items-center gap-4">
                    <div className={`${item.color} flex h-12 w-12 items-center justify-center rounded-full text-sm font-black`}>
                      {Array.from(item.payer)[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{item.name}</p>
                      <p className="text-xs font-normal text-[#b3b3b3]">{t('landing_paid_by', { name: item.payer })}</p>
                    </div>
                  </div>
                  <span className="text-base font-black leading-none">{item.amount}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-[#2a2a2a] pt-6">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[1.6px] text-[#b3b3b3]">{t('landing_you_are_owed')}</p>
                <p className="text-2xl font-black leading-none text-[#1ed760]">¥21,500</p>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};
