export type Currency = 'USD' | 'TWD' | 'HKD' | 'JPY' | 'EUR' | 'AUD';
export type SplitType = 'equal' | 'exact' | 'percentage';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  preferredCurrency: Currency;
  language: 'en' | 'zh';
  theme: 'light' | 'dark';
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  createdAt: Date;
  friends?: { uid: string; displayName: string; email: string; photoURL?: string }[];
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  memberNames: Record<string, string>;
  memberPhotos?: Record<string, string>;
  defaultSplit?: Record<string, number>;
  defaultPayerId?: string;
  currency: Currency;
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  currency: Currency;
  originalCurrency?: Currency;
  originalAmount?: number;
  exchangeRate?: number;
  payerId: string;
  splitType: SplitType;
  splits: Record<string, number>;
  splitPercentages?: Record<string, number>;
  isSettlement?: boolean;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invitation {
  id: string;
  groupId: string;
  groupName: string;
  inviterId: string;
  inviterName: string;
  email: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}
