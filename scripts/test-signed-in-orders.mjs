/**
 * E2E: signed-in add-to-cart prompt + two cumulative orders.
 * Requires: app running at http://localhost:3000 (demo mode).
 */
import { chromium } from "playwright";

const BASE = process.env.AMG_BASE_URL || "http://localhost:3000";

async function login(page) {
  await page.goto(`${BASE}/auth/login?next=/shop`);
  await page.fill('input[name="email"]', "customer@amg.com");
  await page.fill('input[name="password"]', "customer123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/shop/);
}

async function addProduct(page, slug) {
  await page.goto(`${BASE}/product/${slug}`);
  await page.getByRole("button", { name: "Add to cart" }).click();
}

async function placeCodOrder(page, address = "Test estate near AMG market") {
  await page.goto(`${BASE}/checkout`);
  await page.waitForSelector('button[type="submit"]');
  const addressField = page.locator('textarea[name="address"]');
  if (await addressField.count()) {
    await addressField.fill(address);
  }
  await page.getByRole("button", { name: /Place order/i }).click();
  await page.waitForURL(/\/order\/ord-/);
  const url = page.url();
  const id = url.split("/order/")[1]?.split(/[?#]/)[0];
  if (!id) throw new Error(`No order id in URL: ${url}`);
  return id;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const results = [];

  try {
    await login(page);
    await page.evaluate(() => localStorage.setItem("amg_cart", "[]"));

    // Baseline order count for demo-customer
    const baseline = await page.evaluate(() => {
      const raw = localStorage.getItem("amg_orders_v7");
      const orders = raw ? JSON.parse(raw) : [];
      return orders.filter((o) => o.user_id === "demo-customer").length;
    });
    results.push(`baseline orders for customer: ${baseline}`);

    // 1) Signed-in add → View cart / Continue shopping
    await addProduct(page, "wireless-mouse-keyboard");
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    const viewCart = dialog.getByRole("button", { name: "View cart" });
    const continueShopping = dialog.getByRole("button", { name: "Continue shopping" });
    if (!(await viewCart.isVisible())) throw new Error("Missing View cart button");
    if (!(await continueShopping.isVisible())) throw new Error("Missing Continue shopping button");
    results.push("PASS: signed-in add-to-cart shows View cart / Continue shopping");

    // Continue shopping → add same item again (cart qty cumulative)
    await continueShopping.click();
    await dialog.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Add to cart" }).click();
    await dialog.waitFor({ state: "visible" });
    const cartQty = await page.evaluate(() => {
      const cart = JSON.parse(localStorage.getItem("amg_cart") || "[]");
      return cart.reduce((s, i) => s + i.qty, 0);
    });
    if (cartQty !== 2) throw new Error(`Expected cart qty 2 after continue shopping, got ${cartQty}`);
    results.push("PASS: cart qty cumulative after continue shopping (qty=2)");

    // Place order 1 from cart (qty 2 of mouse/keyboard)
    await viewCart.click();
    await page.waitForURL(/\/cart/);
    const order1 = await placeCodOrder(page, "Order1 landmark Homabay");
    results.push(`order1: ${order1}`);

    // After place, cart should be empty
    const cartAfter1 = await page.evaluate(() => localStorage.getItem("amg_cart"));
    if (cartAfter1 && cartAfter1 !== "[]") {
      throw new Error(`Cart not cleared after order1: ${cartAfter1}`);
    }

    // 2) Second order — different product
    await addProduct(page, "samsung-a15");
    await page.getByRole("dialog").getByRole("button", { name: "View cart" }).click();
    await page.waitForURL(/\/cart/);
    const order2 = await placeCodOrder(page, "Order2 landmark Homabay");
    results.push(`order2: ${order2}`);

    if (order1 === order2) throw new Error("Orders should have distinct ids");

    // Cumulative order history
    const after = await page.evaluate(() => {
      const orders = JSON.parse(localStorage.getItem("amg_orders_v7") || "[]");
      const mine = orders.filter((o) => o.user_id === "demo-customer");
      return {
        count: mine.length,
        ids: mine.map((o) => o.id),
        totals: mine.map((o) => ({ id: o.id, total: o.total_kes })),
      };
    });

    if (!after.ids.includes(order1) || !after.ids.includes(order2)) {
      throw new Error(`Both new orders missing from history. Have: ${after.ids.slice(0, 8).join(", ")}`);
    }
    if (after.count < baseline + 2) {
      throw new Error(`Expected >= ${baseline + 2} orders, got ${after.count}`);
    }
    results.push(
      `PASS: orders cumulative — customer has ${after.count} orders (was ${baseline}); both ${order1} and ${order2} present`,
    );

    // UI: My orders lists both
    await page.goto(`${BASE}/account/orders`);
    await page.getByRole("heading", { name: "My orders" }).waitFor();
    const listText = await page.locator("ul").innerText();
    if (!listText.includes(order1.slice(0, 12)) || !listText.includes(order2.slice(0, 12))) {
      throw new Error("My orders page did not list both new order ids");
    }
    results.push("PASS: My orders UI lists both new orders");

    console.log(results.join("\n"));
    console.log("\nALL CHECKS PASSED");
  } catch (err) {
    console.error(results.join("\n"));
    console.error("\nFAILED:", err.message);
    await page.screenshot({ path: "scripts/test-signed-in-orders-failure.png", fullPage: true });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
