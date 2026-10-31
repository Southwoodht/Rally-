import type { MetadataRoute } from "next";

// Search engines may read the public pages; the app behind sign-in has
// nothing for them, and the API routes are not pages at all.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/privacy"], disallow: ["/api/", "/utrtest"] }],
    sitemap: "https://southwood.app/sitemap.xml",
    host: "https://southwood.app",
  };
}
