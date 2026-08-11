import type { BrandConfig } from "./types";
import { go3net } from "./go3net";
import { speedfi } from "./speedfi";

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

export type { BrandConfig } from "./types";
export { go3net, speedfi };
