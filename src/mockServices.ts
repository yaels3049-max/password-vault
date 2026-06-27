export type ServiceCategory = 'practice' | 'banking' | 'health' | 'shopping';

export type LoginFieldType = 'text' | 'password';

export interface LoginField {
  id: string;
  label: string;
  type: LoginFieldType;
}

export interface Service {
  id: string;
  name: string;
  icon: string;
  url: string;
  loginUrl?: string;
  category: ServiceCategory;
  logoUrl?: string;
  loginFields?: LoginField[];
}

export function getServiceOpenUrl(service: Service): string {
  return service.loginUrl ?? service.url;
}

export const DEFAULT_LOGIN_FIELDS: LoginField[] = [
  { id: 'username', label: 'שם משתמש', type: 'text' },
  { id: 'password', label: 'סיסמה', type: 'password' },
];

export function getLoginFields(service: Service): LoginField[] {
  return service.loginFields ?? DEFAULT_LOGIN_FIELDS;
}

function highResFavicon(siteUrl: string): string {
  return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(siteUrl)}&size=128`;
}

export { highResFavicon };

export const HUB_PRACTICE_LOGIN_ID = 'hub-practice-login';

export const mockServices: Service[] = [
  {
    id: HUB_PRACTICE_LOGIN_ID,
    name: 'תרגול התחברות',
    icon: '✨',
    url: '/demo-login.html',
    category: 'practice',
  },
  {
    id: 'hapoalim',
    name: 'בנק הפועלים',
    icon: '🏦',
    url: 'https://www.bankhapoalim.co.il',
    logoUrl: highResFavicon('https://www.bankhapoalim.co.il'),
    loginFields: [
      { id: 'username', label: 'שם משתמש', type: 'text' },
      { id: 'password', label: 'סיסמה', type: 'password' },
    ],
    category: 'banking',
  },
  {
    id: 'leumi',
    name: 'בנק לאומי',
    icon: '🏦',
    url: 'https://www.leumi.co.il',
    logoUrl: highResFavicon('https://www.leumi.co.il'),
    category: 'banking',
  },
  {
    id: 'discount',
    name: 'דיסקונט',
    icon: '🏦',
    url: 'https://www.discountbank.co.il',
    logoUrl: highResFavicon('https://www.discountbank.co.il'),
    category: 'banking',
  },
  {
    id: 'mizrahi',
    name: 'מזרחי טפחות',
    icon: '🏦',
    url: 'https://www.mizrahi-tefahot.co.il',
    logoUrl: highResFavicon('https://www.mizrahi-tefahot.co.il'),
    category: 'banking',
  },
  {
    id: 'clalit',
    name: 'כללית',
    icon: '🏥',
    url: 'https://www.clalit.co.il',
    loginUrl: 'https://e-services.clalit.co.il/onlineweb/general/login.aspx',
    logoUrl: highResFavicon('https://www.clalit.co.il'),
    loginFields: [
      { id: 'idNumber', label: 'מספר תעודת זהות', type: 'text' },
      { id: 'userCode', label: 'קוד משתמש', type: 'text' },
      { id: 'password', label: 'סיסמה', type: 'password' },
    ],
    category: 'health',
  },
  {
    id: 'maccabi',
    name: 'מכבי',
    icon: '🏥',
    url: 'https://www.maccabi4u.co.il',
    logoUrl: highResFavicon('https://www.maccabi4u.co.il'),
    category: 'health',
  },
  {
    id: 'meuhedet',
    name: 'מאוחדת',
    icon: '🏥',
    url: 'https://www.meuhedet.co.il',
    category: 'health',
  },
  {
    id: 'leumit',
    name: 'לאומית',
    icon: '🏥',
    url: 'https://www.leumit.co.il',
    category: 'health',
  },
  {
    id: 'shufersal',
    name: 'שופרסל',
    icon: '🛒',
    url: 'https://www.shufersal.co.il',
    loginUrl: 'https://www.shufersal.co.il/online/he/login',
    logoUrl: highResFavicon('https://www.shufersal.co.il'),
    loginFields: [
      { id: 'email', label: 'כתובת מייל', type: 'text' },
      { id: 'password', label: 'סיסמה', type: 'password' },
    ],
    category: 'shopping',
  },
  {
    id: 'rami-levy',
    name: 'רמי לוי',
    icon: '🛒',
    url: 'https://www.rami-levy.co.il',
    category: 'shopping',
  },
  {
    id: 'amazon-il',
    name: 'Amazon ישראל',
    icon: '🛒',
    url: 'https://www.amazon.co.il',
    category: 'shopping',
  },
  {
    id: 'ksp',
    name: 'KSP',
    icon: '🛒',
    url: 'https://www.ksp.co.il',
    category: 'shopping',
  },
  {
    id: 'htzone',
    name: 'הייטקזון',
    icon: '🛒',
    url: 'https://www.htzone.co.il',
    loginUrl: 'https://www.htzone.co.il/login',
    logoUrl: highResFavicon('https://www.htzone.co.il'),
    loginFields: [
      { id: 'email', label: 'אימייל', type: 'text' },
      { id: 'password', label: 'סיסמה', type: 'password' },
    ],
    category: 'shopping',
  },
];

export const categoryLabels: Record<ServiceCategory, string> = {
  practice: 'התחלה כאן',
  banking: 'בנקים',
  health: 'בריאות',
  shopping: 'קניות',
};

export const categoryQuestions: Record<ServiceCategory, string> = {
  practice: 'רוצים לחוות את המילוי האוטומטי? בחרו תרגול התחברות.',
  banking: 'איזה בנקים יש לך?',
  health: 'באיזו קופת חולים אתה חבר?',
  shopping: 'באילו אתרי קניות אתה משתמש?',
};

export const categories: ServiceCategory[] = [
  'practice',
  'banking',
  'health',
  'shopping',
];
