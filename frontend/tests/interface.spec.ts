import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const student = "00123456789012345";
const schoolClass = {
  id: "c1",
  name: "Class 6 - Morning Shift",
  totalSeats: 3,
  heldSeats: 0,
  confirmedSeats: 0,
  availableSeats: 3,
};
const held = () => ({
  holdId: "h1",
  classId: "c1",
  status: "HELD",
  expiresAt: new Date(Date.now() + 600000).toISOString(),
});

async function identity(page: Page, id = student) {
  await page.getByLabel("Birth registration number", { exact: false }).fill(id);
  await page
    .getByRole("button", { name: /Set student ID|Change student/ })
    .click();
}

test("class form validates inputs and sends the agreed contract without student identity", async ({
  page,
}) => {
  let payload: unknown;
  await page.route("**/api/classes", async (route) => {
    if (route.request().method() === "POST") {
      payload = route.request().postDataJSON();
      expect(route.request().headers()["x-student-id"]).toBeUndefined();
      await route.fulfill({ status: 201, json: schoolClass });
    } else await route.fulfill({ json: [schoolClass] });
  });
  await page.goto("/classes/new");
  await page.getByRole("button", { name: "Create class", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "positive whole number of seats",
  );
  expect(payload).toBeUndefined();
  await page
    .getByLabel("Class name and shift")
    .fill("  Class 6 - Morning Shift  ");
  await page.getByLabel("Total seats", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Create class", exact: true }).click();
  await expect(page.getByRole("link", { name: "View class" })).toBeVisible();
  expect(payload).toEqual({ name: schoolClass.name, totalSeats: 3 });
});

test("identity validates 17 digits, keeps leading zero and isolates history after a switch", async ({
  page,
}) => {
  const seen: string[] = [];
  await page.route("**/api/classes", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/me/holds", (route) => {
    const id = route.request().headers()["x-student-id"];
    seen.push(id);
    return route.fulfill({
      json: id === student ? [{ ...held(), className: schoolClass.name }] : [],
    });
  });
  await page.goto("/me/holds");
  await identity(page, "123");
  await expect(page.getByRole("alert")).toContainText("17-digit");
  await identity(page, "001234567890123456");
  await expect(page.getByRole("alert")).toContainText("17-digit");
  await expect(
    page.getByLabel("Birth registration number", { exact: false }),
  ).toHaveValue("001234567890123456");
  expect(seen).toHaveLength(0);
  await identity(page);
  await expect(
    page.getByRole("cell", { name: schoolClass.name }),
  ).toBeVisible();
  expect(seen).toContain(student);
  await identity(page, "00123456789012346");
  await expect(
    page.getByRole("heading", { name: "No applications yet" }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: schoolClass.name })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(
    page.getByLabel("Birth registration number", { exact: false }),
  ).toHaveValue("00123456789012346");
});

test("duplicate conflict is explained and submitting twice does not send two holds", async ({
  page,
}) => {
  let attempts = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/classes/c1", (route) =>
    route.fulfill({ json: schoolClass }),
  );
  await page.route("**/api/classes/c1/holds", async (route) => {
    attempts++;
    expect(route.request().headers()["x-student-id"]).toBe(student);
    await gate;
    await route.fulfill({
      status: 409,
      json: {
        title:
          "You already have an active hold or confirmed admission in this class.",
      },
    });
  });
  await page.goto("/classes/c1");
  await identity(page);
  await page.getByRole("button", { name: "Apply now", exact: true }).click();
  await expect(page.getByRole("button", { name: "Applying…" })).toBeDisabled();
  await expect(
    page.getByLabel("Birth registration number", { exact: false }),
  ).toBeDisabled();
  release();
  await expect(page.getByRole("alert")).toContainText("active application");
  expect(attempts).toBe(1);
});

for (const cancel of [false, true]) {
  test(
    cancel
      ? "cancellation accepts empty 204 and removes actions"
      : "confirmation renders success and removes payment actions",
    async ({ page }) => {
      let hold = held();
      let writes = 0;
      await page.route("**/api/classes/c1", (route) =>
        route.fulfill({ json: schoolClass }),
      );
      await page.route("**/api/me/holds", (route) =>
        route.fulfill({ json: [{ ...hold, className: schoolClass.name }] }),
      );
      await page.route("**/api/holds/h1**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: hold });
          return;
        }
        writes++;
        expect(route.request().headers()["x-student-id"]).toBe(student);
        expect(route.request().method()).toBe(cancel ? "DELETE" : "POST");
        hold = { ...hold, status: cancel ? "CANCELLED" : "CONFIRMED" };
        await route.fulfill(
          cancel
            ? { status: 204 }
            : { json: { holdId: "h1", status: hold.status } },
        );
      });
      await page.goto("/applications/h1");
      await identity(page);
      if (cancel) {
        await page
          .getByRole("button", { name: "Cancel application", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Yes, cancel application", exact: true })
          .click();
      } else
        await page
          .getByRole("button", { name: "Pay admission fee", exact: true })
          .click();
      await expect(
        page.getByRole("heading", {
          name: cancel
            ? "Application cancelled"
            : "Your admission is confirmed",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Pay admission fee", exact: true }),
      ).toHaveCount(0);
      expect(writes).toBe(1);
    },
  );
}

test("countdown reaches zero but final expiry comes from the server", async ({
  page,
}) => {
  await page.clock.install();
  let hold = held();
  let reads = 0;
  await page.route("**/api/classes/c1", (route) =>
    route.fulfill({ json: schoolClass }),
  );
  await page.route("**/api/me/holds", (route) =>
    route.fulfill({ json: [{ ...hold, className: schoolClass.name }] }),
  );
  await page.route("**/api/holds/h1", (route) => {
    reads++;
    return route.fulfill({ json: hold });
  });
  await page.goto("/applications/h1");
  await identity(page);
  await expect(page.getByRole("timer")).toContainText("10:00");
  await page.clock.fastForward(601000);
  await expect(page.getByRole("timer")).toHaveText("00:00");
  await expect(
    page.getByRole("heading", { name: "Application expired" }),
  ).toHaveCount(0);
  hold = { ...hold, status: "EXPIRED" };
  await page.clock.fastForward(5000);
  await expect(
    page.getByRole("heading", { name: "Application expired" }),
  ).toBeVisible();
  expect(reads).toBeGreaterThan(1);
});

test("network failures have a retry action and an empty list is explicit", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/classes", (route) =>
    fail ? route.abort() : route.fulfill({ json: [] }),
  );
  await page.goto("/classes");
  await expect(page.getByRole("alert")).toContainText(
    "Unable to reach the server",
  );
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "No classes yet" }),
  ).toBeVisible();
});

test("mobile layout stays within viewport and retains class actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/classes", (route) =>
    route.fulfill({ json: [schoolClass] }),
  );
  await page.goto("/classes");
  await expect(
    page.getByRole("heading", { name: "Classes & available seats" }),
  ).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    document: document.documentElement.scrollWidth,
    outside: [...document.querySelectorAll("*")]
      .filter((el) => el.getBoundingClientRect().right > innerWidth)
      .map(
        (el) =>
          `${el.tagName}.${el.className}: ${el.getBoundingClientRect().right}`,
      ),
  }));
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(
    dimensions.width,
  );
  await expect(
    page.getByRole("link", { name: "Apply now", exact: true }),
  ).toHaveAttribute("href", "/classes/c1");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Refresh availability" }),
  ).toBeFocused();
});

test("polling lets a slow request finish instead of repeatedly aborting it", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/classes", async (route) => {
    calls++;
    await gate;
    await route.fulfill({ json: [schoolClass] });
  });
  await page.goto("/classes");
  await expect.poll(() => calls).toBeGreaterThan(0);
  await page.clock.fastForward(10000);
  // Development StrictMode can replay the initial mount once; polling must not add more requests.
  expect(calls).toBeLessThanOrEqual(2);
  release();
  await expect(
    page.getByRole("cell", { name: schoolClass.name }),
  ).toBeVisible();
});
