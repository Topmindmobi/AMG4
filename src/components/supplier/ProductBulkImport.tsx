"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  buildCategoryReferenceCsv,
  buildProductImportTemplateCsv,
  buildProductImportTemplateXls,
  downloadTextFile,
  importRowToProductInput,
  mapGridToImportRows,
  readImportFile,
  type ProductImportIssue,
  type ProductImportRow,
} from "@/lib/product-import";
import { upsertDemoProduct } from "@/lib/store/demo-store";
import type { Category } from "@/lib/types";

export function ProductBulkImport({
  supplierId,
  categories,
}: {
  supplierId: string;
  categories: Category[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProductImportRow[]>([]);
  const [issues, setIssues] = useState<ProductImportIssue[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function downloadCsvTemplate() {
    downloadTextFile(
      "amg-product-import-template.csv",
      buildProductImportTemplateCsv(categories),
      "text/csv;charset=utf-8",
    );
  }

  function downloadExcelTemplate() {
    downloadTextFile(
      "amg-product-import-template.xls",
      buildProductImportTemplateXls(categories),
      "application/vnd.ms-excel",
    );
  }

  function downloadCategories() {
    downloadTextFile(
      "amg-category-slugs.csv",
      buildCategoryReferenceCsv(categories),
      "text/csv;charset=utf-8",
    );
  }

  async function onFile(file: File | null) {
    setResult(null);
    setError(null);
    setPreview([]);
    setIssues([]);
    setFileName(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const grid = await readImportFile(file);
      const parsed = mapGridToImportRows(grid, categories);
      setPreview(parsed.rows);
      setIssues(parsed.issues);
      if (parsed.rows.length === 0 && parsed.issues.length === 0) {
        setError("No product rows found in the file.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read file");
    }
  }

  function runImport() {
    if (preview.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      let created = 0;
      for (const row of preview) {
        upsertDemoProduct(importRowToProductInput(row, categories, supplierId));
        created++;
      }
      setResult(`Imported ${created} product${created === 1 ? "" : "s"} successfully.`);
      setPreview([]);
      setIssues([]);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
      window.setTimeout(() => router.push("/supplier/products"), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-line bg-white p-5">
        <h2 className="font-display text-xl text-charcoal">1. Download template</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Fill in one product per row. Use a <code className="text-xs">category_slug</code> from the
          category reference (not free text). Towns:{" "}
          <code className="text-xs">Nairobi|Mombasa|Kisumu|Homabay|Mbita|Migori</code>.
          Excel can open the CSV or .xls template directly.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadCsvTemplate}
            className="rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white"
          >
            Download CSV template
          </button>
          <button
            type="button"
            onClick={downloadExcelTemplate}
            className="rounded-lg border border-forest px-4 py-2.5 text-sm font-semibold text-forest hover:bg-forest/5"
          >
            Download Excel template (.xls)
          </button>
          <button
            type="button"
            onClick={downloadCategories}
            className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-forest hover:text-charcoal"
          >
            Download category slugs
          </button>
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-ink-soft">
          <li>
            Required columns: <strong>name</strong>, <strong>category_slug</strong>,{" "}
            <strong>price_kes</strong>
          </li>
          <li>
            Optional: stock, short_description, detailed_description, barcode, towns, is_active
            (yes/no)
          </li>
          <li>
            For .xlsx from newer Excel: use <strong>Save As → CSV UTF-8</strong>, then upload
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-line bg-white p-5">
        <h2 className="font-display text-xl text-charcoal">2. Upload filled file</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Accepts <strong>.csv</strong> or the <strong>.xls</strong> template. Preview before
          importing — invalid rows are skipped with reasons below.
        </p>
        <div className="mt-4">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xls,.txt,text/csv,application/vnd.ms-excel"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-sand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-charcoal hover:file:bg-line"
          />
          {fileName && (
            <p className="mt-2 text-xs text-ink-soft">Selected: {fileName}</p>
          )}
        </div>
      </section>

      {error && (
        <p className="border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-charcoal">
          {error}
        </p>
      )}
      {result && (
        <p className="border border-forest/30 bg-forest/5 px-3 py-2 text-sm text-charcoal">
          {result}{" "}
          <Link href="/supplier/products" className="font-semibold text-forest underline">
            View products
          </Link>
        </p>
      )}

      {issues.length > 0 && (
        <section className="rounded-lg border border-ember/30 bg-ember/5 p-4">
          <h3 className="text-sm font-semibold text-charcoal">
            {issues.length} row issue{issues.length === 1 ? "" : "s"}
          </h3>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-ink-soft">
            {issues.slice(0, 40).map((issue, i) => (
              <li key={`${issue.rowNumber}-${i}`}>
                Row {issue.rowNumber}: {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview.length > 0 && (
        <section className="rounded-lg border border-line bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl text-charcoal">
              3. Preview ({preview.length} ready to import)
            </h2>
            <button
              type="button"
              disabled={importing}
              onClick={runImport}
              className="rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-sand-light disabled:opacity-50"
            >
              {importing ? "Importing…" : `Import ${preview.length} products`}
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="pb-2 pr-3">Row</th>
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3">Price</th>
                  <th className="pb-2 pr-3">Stock</th>
                  <th className="pb-2">Towns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {preview.slice(0, 50).map((row) => (
                  <tr key={`${row.rowNumber}-${row.name}`}>
                    <td className="py-2 pr-3 text-ink-soft">{row.rowNumber}</td>
                    <td className="py-2 pr-3 font-medium text-charcoal">{row.name}</td>
                    <td className="py-2 pr-3">{row.category_slug}</td>
                    <td className="py-2 pr-3">{row.price_kes.toLocaleString()}</td>
                    <td className="py-2 pr-3">{row.stock}</td>
                    <td className="py-2">{row.towns.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 50 && (
              <p className="mt-2 text-xs text-ink-soft">
                Showing first 50 of {preview.length} rows.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
