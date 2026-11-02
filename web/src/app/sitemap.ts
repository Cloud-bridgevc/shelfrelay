import type { MetadataRoute } from "next";

const SITE = "https://shelfrelay.site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/retailers", "/wholesalers", "/compare", "/pricing", "/demo", "/privacy", "/terms"].map((p) => ({ url: `${SITE}${p}` }));
}
