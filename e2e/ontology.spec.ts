import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("keeps normal sources full and uses progressive overview for the aggregate", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ontology Explorer" }),
  ).toBeVisible();
  const budget = page.locator(".ontology-graph-budget");
  await expect(budget.getByText("Full graph", { exact: true })).toBeVisible();
  await expect(budget).toContainText("/ 275 nodes");
  await expect(budget).toContainText("/ 238 edges");

  await page.locator('button[title="LOAN/all_loan.ontology.json"]').click();
  await page.locator('button[title="all.ontology.json"]').click();
  await expect(budget.getByText("Overview", { exact: true })).toBeVisible();
  await expect(budget).toContainText("/ 3342 nodes");
  await expect(budget).toContainText("/ 4929 edges");

  await page.getByRole("searchbox", { name: "Search concepts" }).fill(
    "ACTUS business day convention",
  );
  await page.locator(".ontology-search__results button").first().click();
  await expect(budget.getByText("Hierarchy", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to overview" }).click();
  await expect(budget.getByText("Overview", { exact: true })).toBeVisible();
});

test("expands the selected progressive class with keyboard and double-click", async ({
  page,
}) => {
  await page.goto("/");
  const budget = page.locator(".ontology-graph-budget");
  await page.locator('button[title="LOAN/all_loan.ontology.json"]').click();
  await page.locator('button[title="all.ontology.json"]').click();
  await expect(budget.getByText("Overview", { exact: true })).toBeVisible();

  await page.getByRole("searchbox", { name: "Search concepts" }).fill(
    "fibo-loan-ln-ln:Loan",
  );
  await page.locator(".ontology-search__results button").first().click();
  await expect(budget.getByText("Hierarchy", { exact: true })).toBeVisible();

  const visibleNodeCount = async () => Number(
    await budget.locator(".ontology-graph-budget__counts > span").first().locator("strong").textContent(),
  );
  const canvas = page.locator(".ontology-canvas");
  const collapsedCount = await visibleNodeCount();

  await canvas.press("Enter");
  await expect.poll(visibleNodeCount).toBeGreaterThan(collapsedCount);
  const expandedCount = await visibleNodeCount();

  await canvas.press("Space");
  await expect.poll(visibleNodeCount).toBeLessThan(expandedCount);

  await page.getByRole("button", { name: "Center", exact: true }).click();
  await canvas.click();
  await page.waitForTimeout(50);
  await canvas.click();
  await expect.poll(visibleNodeCount).toBeGreaterThan(collapsedCount);
});

test("meets the automated accessibility floor", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ontology Explorer" }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
