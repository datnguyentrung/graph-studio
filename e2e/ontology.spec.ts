import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ONTOLOGY_STORAGE_KEY = "mermaid.ontology.selectedPath";
const LOAN_ONTOLOGY_PATH = "LOAN/all_loan.ontology.json";
const AGGREGATE_ONTOLOGY_PATH = "all.ontology.json";

async function seedSelectedOntology(page: Page, path: string) {
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: ONTOLOGY_STORAGE_KEY, value: path },
  );
}

async function selectOntology(page: Page, path: string) {
  await page.locator(".ontology-source-selector__trigger").click();

  const popup = page.getByRole("dialog", { name: "Ontology files" });
  await expect(popup).toBeVisible();

  const folderNames = path.split("/").slice(0, -1);
  for (const folderName of folderNames) {
    const folder = popup.getByRole("button", { name: folderName }).first();
    if (await folder.getAttribute("aria-expanded") !== "true") {
      await folder.click();
    }
  }

  await popup.locator(`button[title="${path}"]`).click();
  await expect(popup).toBeHidden();
  await expect(page.locator(`.ontology-source-selector__trigger[title="${path}"]`))
    .toBeVisible();
}

test("keeps normal sources full and uses progressive overview for the aggregate", async ({
  page,
}) => {
  await seedSelectedOntology(page, LOAN_ONTOLOGY_PATH);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ontology Explorer" }),
  ).toBeVisible();
  const budget = page.locator(".ontology-graph-budget");
  await expect(budget.getByText("Full graph", { exact: true })).toBeVisible();
  await expect(budget).toContainText("/ 275 nodes");
  await expect(budget).toContainText("/ 238 edges");

  await selectOntology(page, AGGREGATE_ONTOLOGY_PATH);
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

test("syncs ontology source with the URL param and browser history", async ({
  page,
}) => {
  await page.goto(`/ontology?source=${encodeURIComponent(LOAN_ONTOLOGY_PATH)}`);
  await expect(
    page.getByRole("heading", { name: "Ontology Explorer" }),
  ).toBeVisible();
  await expect(page.locator(
    `.ontology-source-selector__trigger[title="${LOAN_ONTOLOGY_PATH}"]`,
  )).toBeVisible();

  await selectOntology(page, AGGREGATE_ONTOLOGY_PATH);
  await expect(page).toHaveURL(
    new RegExp(`source=${encodeURIComponent(AGGREGATE_ONTOLOGY_PATH)}`),
  );

  await page.goBack();
  await expect(page).toHaveURL(
    new RegExp(`source=${encodeURIComponent(LOAN_ONTOLOGY_PATH)}`),
  );
  await expect(page.locator(
    `.ontology-source-selector__trigger[title="${LOAN_ONTOLOGY_PATH}"]`,
  )).toBeVisible();
});

test("expands the selected progressive class with keyboard and double-click", async ({
  page,
}) => {
  await page.goto("/");
  const budget = page.locator(".ontology-graph-budget");
  await selectOntology(page, LOAN_ONTOLOGY_PATH);
  await selectOntology(page, AGGREGATE_ONTOLOGY_PATH);
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
