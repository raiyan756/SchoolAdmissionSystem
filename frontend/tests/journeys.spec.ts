import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

// Fresh synthetic identities let the suite run again against the same temporary database.
let nextStudent = BigInt(Date.now()) * 1000n;
const newStudent = () => String(++nextStudent).padStart(17, "0");

test.skip(
  !process.env.RUN_LIVE_TESTS,
  "Run through docker-compose.frontend-test.yml for an isolated real API/database.",
);

test.beforeAll(async ({ request }) => {
  await expect
    .poll(
      async () => {
        try {
          return (await request.get("/api/health")).status();
        } catch {
          return 0;
        }
      },
      { timeout: 60000 },
    )
    .toBe(200);
});

async function chooseStudent(page: Page, id: string) {
  await page.getByLabel("Birth registration number", { exact: false }).fill(id);
  await page
    .getByRole("button", { name: /Set student ID|Change student/ })
    .click();
}

async function createClass(page: Page, name: string, seats = 1) {
  await page.goto("/classes/new");
  await page.getByLabel("Class name and shift").fill(name);
  await page.getByLabel("Total seats", { exact: true }).fill(String(seats));
  await page.getByRole("button", { name: "Create class", exact: true }).click();
  await page.getByRole("link", { name: "View class" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  return page.url().split("/").at(-1)!;
}

test("real create, apply, confirm, reload and history isolation", async ({
  page,
  request,
}) => {
  const id = await createClass(page, `UI confirmation ${Date.now()}`);
  await chooseStudent(page, newStudent());
  await page.getByRole("button", { name: "Apply now", exact: true }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  const url = page.url();
  await page
    .getByRole("button", { name: "Pay admission fee", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your admission is confirmed" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your admission is confirmed" }),
  ).toBeVisible();
  expect(page.url()).toBe(url);
  expect(await (await request.get(`/api/classes/${id}`)).json()).toMatchObject({
    heldSeats: 0,
    confirmedSeats: 1,
    availableSeats: 0,
  });
  await page
    .getByRole("link", { name: "My applications", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Confirmed", exact: true }),
  ).toBeVisible();
  await chooseStudent(page, newStudent());
  await expect(
    page.getByRole("heading", { name: "No applications yet" }),
  ).toBeVisible();
});

test("real cancellation releases its seat and preserves history", async ({
  page,
  request,
}) => {
  const id = await createClass(page, `UI cancellation ${Date.now()}`);
  await chooseStudent(page, newStudent());
  await page.getByRole("button", { name: "Apply now", exact: true }).click();
  await page
    .getByRole("button", { name: "Cancel application", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Yes, cancel application", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Application cancelled" }),
  ).toBeVisible();
  expect(await (await request.get(`/api/classes/${id}`)).json()).toMatchObject({
    heldSeats: 0,
    confirmedSeats: 0,
    availableSeats: 1,
  });
  await page
    .getByRole("link", { name: "My applications", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Cancelled", exact: true }),
  ).toBeVisible();
});

test("real expiry updates the open application and frees the seat", async ({
  page,
  request,
}) => {
  const id = await createClass(page, `UI expiry ${Date.now()}`);
  await chooseStudent(page, newStudent());
  await page.getByRole("button", { name: "Apply now", exact: true }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Application expired" }),
  ).toBeVisible({ timeout: 25000 });
  await expect(
    page.getByRole("button", { name: "Pay admission fee", exact: true }),
  ).toHaveCount(0);
  expect(await (await request.get(`/api/classes/${id}`)).json()).toMatchObject({
    heldSeats: 0,
    confirmedSeats: 0,
    availableSeats: 1,
  });
});

test("two browser sessions compete for one seat and the losing UI explains the conflict", async ({
  page,
  browser,
  request,
}) => {
  const id = await createClass(page, `UI last seat ${Date.now()}`);
  const otherContext = await browser.newContext({
    baseURL: process.env.BASE_URL,
  });
  const other = await otherContext.newPage();
  try {
    await other.goto(`/classes/${id}`);
    await chooseStudent(page, newStudent());
    await chooseStudent(other, newStudent());
    await Promise.all([
      page.getByRole("button", { name: "Apply now", exact: true }).click(),
      other.getByRole("button", { name: "Apply now", exact: true }).click(),
    ]);
    await expect
      .poll(
        () =>
          [page.url(), other.url()].filter((url) =>
            url.includes("/applications/"),
          ).length,
      )
      .toBe(1);
    const loser = page.url().includes("/applications/") ? other : page;
    await expect(loser.getByRole("alert")).toContainText("no available seats");
    expect(
      await (await request.get(`/api/classes/${id}`)).json(),
    ).toMatchObject({ heldSeats: 1, confirmedSeats: 0, availableSeats: 0 });
  } finally {
    await otherContext.close();
  }
});
