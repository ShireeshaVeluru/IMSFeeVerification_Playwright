# IMS Program Fee Verification — Playwright + TypeScript

Automated verification that the fee displayed on any IMS program page matches
the expected fee, for the entire program catalog. This is a TypeScript/Playwright
re-implementation of an existing Selenium/Java/TestNG suite, keeping the same
architectural decisions and translating each one to its Playwright-native
equivalent.

## Why this design

The brief for a "robust, scalable" suite really has one central constraint:
**the program catalog will grow, and the DOM structure will change.** Every
decision below optimizes for those two facts.

### 1. Page Object Model — one `ProgramPage`, not one page object per program

`SimCAT Max`, `SimCAT Core`, and every future program render the same "Select
Batch" card layout. Modeling each program as its own page object would mean
copy-pasting the same locators N times and updating all N when IMS tweaks a
class name. Instead, `ProgramPage` (`src/pages/ProgramPage.ts`) is generic:
the **program is just a URL**, supplied as data. Adding SimCAT Plus next
month is a spreadsheet row, not a new class.

```
open(programUrlPath) → getBatchDetails(batchName) → BatchDetails
```

### 2. Data-driven tests, not one method per program/batch

`FeeData.xlsx` (`src/data/FeeData.xlsx`) is the single source of truth for
*which* programs and batches to check and *what* fee is expected.
`FeeDataProvider.getFeeData()` reads it once at test-collection time and the
spec file (`tests/feeVerification.spec.ts`) fans the rows out into one
independent `test()` per (Program, Batch) pair — Playwright's direct
equivalent of a TestNG `@DataProvider`-backed `@Test`. Because each row
becomes its own Playwright test, they run in **parallel across workers** and
a failure in one batch never blocks the others from reporting.

Read the sheet **synchronously** (`xlsx`/SheetJS, not `exceljs`): Playwright
collects every `test()` call before running anything, so the rows must exist
at `require()`-time, not behind a `Promise`.

### 3. Fixture-based lifecycle instead of a base class

Selenium/TestNG needs `BaseTest` to own explicit `@BeforeMethod`/
`@AfterMethod` browser lifecycle. Playwright's test runner already owns
browser/page lifecycle per test, so the equivalent surface area is much
smaller: `src/fixtures/pageFixtures.ts` extends the base `test` with a single
`programPage` fixture, so every spec gets an already-constructed
`ProgramPage` bound to that test's isolated `page` — no manual driver
creation, no manual quit/teardown, no shared mutable state between tests
(the #1 source of flake in the old `ThreadLocal<WebDriver>` pattern, solved
here for free by Playwright's per-test browser context).

### 4. Environment config isolated from code

`ConfigReader` (`src/config/ConfigReader.ts`) resolves `config/config.{env}.json`
based on an `ENV` variable (default `qa`), exactly mirroring
`config-{env}.properties` + `-Denv=` in the Java suite:

```bash
ENV=qa npx playwright test        # default
ENV=staging npx playwright test
ENV=prod npx playwright test
```

No test or page object ever hardcodes a URL, timeout, or browser — they all
come from `ConfigReader`, so promoting the suite from QA to staging to prod
is a flag, not a code change.

### 5. Reporting: engineer-facing vs. stakeholder-facing

Two reporters run side by side (`playwright.config.ts`):

- **Built-in Playwright HTML reporter** — traces, screenshots, videos,
  step-by-step timeline. For the automation engineer debugging a failure.
- **`FeeDiscrepancyReporter`** (`src/reporters/FeeDiscrepancyReporter.ts`) —
  a custom reporter that plays the role `TestListener` + `ExtentReports`
  play in the Java suite. It inspects each test's attached
  expected-vs-displayed fee comparison and buckets every failure into
  **"Fee Discrepancy"** (assertion failed, page rendered fine — a genuine
  pricing issue for the product team) vs. **"Automation Defect"** (locator
  broke, timeout, navigation failure — a framework/environment issue for the
  QA team), then renders a single HTML page that leads with the discrepancy
  table. See `docs/sample-execution-report.html` for a rendered example, and
  `docs/TestStrategyDocument.docx` for how this maps to stakeholder
  communication.

### 6. Resilient locators, not brittle exact-match strings

`ProgramPage.getBatchDetails()` strips currency symbols/separators from the
fee text and uses a tolerant regex for the GST label (`+ GST (18%):` vs.
`+GST(18%) :`) instead of matching one exact string — carried over directly
from the Java `ProgramPage`, because these are the two spots most likely to
drift as content editors touch copy without touching structure.

## Project layout

```
config/                     env-specific JSON (qa/staging/prod)
src/
  config/ConfigReader.ts     resolves config/config.{ENV}.json
  constants/                 central path constants
  pages/ProgramPage.ts        the one POM for every program page
  models/BatchDetails.ts       plain data holder for a scraped batch card
  data/FeeData.xlsx            test data — programs, batches, expected fees
  data/FeeDataProvider.ts      reads FeeData.xlsx into test rows
  utils/ExcelUtility.ts         sync spreadsheet reader
  utils/Logger.ts               console logging
  fixtures/pageFixtures.ts      injects a ready ProgramPage into every test
  reporters/FeeDiscrepancyReporter.ts   stakeholder HTML report
tests/
  feeVerification.spec.ts       the data-driven spec
.github/workflows/fee-verification.yml   CI/CD (GitHub Actions)
Jenkinsfile                               CI/CD (Jenkins alternative)
docs/
  TestStrategyDocument.docx      2-page strategy document
  sample-execution-report.html   rendered sample of the stakeholder report
```

## Running locally

```bash
npm ci
npx playwright install --with-deps

npm run test:qa          # ENV=qa (default)
npm run test:staging     # ENV=staging
npx playwright test --project=firefox
npm run report           # open the last HTML report
```

## Mapping from the Selenium/Java suite

| Java (Selenium/TestNG)                     | TypeScript (Playwright)                    |
|---------------------------------------------|---------------------------------------------|
| `BaseTest` (`@BeforeMethod`/`@AfterMethod`) | `pageFixtures.ts` (`programPage` fixture)   |
| `BrowserFactory` / `DriverFactory`          | Playwright's built-in browser/context mgmt  |
| `ConfigReader` + `config-{env}.properties`  | `ConfigReader.ts` + `config.{env}.json`     |
| `FrameworkConstants`                        | `FrameworkConstants.ts`                     |
| `ProgramPage` / `BatchDetails`               | `ProgramPage.ts` / `BatchDetails.ts`        |
| `FeeDataProvider` (`@DataProvider`)          | `FeeDataProvider.ts` (`getFeeData()`)       |
| `ExcelUtility` (Apache POI)                  | `ExcelUtility.ts` (SheetJS)                 |
| `TestListener` + `ExtentReports`             | `FeeDiscrepancyReporter.ts` + built-in HTML |
| `LoggerUtility` (log4j2)                     | `Logger.ts`                                 |
| `testng.xml` / Maven Surefire                | `playwright.config.ts`                      |
