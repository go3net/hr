import type { BrandConfig } from "./types.js";
import go3net from "./go3net.js";
import speedfi from "./speedfi.js";

export const brands: Record<string, BrandConfig> = {
  [go3net.slug]: go3net,
  [speedfi.slug]: speedfi,
};

export function getBrand(slug: string): BrandConfig {
  const brand = brands[slug];
  if (!brand) {
    throw new Error(
      `Unknown brand "${slug}". Known brands: ${Object.keys(brands).join(", ")}`,
    );
  }
  return brand;
}

export type { BrandConfig } from "./types.js";
export { go3net, speedfi };
