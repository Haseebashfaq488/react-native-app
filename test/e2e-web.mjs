/**
 * Browser E2E test for SupportSync (Expo web) against the live FastAPI backend.
 * Flow: register → Home → ticket detail → Stats → Chat → create ticket → Profile → logout → login.
 * Run: node test/e2e-web.mjs   (requires playwright + chromium installed)
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:8081";
const SHOTS = "test-artifacts";
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0;
function report(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`);
  if (!ok) failures++;
}

const stamp = Date.now().toString().slice(-7);
const EMAIL = `e2e.${stamp}@novaware.dev`;
const PASSWORD = "e2e-test-123";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 900 } });
const logs = [];
page.on("console", (m) => logs.push(m.text()));
page.on("pageerror", (e) => logs.push(`PAGEERROR: ${e.message}`));

// -------------------------------------------------- 1. register (auth gate)
try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=Sign in to manage your tickets.", {
    timeout: 90000,
  });
  report("No session -> redirected to Sign In", true);

  await page.click("text=Create Account");
  await page.waitForSelector("text=Get started with SupportSync.", { timeout: 30000 });
  report("Sign Up screen", true);

  await page.getByPlaceholder("John Doe", { exact: true }).fill("E2E User");
  await page.getByPlaceholder("name@company.com", { exact: true }).fill(EMAIL);
  await page.getByPlaceholder("At least 6 characters", { exact: true }).fill(PASSWORD);
  await page.screenshot({ path: `${SHOTS}/1-signup.png` });

  const [regResp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/auth/register") && r.request().method() === "POST",
      { timeout: 60000 }
    ),
    page.click("text=Create Account"),
  ]);
  report(
    "Register creates Supabase Auth user",
    regResp.ok(),
    `status ${regResp.status()}`
  );
  await page.waitForSelector("text=Active Tickets", { timeout: 60000 });
  report("Registered -> landed on Home", true);
} catch (e) {
  report("Register flow", false, String(e).slice(0, 300));
  console.log("CONSOLE LOGS:", logs.slice(-15).join("\n"));
  await browser.close();
  process.exit(1);
}

// ------------------------------------------- 2. home + ticket detail + stats
try {
  await page.waitForSelector("text=#TCK-", { timeout: 30000 });
  report("Home dashboard shows ticket cards from backend", true);
  await page.screenshot({ path: `${SHOTS}/2-home.png` });

  await page.click("text=#TCK-", { timeout: 15000 });
  await page.waitForSelector("text=AI analysis", { timeout: 30000 });
  report("Ticket detail (AI analysis + activity)", true);
  await page.screenshot({ path: `${SHOTS}/3-ticket-detail.png` });
  await page.goBack();
  await page.waitForSelector("text=Active Tickets", { timeout: 30000 });

  await page.click("text=\"Stats\"", { timeout: 15000 });
  await page.waitForSelector("text=All Tickets", { timeout: 30000 });
  report("Stats screen renders", true);
  await page.screenshot({ path: `${SHOTS}/4-stats.png` });
} catch (e) {
  report("Home/detail/stats", false, String(e).slice(0, 300));
}

// ----------------------------------------------------------------- 3. chat
try {
  await page.click("text=\"Chat\"", { timeout: 15000 });
  await page.waitForSelector("text=TODAY", { timeout: 30000 });
  report("Chat screen with welcome message", true);

  const [chatResp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/chat") && r.request().method() === "POST",
      { timeout: 180000 }
    ),
    (async () => {
      await page
        .getByPlaceholder("Type your message...", { exact: true })
        .fill("What plans do you offer?");
      await page.getByTestId("chat-send").click();
    })(),
  ]);
  const chatData = await chatResp.json();
  report(
    "Live chat round-trip (AI reply)",
    chatResp.ok() && !!chatData.reply,
    `reply: ${String(chatData.reply).slice(0, 60)} | ai_failed=${chatData.ai_failed}`
  );
  await page.waitForFunction(
    (t) => document.body.innerText.includes(t),
    String(chatData.reply).slice(0, 40),
    { timeout: 30000 }
  );
  report("AI reply rendered as a bubble", true);
  await page.screenshot({ path: `${SHOTS}/5-chat.png` });
} catch (e) {
  report("Live chat flow", false, String(e).slice(0, 300));
}

// ------------------------------------------------------ 4. create a ticket
let createdId = null;
try {
  await page.goto(`${BASE}/create-ticket`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector("text=Create Ticket", { timeout: 30000 });
  // Fields should be pre-filled from the session.
  const prefilled = await page.getByPlaceholder("John Doe", { exact: true }).inputValue();
  report("Create ticket prefilled from session", prefilled !== "", prefilled);

  await page.getByPlaceholder("Brief summary of the issue", { exact: true }).fill("E2E ticket after auth");
  await page
    .getByPlaceholder("Describe the issue in detail…", { exact: true })
    .fill("Created by the automated test after the auth + AI resilience work.");

  const [ticketResp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/tickets") && r.request().method() === "POST",
      { timeout: 180000 }
    ),
    page.click("text=Submit Ticket"),
  ]);
  const ticketData = await ticketResp.json();
  createdId = ticketData.ticket_id;
  report(
    "POST /api/tickets from the form",
    ticketResp.ok() && !!createdId,
    `ticket #${createdId}, ai_failed=${ticketData.ai_failed}`
  );
  await page.waitForSelector("text=created", { timeout: 60000 });
  report("AI analysis result screen shown", true);
  await page.screenshot({ path: `${SHOTS}/6-ticket-result.png` });

  await page.click("text=View ticket");
  await page.waitForSelector("text=AI analysis", { timeout: 30000 });
  report("View ticket -> detail renders", true);
} catch (e) {
  report("Create ticket flow", false, String(e).slice(0, 300));
}

// ------------------------------------------ 5. profile + logout + login
try {
  await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("text=E2E User", { timeout: 30000 });
  report("Profile shows signed-in user", true);
  await page.screenshot({ path: `${SHOTS}/7-profile.png` });

  await page.click("text=Log Out of SupportSync");
  await page.waitForSelector("text=Sign in to manage your tickets.", { timeout: 30000 });
  report("Log out -> Sign In screen", true);

  await page.getByPlaceholder("name@company.com", { exact: true }).fill(EMAIL);
  await page.getByPlaceholder("••••••••", { exact: true }).fill(PASSWORD);
  const [loginResp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/auth/login") && r.request().method() === "POST",
      { timeout: 60000 }
    ),
    page.click("text=\"Sign In\""),
  ]);
  report(
    "Login verifies against Supabase Auth",
    loginResp.ok(),
    `status ${loginResp.status()}`
  );
  await page.waitForSelector("text=Active Tickets", { timeout: 60000 });
  report("Logged back in -> Home", true);
  await page.screenshot({ path: `${SHOTS}/8-logged-in.png` });

  // Wrong password must be rejected.
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  // There's an active session, so force a fresh check via direct navigation;
  // header still allows visiting /login. Fill wrong creds.
  await page.getByPlaceholder("name@company.com", { exact: true }).fill(EMAIL);
  await page.getByPlaceholder("••••••••", { exact: true }).fill("wrong-password");
  const [badResp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/auth/login") && r.request().method() === "POST",
      { timeout: 60000 }
    ),
    page.click("text=\"Sign In\""),
  ]);
  report(
    "Wrong password -> 401",
    badResp.status() === 401,
    `status ${badResp.status()} (expected 401)`
  );
} catch (e) {
  report("Profile / logout / login flow", false, String(e).slice(0, 300));
}

const errors = logs.filter(
  (l) =>
    l.startsWith("PAGEERROR") &&
    !l.includes("dark mode is type 'media'") // known benign react-native-web warning
);
report(
  "No runtime page errors",
  errors.length === 0,
  errors.join(" | ").slice(0, 200)
);

await browser.close();
console.log(
  failures === 0
    ? `\n=== ALL E2E TESTS PASSED ===${createdId ? ` (created ticket #${createdId})` : ""} (user: ${EMAIL})`
    : `\n=== ${failures} TEST(S) FAILED === (user: ${EMAIL})`
);
process.exit(failures === 0 ? 0 : 1);