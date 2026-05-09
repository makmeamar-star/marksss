import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — SattaKing Pro" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl space-y-4">
      <h1 className="font-display text-3xl font-bold">Profile</h1>
      <div className="glass rounded-xl p-6 space-y-3">
        <Row label="Username" value={user?.username} />
        <Row label="Email" value={user?.email} />
        <Row label="Phone" value={user?.phone ?? "—"} />
        <Row label="Role" value={user?.role} />
        <Row label="Referral Code" value={user?.referralCode} mono />
        <Row label="Member since" value={user?.createdAt?.slice(0, 10)} />
      </div>
      <p className="text-xs text-muted-foreground/70 text-center">Edit, 2FA, sessions and referrals arrive in Phase 3.</p>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? "font-mono text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
