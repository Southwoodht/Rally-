import type { MetadataRoute } from "next";

// The two public pages. Everything else needs an account.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://southwood.app/", changeFrequency: "weekly", priority: 1 },
    { url: "https://southwood.app/privacy", changeFrequency: "yearly", priority: 0.3 },
  ];
}
