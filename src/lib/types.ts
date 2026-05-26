// Shared types for SattaKing Pro prototype.

export type Role = "USER" | "AGENT" | "ADMIN" | "SUPER_ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED" | "PENDING_VERIFICATION";

export type MarketStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type SessionType = "OPEN" | "CLOSE";
export type ResultStatus = "PENDING" | "DECLARED" | "CANCELLED";

export type BetType =
  | "SINGLE_OPEN"
  | "SINGLE_CLOSE"
  | "JODI"
  | "SINGLE_PANA"
  | "DOUBLE_PANA"
  | "TRIPLE_PANA"
  | "HALF_SANGAM"
  | "FULL_SANGAM";

export type BetStatus = "PENDING" | "WON" | "LOST" | "CANCELLED" | "REFUNDED";

export type Day = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export interface Market {
  id: string;
  name: string;
  displayName: string;
  openTime: string;   // HH:MM
  closeTime: string;
  resultTime: string;
  days: Day[];
  status: MarketStatus;
  isOpen: boolean;
  isCore?: boolean;
  isJodiOnly?: boolean;
  minBet: number;
  maxBet: number;
  payouts: {
    single: number;
    jodi: number;
    singlePana: number;
    doublePana: number;
    triplePana: number;
    halfSangam: number;
    fullSangam: number;
  };
}

export interface MarketResult {
  marketId: string;
  sessionDate: string; // YYYY-MM-DD
  openPana?: string;
  openDigit?: number;
  closePana?: string;
  closeDigit?: number;
  jodi?: string;
  status: ResultStatus;
  declaredAt?: string;
}

export interface Bet {
  id: string;
  userId: string;
  marketId: string;
  sessionDate: string;
  session: SessionType;
  betType: BetType;
  betNumber: string;
  amount: number;
  payout: number;
  status: BetStatus;
  winAmount?: number;
  createdAt: string;
  settledAt?: string;
}

export interface AppUser {
  id: string;
  username: string;
  email: string;
  phone?: string;
  role: Role;
  status: UserStatus;
  balance: number;
  totalDeposit: number;
  totalWithdraw: number;
  totalBet: number;
  totalWin: number;
  referralCode: string;
  createdAt: string;
}

export type TransactionType =
  | "DEPOSIT" | "WITHDRAWAL" | "BET_PLACED" | "BET_WIN"
  | "BET_REFUND" | "BONUS" | "REFERRAL_BONUS"
  | "ADMIN_CREDIT" | "ADMIN_DEBIT";

export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: TransactionStatus;
  description?: string;
  createdAt: string;
}
