import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import {
  Users,
  Home,
  Settings,
  LogOut,
  Moon,
  Sun,
  Globe,
  Menu,
  X,
  PieChart,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProjectIcon } from '@/components/ProjectIcon';
import { cn } from '@/lib/utils';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, request, refreshProfile, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(profile?.theme || 'light');

  useEffect(() => {
    if (profile?.theme) {
      setTheme(profile.theme);
    }
  }, [profile?.theme]);

  useEffect(() => {
    if (profile?.language && i18n.language !== profile.language) {
      i18n.changeLanguage(profile.language);
    }
  }, [profile?.language, i18n]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (profile) {
      await request('profile.update', { theme: newTheme });
      await refreshProfile();
    }
  };

  const toggleLanguage = async () => {
    const newLanguage = i18n.language === 'en' ? 'zh' : 'en';
    await i18n.changeLanguage(newLanguage);
    if (profile) {
      await request('profile.update', { language: newLanguage });
      await refreshProfile();
    }
  };

  const navItems = [
    { name: t('groups'), icon: Home, path: '/' },
    { name: t('friends'), icon: Users, path: '/friends' },
    { name: t('reports'), icon: PieChart, path: '/reports' },
    { name: t('settings'), icon: Settings, path: '/settings' },
  ];

  return (
    <div className={cn(
      "min-h-screen flex transition-colors duration-300 font-sans",
      theme === 'dark' ? "bg-[#121212] text-white" : "bg-[#f6f6f6] text-[#121212]"
    )}>
      {/* Mobile Sidebar Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="icon" className={cn(
          "h-11 w-11 rounded-full border-0 shadow-[rgba(0,0,0,0.3)_0px_8px_24px]",
          theme === 'dark' ? "bg-[#1f1f1f] text-white hover:bg-[#2a2a2a]" : "bg-white text-[#121212] hover:bg-[#eeeeee]"
        )} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 transition-transform duration-300 lg:translate-x-0",
        theme === 'dark' ? "bg-[#121212]" : "bg-[#f6f6f6]",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-5 pt-20 lg:pt-5 flex flex-col h-full">
          <div className={cn(
            "mb-5 rounded-lg p-5 shadow-[rgba(0,0,0,0.18)_0px_8px_18px]",
            theme === 'dark' ? "bg-[#181818]" : "bg-white"
          )}>
            <div className="mb-1 flex items-center gap-3">
              <ProjectIcon />
              <h1 className={cn("text-2xl font-black leading-none tracking-tight", theme === 'dark' ? "text-white" : "text-[#121212]")}>{t('app_name')}</h1>
            </div>
            <p className={cn("text-xs font-bold", theme === 'dark' ? "text-[#b3b3b3]" : "text-[#5f5f5f]")}>{profile?.email}</p>
          </div>

          <p className={cn("mb-3 px-3 text-xs font-bold uppercase tracking-[1.6px]", theme === 'dark' ? "text-[#b3b3b3]" : "text-[#5f5f5f]")}>{t('menu')}</p>

          <nav className={cn("flex-1 space-y-1 rounded-lg p-2", theme === 'dark' ? "bg-[#181818]" : "bg-white")}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-4 rounded-md px-4 py-3 text-sm transition-all duration-200",
                  location.pathname === item.path
                    ? theme === 'dark' ? "bg-[#1f1f1f] font-bold text-white" : "bg-[#eeeeee] font-bold text-[#121212]"
                    : theme === 'dark' ? "font-normal text-[#b3b3b3] hover:bg-[#1f1f1f] hover:text-white" : "font-normal text-[#5f5f5f] hover:bg-[#eeeeee] hover:text-[#121212]"
                )}
              >
                <item.icon size={20} className={cn(
                  "transition-colors",
                  location.pathname === item.path ? "text-[#1ed760]" : ""
                )} />
                {item.name}
              </Link>
            ))}
          </nav>

          <div className={cn(
            "mt-5 space-y-4 rounded-lg p-4 shadow-[rgba(0,0,0,0.18)_0px_8px_18px]",
            theme === 'dark' ? "bg-[#181818]" : "bg-white"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 border-0">
                  <AvatarImage src={profile?.photoURL} />
                  <AvatarFallback className={cn("text-xs font-bold", theme === 'dark' ? "bg-[#1f1f1f] text-white" : "bg-[#eeeeee] text-[#121212]")}>
                    {profile?.displayName ? Array.from(profile.displayName)[0] : 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className={cn("max-w-[100px] truncate text-sm font-bold", theme === 'dark' ? "text-white" : "text-[#121212]")}>{profile?.displayName}</span>
              </div>
              <Button variant="ghost" size="icon" className={cn("rounded-full hover:text-[#f3727f]", theme === 'dark' ? "text-[#b3b3b3] hover:bg-[#1f1f1f]" : "text-[#5f5f5f] hover:bg-[#eeeeee]")} onClick={() => signOut()}>
                <LogOut size={18} className="transition-colors" />
              </Button>
            </div>

            <div className={cn("flex items-center justify-center gap-3 rounded-full p-2", theme === 'dark' ? "bg-[#1f1f1f]" : "bg-[#eeeeee]")}>
              <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
                  theme === 'dark' ? "bg-[#2a2a2a] text-white hover:bg-[#333333]" : "bg-white text-[#121212] hover:bg-[#f6f6f6]"
                )}
                aria-label={theme === 'light' ? t('dark') : t('light')}
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <button
                type="button"
                onClick={toggleLanguage}
                className={cn("flex h-11 w-11 items-center justify-center rounded-full transition-colors", theme === 'dark' ? "text-[#b3b3b3] hover:bg-[#2a2a2a] hover:text-white" : "text-[#5f5f5f] hover:bg-white hover:text-[#121212]")}
                aria-label={t('language')}
              >
                <Globe size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn("flex-1 p-4 pt-20 lg:ml-72 lg:p-5 min-h-screen", theme === 'dark' ? "bg-[#121212]" : "bg-[#f6f6f6]")}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={cn(
            "mx-auto h-full max-w-6xl rounded-lg p-4 shadow-[rgba(0,0,0,0.18)_0px_8px_18px] sm:p-6 lg:p-8",
            theme === 'dark' ? "bg-[#181818]" : "bg-white"
          )}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};
