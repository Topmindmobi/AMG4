import type { Product } from "@/lib/types";

export function resolvePath(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("/")) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (base) {
    return `${base}/storage/v1/object/public/product-images/${path}`;
  }
  return `/${path}`;
}

/** Main / cover image */
export function productImageUrl(product: Pick<Product, "slug" | "image_path">): string | null {
  if (product.image_path) return resolvePath(product.image_path);
  return `/products/${product.slug}.jpg`;
}

/** Cover + gallery images for the product page */
export function productGalleryUrls(product: Product): string[] {
  const cover = productImageUrl(product);
  const extras = (product.gallery ?? [])
    .map((g) => resolvePath(g))
    .filter((g): g is string => Boolean(g));
  const all = [cover, ...extras].filter((g): g is string => Boolean(g));
  return Array.from(new Set(all));
}

export function productShortDescription(product: Product): string {
  return product.short_description || product.description || "";
}
