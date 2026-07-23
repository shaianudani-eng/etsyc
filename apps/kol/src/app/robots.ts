import type { MetadataRoute } from "next";

/**
 * Crawl policy: public surfaces are open; /preview is the internal block
 * matrix and stays out of the index (its page metadata also noindexes it).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/preview", "/account", "/seller"],
    },
    sitemap: "https://etsyc.vercel.app/sitemap.xml",
  };
}
