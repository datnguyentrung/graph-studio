import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("loads the full graph and navigates between full and focus", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ontology Explorer" }),
  ).toBeVisible();
  const budget = page.locator(".ontology-graph-budget");
  await expect(budget.getByText("Full graph", { exact: true })).toBeVisible();
  await expect(budget).toContainText("3342");
  await expect(budget).toContainText("/ 3342 nodes");
  await expect(budget).toContainText("4929");
  await expect(budget).toContainText("/ 4929 edges");

  await page.getByRole("searchbox", { name: "Search concepts" }).fill(
    "ACTUS business day convention",
  );
  await page.locator(".ontology-search__results button").first().click();
  await expect(budget.getByText("Focus", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to full graph" }).click();
  await expect(budget.getByText("Full graph", { exact: true })).toBeVisible();
});

test("meets the automated accessibility floor", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ontology Explorer" }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
