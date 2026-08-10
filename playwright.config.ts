import { defineConfig, devices } from '@playwright/test';
import { ConfigReader } from './src/config/ConfigReader';

const envConfig = ConfigReader.get();

/**
 * Central run configuration. Plays the role testng.xml + the Maven
 * surefire block play in the Selenium suite: everything here is
 * driven by ConfigReader (env-specific), never hardcoded, so the same
 * suite runs unchanged against qa/staging/prod via `ENV=<env>`.
 */
export default defineConfig({

    testDir: './tests',
    timeout: 60_000,
    expect: {
        timeout: envConfig.actionTimeout,
    },

    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? envConfig.retries : 0,
    workers: envConfig.workers,

    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['junit', { outputFile: 'reports/junit-results.xml' }],
        ['./src/reporters/FeeDiscrepancyReporter.ts'],
    ],

    use: {
        baseURL: envConfig.baseUrl,
        actionTimeout: envConfig.actionTimeout,
        navigationTimeout: envConfig.navigationTimeout,
        headless: envConfig.headless,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        }
        /*{
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },*/
    ],

});
