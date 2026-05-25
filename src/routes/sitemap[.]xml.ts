import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://matka.world";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

/**
 * Dynamic sitemap covering every public, indexable route. Authenticated and
 * admin paths are intentionally excluded (also blocked in robots.txt).
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "hourly", priority: "1.0" },
          { path: "/markets", changefreq: "hourly", priority: "0.9" },
          { path: "/results", changefreq: "hourly", priority: "0.9" },
          { path: "/jodi", changefreq: "hourly", priority: "0.8" },
          { path: "/charts", changefreq: "daily", priority: "0.7" },
          
          { path: "/about", changefreq: "monthly", priority: "0.4" },
          { path: "/responsible-gaming", changefreq: "monthly", priority: "0.3" },
          { path: "/terms", changefreq: "monthly", priority: "0.3" },
          { path: "/privacy", changefreq: "monthly", priority: "0.3" },
          { path: "/refund-policy", changefreq: "monthly", priority: "0.3" },
          { path: "/login", changefreq: "yearly", priority: "0.2" },
          { path: "/register", changefreq: "yearly", priority: "0.5" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
