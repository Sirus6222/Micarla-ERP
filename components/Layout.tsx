
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Box, Users, Factory, Menu, X, Wallet, ChevronDown, PackagePlus, Languages, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Role } from '../types';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, signOut, hasRole } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: t('dashboard'), icon: LayoutDashboard, roles: [Role.SALES_REP, Role.MANAGER, Role.FINANCE, Role.FACTORY, Role.ADMIN] },
    { path: '/quotes', label: t('quotes'), icon: FileText, roles: [Role.SALES_REP, Role.MANAGER, Role.FINANCE, Role.ADMIN] },
    { path: '/finance', label: t('finance'), icon: Wallet, roles: [Role.FINANCE, Role.MANAGER, Role.ADMIN] },
    { path: '/production', label: t('production'), icon: Factory, roles: [Role.MANAGER, Role.SALES_REP, Role.FACTORY, Role.ADMIN] },
    { path: '/procurement', label: t('procurement'), icon: PackagePlus, roles: [Role.MANAGER, Role.ADMIN] },
    { path: '/products', label: t('products'), icon: Box, roles: [Role.MANAGER, Role.SALES_REP, Role.FACTORY, Role.ADMIN] },
    { path: '/customers', label: t('customers'), icon: Users, roles: [Role.SALES_REP, Role.MANAGER, Role.FINANCE, Role.ADMIN] },
  ];

  const NavContent = () => (
    <>
      <div className="p-6 border-b border-stone-700 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="w-8 h-8 bg-primary-500 rounded flex items-center justify-center text-stone-900 text-lg font-extrabold">G</span>
            GraniteFlow
          </h1>
        </div>
      </div>
      
      <div className="px-6 py-4 flex gap-2">
        <button onClick={() => setLocale('en')} className={`flex-1 py-1 rounded text-[10px] font-bold ${locale === 'en' ? 'bg-primary-600' : 'bg-stone-800 text-stone-500'}`}>EN</button>
        <button onClick={() => setLocale('am')} className={`flex-1 py-1 rounded text-[10px] font-bold ${locale === 'am' ? 'bg-primary-600' : 'bg-stone-800 text-stone-500'}`}>አማ</button>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.filter(item => hasRole(item.roles)).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link key={item.path} to={item.path} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive ? 'bg-primary-600 text-white shadow-md' : 'text-stone-300 hover:bg-stone-800 hover:text-white'}`}>
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-stone-800">
        <div className="relative">
          <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-3 px-4 py-3 text-stone-300 hover:text-white w-full transition-colors bg-stone-800 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center text-xs font-bold">{user?.avatarInitials}</div>
            <div className="flex-1 text-left">
              <div className="text-sm font-bold truncate">{user?.name}</div>
              <div className="text-[10px] text-stone-400">{user?.role}</div>
            </div>
            <ChevronDown size={14} />
          </button>
          {isUserMenuOpen && (
            <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-lg shadow-xl border border-stone-200 text-stone-800 z-50 overflow-hidden">
               <button onClick={signOut} className="w-full text-left px-4 py-3 hover:bg-red-50 hover:text-red-600 flex items-center gap-2 transition-colors">
                  <LogOut size={16} />
                  <span className="text-sm font-bold">Sign Out</span>
               </button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-stone-50 overflow-hidden">
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-stone-900 text-white flex items-center justify-between px-4 z-40">
         <span className="font-bold">GraniteFlow</span>
         <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2"><Menu size={24} /></button>
      </div>
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-stone-900 text-white flex flex-col transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <NavContent />
      </aside>
      <main className="flex-1 overflow-auto pt-16 lg:pt-0">{children}</main>
    </div>
  );
};
