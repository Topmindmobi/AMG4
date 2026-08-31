"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useState } from "react";
import { BarcodeScanner } from "@/components/admin/BarcodeScanner";
import { CameraCapture } from "@/components/admin/CameraCapture";
import { slugify, TOWNS } from "@/lib/format";
import { productImageUrl, resolvePath } from "@/lib/product-image";
import { isDemoMode } from "@/lib/supabase/config";
import { getErrorMessage } from "@/lib/supabase/errors";
import { upsertDemoProduct } from "@/lib/store/demo-store";
import type { Category, Product, Supplier, Town } from "@/lib/types";

/** 5MB — generous enough for a phone-camera product photo, small enough to
 * keep the free-tier Supabase storage bucket and page load times sane. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Matches the image formats this app actually serves back out (product
 * cards/gallery render whatever the browser natively decodes) — no SVG or
 * other formats that could carry active content. */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `"${file.name}" is not a supported image type. Use JPEG, PNG, WebP, or GIF.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)}MB — the max is 5MB.`;
  }
  return null;
}

export function ProductForm({
  product,
  categories,
  suppliers,
  lockedSupplierId,
  redirectBase = "/admin/products",
}: {
  product?: Product;
  categories: Category[];
  suppliers: Supplier[];
  /** When set (supplier portal), force this supplier and hide the selector */
  lockedSupplierId?: string;
  redirectBase?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [towns, setTowns] = useState<Town[]>(product?.towns ?? ["Homabay"]);
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  // product.image_path/gallery are raw Supabase Storage keys (e.g.
  // "1699999999-photo.jpg"), not URLs — resolve them the same way
  // ProductCard does, or the <img> src just 404s against the site's own
  // origin. Freshly captured/uploaded data: URLs bypass this (see
  // onPhotoCaptured / the file-input handler below) and render as-is.
  const [coverPreview, setCoverPreview] = useState<string | null>(
    product ? productImageUrl(product) : null,
  );
  const [coverFile, setCoverFile] = useState<File | null>(null);
  // Raw values (storage keys, already-absolute paths, or fresh data: URLs) —
  // what actually gets saved. Resolved to display URLs only at render time
  // (see galleryDisplayUrls below), so re-saving an untouched gallery item
  // doesn't drift the DB column from "storage key" to "resolved URL".
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>(
    product?.gallery ?? [],
  );
  const galleryDisplayUrls = galleryPreviews.map((g) => (g.startsWith("data:") ? g : (resolvePath(g) ?? g)));
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<"cover" | "gallery">("cover");
  const [scannerOpen, setScannerOpen] = useState(false);

  const onScan = useCallback((code: string) => {
    setBarcode(code);
  }, []);

  function toggleTown(town: Town) {
    setTowns((prev) =>
      prev.includes(town) ? prev.filter((t) => t !== town) : [...prev, town],
    );
  }

  function onPhotoCaptured(file: File, dataUrl: string) {
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    if (cameraTarget === "cover") {
      setCoverFile(file);
      setCoverPreview(dataUrl);
      return;
    }
    setGalleryPreviews((prev) => [...prev, dataUrl]);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name"));
    const short_description = String(fd.get("short_description") || "");
    const detailed_description = String(fd.get("detailed_description") || "");
    const galleryText = String(fd.get("gallery") || "");
    const textGallery = galleryText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    // Prefer captured previews (data URLs / paths); merge with typed paths
    const gallery = Array.from(
      new Set([
        ...galleryPreviews.filter((g) => !g.startsWith("data:") || g.length < 2_000_000),
        ...textGallery,
      ]),
    );

    // coverPreview is a resolved display URL when editing an existing
    // product (see the state init above) — only use it as the value to
    // save when a NEW cover was actually captured/chosen this session
    // (coverFile set), otherwise keep the original raw storage key so the
    // DB column doesn't drift from "storage key" to "resolved URL" on every
    // no-photo-change save.
    let image_path = coverFile ? coverPreview : (product?.image_path ?? null);

    const payload = {
      id: product?.id,
      name,
      slug: String(fd.get("slug") || slugify(name)),
      short_description,
      detailed_description,
      description: short_description,
      category_id: String(fd.get("category_id")),
      supplier_id:
        lockedSupplierId || String(fd.get("supplier_id") || "") || null,
      price_kes: Number(fd.get("price_kes")),
      stock: Number(fd.get("stock")),
      towns,
      is_active: fd.get("is_active") === "on",
      image_path,
      gallery,
      barcode: barcode.trim() || null,
    };

    try {
      if (towns.length === 0) throw new Error("Select at least one town");

      if (isDemoMode()) {
        const saved = upsertDemoProduct(payload);
        router.push(`${redirectBase}/${saved.id}`);
        return;
      }

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const fileInput = fd.get("image") as File | null;
      const uploadFile = coverFile || (fileInput && fileInput.size > 0 ? fileInput : null);

      if (uploadFile) {
        const uploadFileError = validateImageFile(uploadFile);
        if (uploadFileError) throw new Error(uploadFileError);
        const path = `${Date.now()}-${uploadFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, uploadFile, { upsert: true });
        if (uploadError) throw uploadError;
        image_path = path;
      }

      // Upload any new gallery data-URLs to storage
      const finalGallery: string[] = [];
      for (const item of gallery) {
        if (item.startsWith("data:")) {
          const blob = await (await fetch(item)).blob();
          const path = `gallery-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
          const { error: gErr } = await supabase.storage
            .from("product-images")
            .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
          if (gErr) throw gErr;
          finalGallery.push(path);
        } else {
          finalGallery.push(item);
        }
      }

      const row = {
        name: payload.name,
        slug: payload.slug,
        short_description: payload.short_description,
        detailed_description: payload.detailed_description,
        description: payload.short_description,
        category_id: payload.category_id,
        supplier_id: payload.supplier_id,
        price_kes: payload.price_kes,
        stock: payload.stock,
        towns: payload.towns,
        is_active: payload.is_active,
        image_path,
        gallery: finalGallery,
        barcode: payload.barcode,
      };

      if (product?.id) {
        const { error: updateError } = await supabase
          .from("products")
          .update(row)
          .eq("id", product.id);
        if (updateError) throw updateError;
        router.push(`${redirectBase}/${product.id}`);
      } else {
        const { data, error: insertError } = await supabase
          .from("products")
          .insert(row)
          .select("id")
          .single();
        if (insertError) throw insertError;
        router.push(`${redirectBase}/${data.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Save failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-8 max-w-xl space-y-4">
        <Field label="Name" name="name" defaultValue={product?.name} required />
        <Field label="Slug" name="slug" defaultValue={product?.slug} />

        <div>
          <label className="block text-xs uppercase tracking-wide text-ink-soft">
            Barcode
            <input
              name="barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or type EAN / UPC / Code 128"
              className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
            />
          </label>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="mt-2 border border-ember/60 px-4 py-2 text-sm font-semibold text-ember hover:bg-ember/10"
          >
            Scan barcode with camera
          </button>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-ink-soft">Cover photo</p>
          {coverPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPreview}
              alt="Cover preview"
              className="mt-2 aspect-[4/3] w-full max-w-xs object-cover"
            />
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCameraTarget("cover");
                setCameraOpen(true);
              }}
              className="bg-ember px-4 py-2 text-sm font-semibold text-white"
            >
              Capture with camera
            </button>
            <label className="cursor-pointer border border-line px-4 py-2 text-sm text-charcoal/80 hover:bg-white">
              Upload file
              <input
                name="image"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const validationError = validateImageFile(file);
                  if (validationError) {
                    setError(validationError);
                    e.target.value = "";
                    return;
                  }
                  setError(null);
                  setCoverFile(file);
                  const reader = new FileReader();
                  reader.onload = () => setCoverPreview(String(reader.result));
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-ink-soft">Gallery photos</p>
          {galleryDisplayUrls.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {galleryDisplayUrls.map((src, i) => (
                <div key={`${src.slice(0, 32)}-${i}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="aspect-square w-full object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryPreviews((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="absolute right-1 top-1 bg-black/70 px-1.5 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setCameraTarget("gallery");
              setCameraOpen(true);
            }}
            className="mt-2 border border-line px-4 py-2 text-sm text-charcoal/80 hover:bg-white"
          >
            Capture gallery photo
          </button>
          <label className="mt-3 block text-xs uppercase tracking-wide text-ink-soft">
            Or paste gallery paths (one per line)
            <textarea
              name="gallery"
              rows={3}
              defaultValue={(product?.gallery ?? [])
                .filter((g) => !g.startsWith("data:"))
                .join("\n")}
              placeholder="/products/item-2.jpg"
              className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
            />
          </label>
        </div>

        <label className="block text-xs uppercase tracking-wide text-ink-soft">
          Short description
          <textarea
            name="short_description"
            rows={2}
            required
            defaultValue={product?.short_description || product?.description}
            className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
          />
        </label>
        <label className="block text-xs uppercase tracking-wide text-ink-soft">
          Detailed description
          <textarea
            name="detailed_description"
            rows={6}
            required
            defaultValue={product?.detailed_description}
            className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
          />
        </label>
        <label className="block text-xs uppercase tracking-wide text-ink-soft">
          Category
          <select
            name="category_id"
            required
            defaultValue={product?.category_id}
            className="amg-select mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {lockedSupplierId ? (
          <input type="hidden" name="supplier_id" value={lockedSupplierId} />
        ) : (
          <label className="block text-xs uppercase tracking-wide text-ink-soft">
            Supplier
            <select
              name="supplier_id"
              defaultValue={product?.supplier_id ?? ""}
              className="amg-select mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
            >
              <option value="">None</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Price (KES)"
            name="price_kes"
            type="number"
            defaultValue={product?.price_kes ?? 0}
            required
          />
          <Field
            label="Stock"
            name="stock"
            type="number"
            defaultValue={product?.stock ?? 0}
            required
          />
        </div>
        <fieldset>
          <legend className="text-xs uppercase tracking-wide text-ink-soft">Towns</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {TOWNS.map((town) => (
              <label key={town} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={towns.includes(town)}
                  onChange={() => toggleTown(town)}
                />
                {town}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input name="is_active" type="checkbox" defaultChecked={product?.is_active ?? true} />
          Active
        </label>
        {error && <p className="text-sm text-ember">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-ember px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save product"}
        </button>
      </form>

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={onPhotoCaptured}
      />
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={onScan}
      />
    </>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-xs uppercase tracking-wide text-ink-soft">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
      />
    </label>
  );
}
