import { slugify, TOWNS } from "@/lib/format";
import type { Category, Product, Town } from "@/lib/types";

/** Columns in the supplier bulk-import template (order matters). */
export const PRODUCT_IMPORT_COLUMNS = [
  "name",
  "category_slug",
  "price_kes",
  "stock",
  "short_description",
  "detailed_description",
  "barcode",
  "towns",
  "is_active",
] as const;

export type ProductImportColumn = (typeof PRODUCT_IMPORT_COLUMNS)[number];

export type ProductImportRow = {
  name: string;
  category_slug: string;
  price_kes: number;
  stock: number;
  short_description: string;
  detailed_description: string;
  barcode: string | null;
  towns: Town[];
  is_active: boolean;
  /** 1-based spreadsheet row for error messages */
  rowNumber: number;
};

export type ProductImportIssue = {
  rowNumber: number;
  message: string;
};

export type ProductImportParseResult = {
  rows: ProductImportRow[];
  issues: ProductImportIssue[];
};

const HEADER_ALIASES: Record<string, ProductImportColumn> = {
  name: "name",
  product_name: "name",
  product: "name",
  category_slug: "category_slug",
  category: "category_slug",
  category_name: "category_slug",
  price_kes: "price_kes",
  price: "price_kes",
  stock: "stock",
  qty: "stock",
  quantity: "stock",
  short_description: "short_description",
  description: "short_description",
  detailed_description: "detailed_description",
  details: "detailed_description",
  barcode: "barcode",
  sku: "barcode",
  towns: "towns",
  town: "towns",
  is_active: "is_active",
  active: "is_active",
};

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/** RFC4180-ish CSV parse (handles quotes, commas, CRLF). */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;

  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function rowsToCsv(headers: string[], dataRows: string[][]): string {
  const lines = [
    headers.map(csvEscape).join(","),
    ...dataRows.map((r) => r.map((c) => csvEscape(c ?? "")).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function buildProductImportTemplateCsv(categories: Category[]): string {
  const sampleSlug =
    categories.find((c) => c.slug === "phones")?.slug ||
    categories.find((c) => c.parent_id)?.slug ||
    categories[0]?.slug ||
    "electronics";
  const sampleSlug2 =
    categories.find((c) => c.slug === "farm-tools")?.slug || sampleSlug;

  const examples: string[][] = [
    [
      "Samsung A15 128GB",
      sampleSlug,
      "18500",
      "12",
      "Entry smartphone with long battery life",
      "6.5 inch display, dual SIM, ideal for Homabay and Mbita customers.",
      "",
      "Homabay|Mbita",
      "yes",
    ],
    [
      "Jembe garden hoe",
      sampleSlug2,
      "450",
      "40",
      "Heavy-duty farm jembe",
      "Steel blade with wooden handle. Local delivery available.",
      "",
      "Homabay|Mbita|Migori",
      "yes",
    ],
  ];

  return rowsToCsv([...PRODUCT_IMPORT_COLUMNS], examples);
}

export function buildCategoryReferenceCsv(categories: Category[]): string {
  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const rows = sorted.map((c) => {
    const parent = categories.find((p) => p.id === c.parent_id);
    return [c.slug, c.name, parent?.name ?? "", c.id];
  });
  return rowsToCsv(["category_slug", "category_name", "parent_category", "category_id"], rows);
}

/** Minimal SpreadsheetML .xls that Excel opens natively (no extra libraries). */
export function buildProductImportTemplateXls(categories: Category[]): string {
  const csv = buildProductImportTemplateCsv(categories);
  const table = parseCsv(csv);
  const cells = (row: string[]) =>
    row
      .map(
        (c) =>
          `<Cell><Data ss:Type="String">${escapeXml(c)}</Data></Cell>`,
      )
      .join("");
  const xmlRows = table
    .map((r) => `<Row>${cells(r)}</Row>`)
    .join("\n");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Products">
  <Table>
${xmlRows}
  </Table>
 </Worksheet>
</Workbook>
`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseTowns(raw: string): Town[] {
  const parts = raw
    .split(/[|;,/]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const allowed = new Set<string>(TOWNS);
  const towns = parts.filter((t): t is Town => allowed.has(t));
  return towns.length > 0 ? towns : ["Homabay"];
}

function parseActive(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (!v) return true;
  if (["no", "n", "false", "0", "inactive", "off"].includes(v)) return false;
  return true;
}

function resolveCategoryId(
  value: string,
  categories: Category[],
): string | null {
  const v = value.trim();
  if (!v) return null;
  const byId = categories.find((c) => c.id === v);
  if (byId) return byId.id;
  const slug = normalizeHeader(v).replace(/&/g, "").replace(/_+/g, "-");
  const bySlug = categories.find(
    (c) => c.slug === v || c.slug === slug || c.slug === slugify(v),
  );
  if (bySlug) return bySlug.id;
  const byName = categories.find(
    (c) => c.name.toLowerCase() === v.toLowerCase(),
  );
  return byName?.id ?? null;
}

export function mapGridToImportRows(
  grid: string[][],
  categories: Category[],
): ProductImportParseResult {
  if (grid.length === 0) {
    return { rows: [], issues: [{ rowNumber: 1, message: "File is empty" }] };
  }

  const headerCells = grid[0].map(normalizeHeader);
  const colIndex = new Map<ProductImportColumn, number>();
  headerCells.forEach((h, idx) => {
    const key = HEADER_ALIASES[h];
    if (key && !colIndex.has(key)) colIndex.set(key, idx);
  });

  const issues: ProductImportIssue[] = [];
  if (!colIndex.has("name") || !colIndex.has("category_slug") || !colIndex.has("price_kes")) {
    issues.push({
      rowNumber: 1,
      message:
        "Missing required columns. Need at least: name, category_slug, price_kes (download the template).",
    });
    return { rows: [], issues };
  }

  const rows: ProductImportRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const line = grid[r];
    const rowNumber = r + 1;
    const get = (col: ProductImportColumn) => {
      const idx = colIndex.get(col);
      return idx == null ? "" : String(line[idx] ?? "").trim();
    };

    const name = get("name");
    if (!name) {
      // skip blank template spacer rows
      if (line.every((c) => !String(c ?? "").trim())) continue;
      issues.push({ rowNumber, message: "name is required" });
      continue;
    }

    const categoryRaw = get("category_slug");
    const category_id = resolveCategoryId(categoryRaw, categories);
    if (!category_id) {
      issues.push({
        rowNumber,
        message: `Unknown category "${categoryRaw}". Use a slug from the category reference file.`,
      });
      continue;
    }

    const priceRaw = get("price_kes").replace(/,/g, "");
    const price_kes = Number(priceRaw);
    if (!Number.isFinite(price_kes) || price_kes < 0) {
      issues.push({ rowNumber, message: `Invalid price_kes "${get("price_kes")}"` });
      continue;
    }

    const stockRaw = get("stock") || "0";
    const stock = Number(stockRaw.replace(/,/g, ""));
    if (!Number.isFinite(stock) || stock < 0) {
      issues.push({ rowNumber, message: `Invalid stock "${get("stock")}"` });
      continue;
    }

    const short_description = get("short_description");
    const detailed_description = get("detailed_description") || short_description;
    const barcode = get("barcode") || null;

    // Re-resolve slug for storage path — store category_slug from category
    const cat = categories.find((c) => c.id === category_id)!;

    rows.push({
      name,
      category_slug: cat.slug,
      price_kes: Math.round(price_kes),
      stock: Math.round(stock),
      short_description,
      detailed_description,
      barcode,
      towns: parseTowns(get("towns")),
      is_active: parseActive(get("is_active")),
      rowNumber,
    });
  }

  return { rows, issues };
}

export function importRowToProductInput(
  row: ProductImportRow,
  categories: Category[],
  supplierId: string,
): Partial<Product> & { name: string; category_id: string; price_kes: number } {
  const category_id = resolveCategoryId(row.category_slug, categories)!;
  return {
    name: row.name,
    category_id,
    supplier_id: supplierId,
    price_kes: row.price_kes,
    stock: row.stock,
    short_description: row.short_description,
    detailed_description: row.detailed_description || row.short_description,
    barcode: row.barcode,
    towns: row.towns,
    is_active: row.is_active,
    slug: slugify(row.name),
  };
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Read uploaded CSV or Excel SpreadsheetML (.xls). */
export async function readImportFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  const text = await file.text();

  if (name.endsWith(".xlsx")) {
    throw new Error(
      "Please save the Excel file as CSV (File → Save As → CSV UTF-8) or download our .xls template, then upload that. Native .xlsx needs no extra setup with CSV.",
    );
  }

  if (name.endsWith(".xls") && text.includes("urn:schemas-microsoft-com:office:spreadsheet")) {
    return parseSpreadsheetMl(text);
  }

  return parseCsv(text);
}

function parseSpreadsheetMl(xml: string): string[][] {
  const rowMatches = xml.match(/<Row[\s\S]*?<\/Row>/gi) ?? [];
  return rowMatches.map((rowXml) => {
    const dataMatches = [...rowXml.matchAll(/<Data[^>]*>([\s\S]*?)<\/Data>/gi)];
    return dataMatches.map((m) =>
      m[1]
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .trim(),
    );
  });
}
