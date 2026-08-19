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

test("resizes and fully collapses desktop ontology side panels", async ({
  page,
}) => {
  await seedSelectedOntology(page, LOAN_ONTOLOGY_PATH);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ontology Explorer" }),
  ).toBeVisible();

  const workspace = page.locator(".ontology-workspace");
  const filters = page.locator(".ontology-filters");
  const details = page.locator(".ontology-detail");
  const canvas = page.locator(".ontology-canvas-wrap");
  const initialCanvasWidth = (await canvas.boundingBox())?.width ?? 0;

  await page.getByRole("button", { name: "Collapse filters panel" }).click();
  await expect(workspace).toHaveClass(/ontology-workspace--filters-collapsed/);
  await expect(filters).not.toBeVisible();
  expect((await canvas.boundingBox())?.width ?? 0).toBeGreaterThan(initialCanvasWidth);

  await page.getByRole("button", { name: "Expand filters panel" }).click();
  await expect(filters).toBeVisible();
  const filterWidthBeforeDrag = (await filters.boundingBox())?.width ?? 0;
  const leftSplitter = page.getByRole("separator", { name: "Resize filters panel" });
  const splitterBox = await leftSplitter.boundingBox();
  if (!splitterBox) throw new Error("Filters splitter is not visible");
  const splitterX = splitterBox.x + splitterBox.width / 2;
  const splitterY = splitterBox.y + 24;
  await page.mouse.move(splitterX, splitterY);
  await page.mouse.down();
  await page.mouse.move(splitterX + 80, splitterY, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await filters.boundingBox())?.width ?? 0)
    .toBeGreaterThan(filterWidthBeforeDrag + 40);

  const workspaceBox = await workspace.boundingBox();
  const expandedSplitterBox = await leftSplitter.boundingBox();
  if (!workspaceBox || !expandedSplitterBox) {
    throw new Error("Ontology workspace is not measurable");
  }
  const expandedSplitterX = expandedSplitterBox.x + expandedSplitterBox.width / 2;
  await page.mouse.move(expandedSplitterX, splitterY);
  await page.mouse.down();
  await page.mouse.move(workspaceBox.x + 40, splitterY, { steps: 6 });
  await page.mouse.up();
  await expect(workspace).toHaveClass(/ontology-workspace--filters-collapsed/);
  await expect(filters).not.toBeVisible();

  const collapsedSplitterBox = await leftSplitter.boundingBox();
  if (!collapsedSplitterBox) throw new Error("Collapsed filters splitter is not visible");
  const collapsedSplitterX = collapsedSplitterBox.x + collapsedSplitterBox.width / 2;
  await page.mouse.move(collapsedSplitterX, splitterY);
  await page.mouse.down();
  await page.mouse.move(workspaceBox.x + 240, splitterY, { steps: 6 });
  await page.mouse.up();
  await expect(filters).toBeVisible();
  await expect.poll(async () => (await filters.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(180);

  await page.getByRole("button", { name: "Collapse details panel" }).click();
  await expect(workspace).toHaveClass(/ontology-workspace--detail-collapsed/);
  await expect(details).not.toBeVisible();
  await page.getByRole("button", { name: "Expand details panel" }).click();
  await expect(details).toBeVisible();

  const rightSplitter = page.getByRole("separator", { name: "Resize details panel" });
  const rightSplitterBox = await rightSplitter.boundingBox();
  if (!rightSplitterBox) throw new Error("Details splitter is not visible");
  const rightSplitterY = rightSplitterBox.y + 24;
  const rightSplitterX = rightSplitterBox.x + rightSplitterBox.width / 2;
  await page.mouse.move(rightSplitterX, rightSplitterY);
  await page.mouse.down();
  await page.mouse.move(workspaceBox.x + workspaceBox.width - 40, rightSplitterY, {
    steps: 6,
  });
  await page.mouse.up();
  await expect(workspace).toHaveClass(/ontology-workspace--detail-collapsed/);
  await expect(details).not.toBeVisible();

  const collapsedRightSplitterBox = await rightSplitter.boundingBox();
  if (!collapsedRightSplitterBox) {
    throw new Error("Collapsed details splitter is not visible");
  }
  const collapsedRightSplitterX =
    collapsedRightSplitterBox.x + collapsedRightSplitterBox.width / 2;
  await page.mouse.move(collapsedRightSplitterX, rightSplitterY);
  await page.mouse.down();
  await page.mouse.move(workspaceBox.x + workspaceBox.width - 260, rightSplitterY, {
    steps: 6,
  });
  await page.mouse.up();
  await expect(details).toBeVisible();
  await expect.poll(async () => (await details.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(220);

  await rightSplitter.press("Home");
  await expect(workspace).toHaveClass(/ontology-workspace--detail-collapsed/);
  await rightSplitter.press("ArrowLeft");
  await expect(details).toBeVisible();
});
