import { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function LegalLayout({ title, subtitle, updated, children }: { title: string; subtitle?: string; updated?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-1 w-full bg-tricolour opacity-80" aria-hidden />
      <SiteHeader />
      <header className="border-b border-border/60 bg-surface/40">
        <div className="container mx-auto px-4 py-10 md:py-14">
          <h1 className="font-display text-3xl md:text-5xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-muted-foreground max-w-2xl">{subtitle}</p>}
          {updated && <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground/80">Last updated · {updated}</p>}
        </div>
      </header>
      <main className="container mx-auto px-4 py-10 md:py-14 max-w-3xl prose prose-invert prose-headings:font-display prose-h2:mt-10 prose-h2:text-2xl prose-h3:text-lg prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
