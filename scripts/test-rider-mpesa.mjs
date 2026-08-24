/**
 * E2E: rider M-Pesa door collection — enter phone → STK → paid → deliver → leave.
 * Requires: app at http://localhost:3000 (demo mode).
 */
import { chromium } from "playwright";

const BASE = process.env.AMG_BASE_URL || "http://localhost:3000";

async function login(page, email, password) {
  await page.goto(`${BASE}/auth/login?next=/rider`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(rider|admin|account|shop)/, { timeout: 15000 });
}

async function seedUnpaidDelivery(page) {
  // Seed an unpaid out-for-delivery order assigned to Brian (rider-1)
  await page.evaluate(() => {
    const KEY = "amg_orders_v7";
    const raw = localStorage.getItem(KEY);
    const orders = raw ? JSON.parse(raw) : [];
    const id = `ord-rider-mpesa-${Date.now()}`;
    const order = {
      id,
      user_id: "demo-customer",
      customer_name: "Test Mpesa Client",
      phone: "0712345678",
      email: "customer@amg.com",
      town: "Homabay",
      address: "Test stage near market",
      payment_method: "cod",
      mpesa_phone: null,
      paid: false,
      paid_at: null,
      subtotal_kes: 1500,
      discount_kes: 0,
      delivery_method: "doorstep",
      dropoff_point_id: null,
      dropoff_point_name: null,
      rider_id: "rider-1",
      rider_name_snapshot: "Brian Otieno",
      delivered_at: null,
      status: "out_for_delivery",
      total_kes: 1500,
      created_at: new Date().toISOString(),
      items: [
        {
          id: `${id}-item`,
          order_id: id,
          product_id: "prod-28",
          name_snapshot: "Cement 50kg Bag",
          price_kes: 750,
          qty: 2,
          supplier_id: "sup-3",
          supplier_name_snapshot: "Migori Hardware Hub",
        },
      ],
    };
    localStorage.setItem(KEY, JSON.stringify([order, ...orders]));
    return id;
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const log = [];
  const step = (m) => {
    log.push(m);
    console.log(m);
  };

  try {
    step("1. Login as rider brian@amg.com");
    await login(page, "brian@amg.com", "rider123");
    if (!page.url().includes("/rider")) {
      throw new Error(`Expected /rider, got ${page.url()}`);
    }
    step("   OK — on rider portal");

    step("2. Seed unpaid delivery under Brian");
    await seedUnpaidDelivery(page);
    await page.goto(`${BASE}/rider`);
    await page.waitForSelector("text=Test Mpesa Client", { timeout: 15000 });
    step("   OK — order visible");

    step("3. Confirm M-Pesa panel (phone + send push)");
    const phoneInput = page.locator('input[placeholder="07XXXXXXXX"]').first();
    await phoneInput.waitFor({ timeout: 5000 });
    await phoneInput.fill("0722111222");
    const sendBtn = page.getByRole("button", { name: /Send M-Pesa push/i }).first();
    await sendBtn.waitFor({ timeout: 5000 });
    step("   OK — M-Pesa panel active");

    step("4. Send M-Pesa push and wait for confirmation");
    await sendBtn.click();
    await page.waitForSelector("text=/M-Pesa .* confirmed|Payment registered|Mark delivered/i", {
      timeout: 20000,
    });
    step("   OK — payment confirmed");

    step("5. Mark delivered / leave");
    const leaveBtn = page.getByRole("button", { name: /Mark delivered/i }).first();
    await leaveBtn.click();
    await page.waitForSelector("text=/Delivered|payout sent|You may leave/i", {
      timeout: 15000,
    });
    step("   OK — delivered");

    console.log("\nPASS: rider M-Pesa door collection flow works.");
    process.exitCode = 0;
  } catch (err) {
    console.error("\nFAIL:", err instanceof Error ? err.message : err);
    console.error("Steps:", log.join(" → "));
    await page.screenshot({ path: "scripts/rider-mpesa-fail.png", fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
