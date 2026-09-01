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

/** Main / cover image. Demo/seed products always set image_path explicitly
 * (e.g. "/products/cement-50kg.jpg") — there's no live convention where a
 * product without image_path still has a matching static file, so guessing
 * one here only produced a guaranteed-broken <img> src for any real product
 * saved without a cover photo. Return null instead so callers fall back to
 * their own "no photo" placeholder. */
export function productImageUrl(product: Pick<Product, "slug" | "image_path">): string | null {
  return resolvePath(product.image_path);
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
