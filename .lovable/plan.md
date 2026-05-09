## Phase 3 — Wallet, Profile, Notifications, Win Celebration

Build out the remaining player-facing surfaces on top of the Phase 2 auth + bet stores.

### 1. Wallet store & transactions
- New `src/stores/walletStore.ts` (Zustand + persist): `transactions[]`, `depositRequests[]`, `withdrawRequests[]`, `bankAccounts[]`, `upiIds[]`.
- Actions: `requestDeposit`, `requestWithdraw`, `addBankAccount`, `addUpiId`, `getTransactionsForUser`, `approveDeposit`/`approveWithdraw` (used later by admin).
- Auto-credit signup bonus + bet debits/credits as `Transaction` rows so the ledger matches `authStore` balance.

### 2. `/wallet` route
- Tabs: **Overview**, **Deposit**, **Withdraw**, **Transactions**, **Payment Methods**.
- Overview: balance card (with glow), bonus balance, today's P&L, quick actions.
- Deposit tab: amount input (₹100–₹100k), method picker (UPI / Bank / QR), mock UPI ID + QR placeholder, "I have paid" → creates pending deposit + toast.
- Withdraw tab: amount input, bank/UPI selector, validation (min ₹500, ≤ balance, KYC stub check), creates pending withdrawal.
- Transactions tab: filterable table (type, status, date range), color-coded credit/debit, status pills.
- Payment Methods tab: add/remove UPI IDs + bank accounts (mock, stored locally).

### 3. `/profile` route
- Sections: avatar + display name, contact info (email/phone, read-only), KYC stub (Aadhaar/PAN upload mock with status badge), security (change password mock, 2FA toggle), preferences (theme already dark, notification toggles, language stub), danger zone (logout, delete account mock).
- Edits persist via `authStore.updateProfile`.

### 4. `/notifications` route + bell
- `src/stores/notificationStore.ts` with typed notifications (`result_declared`, `bet_won`, `bet_lost`, `deposit_approved`, `withdraw_approved`, `broadcast`).
- Page: list with filter chips, mark-as-read, bulk clear, empty state.
- Header bell badge (unread count) wired in `SiteHeader` / authenticated nav.
- Auto-emit notifications from `betStore` on settle and from `walletStore` on approve (used in Phase 4).

### 5. Win celebration
- `src/components/WinCelebration.tsx`: framer-motion confetti burst + animated payout counter + "View bet" CTA, mounted globally inside `_authenticated` layout.
- Triggered by a transient `lastWin` field on `betStore` cleared on dismiss.

### 6. Polish
- Skeleton loaders for wallet tables and notifications.
- Empty-state illustrations (simple SVG, no new assets needed).
- Toasts via `sonner` for every wallet action.

### Out of scope for Phase 3
- Real payment gateway, real KYC, admin approval UI (Phase 4), simulated cron / WS (Phase 5).

### Files to create
- `src/stores/walletStore.ts`
- `src/stores/notificationStore.ts`
- `src/components/WinCelebration.tsx`
- `src/components/wallet/{DepositForm,WithdrawForm,TransactionsTable,PaymentMethods}.tsx`
- Replace stubs: `src/routes/_authenticated/wallet.tsx`, `profile.tsx`, `notifications.tsx`

### Files to edit
- `src/stores/authStore.ts` — `updateProfile`, notification prefs.
- `src/stores/betStore.ts` — emit wallet ledger entries + `lastWin`.
- `src/routes/_authenticated.tsx` — mount `<WinCelebration/>`, bell badge.

Approve to start building.