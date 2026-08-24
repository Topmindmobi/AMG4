import type { NextConfig } from "next";

// Product photos uploaded via the admin ProductForm (src/components/admin/ProductForm.tsx)
// live in Supabase Storage's "product-images" bucket and are served from the
// project's own subdomain (src/lib/product-image.ts builds
// `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/<path>`).
// next/image (used for product photography — ProductCard, ProductGallery,
// the product detail page, and the cart) requires remote hosts to be
// explicitly allow-listed. Wildcarded to *.supabase.co so this doesn't need
// updating per environment (local/staging/prod each have their own project
// ref) — NEXT_PUBLIC_SUPABASE_URL isn't guaranteed to be set at
// next.config build-eval time either. A self-hosted/custom-domain Supabase
// instance is additionally allow-listed explicitly from the env var when
// it's available and not already a *.supabase.co host.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseHostname: string | undefined;
try {
  supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;
} catch {
  supabaseHostname = undefined;
}

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      ...(supabaseHostname && !supabaseHostname.endsWith(".supabase.co")
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
