
import React, { createContext, useContext, useState, useEffect } from 'react';

type Locale = 'en' | 'am';

const translations: Record<string, Record<Locale, string>> = {
  dashboard: { en: 'Dashboard', am: 'ዳሽቦርድ' },
  quotes: { en: 'Quotes / Orders', am: 'ኩቴሽኖች / ትዕዛዞች' },
  finance: { en: 'Sales Ledger', am: 'ፋይናንስ' },
  production: { en: 'Production', am: 'ምርት ክፍል' },
  procurement: { en: 'Procurement', am: 'ግዥ' },
  products: { en: 'Products', am: 'ምርቶች' },
  customers: { en: 'Customers', am: 'ደንበኞች' },
  new_quote: { en: 'New Quote', am: 'አዲስ ኩቴሽን' },
  pipeline: { en: 'Sales Pipeline', am: 'የሽያጭ ሂደት' },
  outstanding: { en: 'Outstanding Debt', am: 'ቀሪ ዕዳ' },
  approvals: { en: 'Pending Approvals', am: 'ማረጋገጫ የሚጠብቁ' },
  credit_risks: { en: 'Credit Risks', am: 'የብድር ስጋት' },
  collections: { en: 'Recent Collections', am: 'የቅርብ ጊዜ ገቢዎች' },
  job_sheets: { en: 'Active Job Sheets', am: 'የስራ ትዕዛዞች' },
  grand_total: { en: 'Grand Total', am: 'ጠቅላላ ድምር' },
  status: { en: 'Status', am: 'ሁኔታ' },
  customer: { en: 'Customer', am: 'ደንበኛ' },
  action: { en: 'Action', am: 'ተግባር' },
  width: { en: 'Width', am: 'ወርድ' },
  height: { en: 'Height', am: 'ቁመት' },
  pieces: { en: 'Pieces', am: 'ብዛት' },
  price_sqm: { en: 'Price/m²', am: 'ዋጋ በ ካሬ' },
  stock: { en: 'Stock', am: 'ክምችት' },
};

interface LanguageContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => (localStorage.getItem('lang') as Locale) || 'en');
  const setLocale = (l: Locale) => { setLocaleState(l); localStorage.setItem('lang', l); };
  const t = (key: string) => translations[key]?.[locale] || key;
  return <LanguageContext.Provider value={{ locale, setLocale, t }}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage error');
  return context;
};
