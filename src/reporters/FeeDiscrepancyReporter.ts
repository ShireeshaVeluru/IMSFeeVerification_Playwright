import type {
    Reporter,
    TestCase,
    TestResult,
    FullResult,
} from '@playwright/test/reporter';

import fs from 'fs';
import path from 'path';

import { FrameworkConstants } from '../constants/FrameworkConstants';

interface FeeComparison {
    program: string;
    batch: string;
    expectedFee: string;
    displayedFee: string;
    gst?: string;
    startDate?: string;
    batchType?: string;
}

interface ReportRow {
    title: string;
    status: TestResult['status'];
    durationMs: number;
    category:
        | 'Passed'
        | 'Fee Discrepancy'
        | 'Automation Defect'
        | 'Skipped';

    comparison?: FeeComparison;
    errorMessage?: string;
    screenshotPath?: string;
}

/**
 * Custom Playwright reporter for IMS Fee Verification.
 *
 * Responsibilities:
 *
 * 1. Collect test execution results.
 * 2. Identify Fee Discrepancies separately from Automation Defects.
 * 3. Display expected and displayed fees.
 * 4. Attach failure screenshots to the report.
 * 5. Generate one stakeholder-friendly HTML report.
 *
 * The report is regenerated after every execution.
 */
export default class FeeDiscrepancyReporter implements Reporter {

    private rows: ReportRow[] = [];

    /**
     * Called by Playwright after every test finishes.
     */
    onTestEnd(
        test: TestCase,
        result: TestResult
    ): void {

        // ---------------------------------------------------------
        // Get fee comparison attachment
        // ---------------------------------------------------------

        const attachment = result.attachments.find(
            a => a.name === 'fee-comparison'
        );

        let comparison: FeeComparison | undefined;

        if (attachment?.body) {

            try {

                comparison = JSON.parse(
                    attachment.body.toString()
                );

            } catch {

                comparison = undefined;
            }
        }

        // ---------------------------------------------------------
        // Find screenshot attachment
        // ---------------------------------------------------------

        const screenshot = result.attachments.find(
            a => a.contentType === 'image/png'
        );

        // ---------------------------------------------------------
        // Determine test category
        // ---------------------------------------------------------

        let category: ReportRow['category'] = 'Passed';

        if (result.status === 'passed') {

            category = 'Passed';

        } else if (result.status === 'skipped') {

            category = 'Skipped';

        } else {

            /*
             * If fee comparison exists and expected/displayed
             * values are different, it is a genuine product
             * fee discrepancy.
             *
             * Otherwise it is considered an automation defect.
             */

            const isAssertionFailure =
                result.error?.message?.includes('Fee mismatch') ||
                (
                    comparison &&
                    comparison.expectedFee !==
                        comparison.displayedFee
                );

            category = isAssertionFailure
                ? 'Fee Discrepancy'
                : 'Automation Defect';
        }

        // ---------------------------------------------------------
        // Clean test title
        // ---------------------------------------------------------

        /*
         * Original title:
         *
         * [SimCAT Max 2025] IMS Batch 1
         * — displayed fee matches expected fee
         *
         * Required title:
         *
         * [SimCAT Max 2025] IMS Batch 1
         */

        const cleanTitle = test.title
            .split('—')[0]
            .trim();

        // ---------------------------------------------------------
        // Create clean error/detail message
        // ---------------------------------------------------------

        let cleanErrorMessage = '';

        if (
            category === 'Fee Discrepancy' &&
            comparison
        ) {

            /*
             * Do NOT display the raw Playwright assertion.
             *
             * Instead create a business-friendly message.
             */

            cleanErrorMessage =
                `Fee mismatch | ` +
                `Program: ${comparison.program} | ` +
                `Batch: ${comparison.batch} | ` +
                `Expected: ₹${comparison.expectedFee} | ` +
                `Displayed: ₹${comparison.displayedFee}`;

        } else if (result.error?.message) {

            /*
             * Automation failures should display a cleaned
             * Playwright error.
             */

            cleanErrorMessage =
                cleanPlaywrightError(
                    result.error.message
                );
        }

        // ---------------------------------------------------------
        // Store result
        // ---------------------------------------------------------

        this.rows.push({

            title: cleanTitle,

            status: result.status,

            durationMs: result.duration,

            category,

            comparison,

            errorMessage: cleanErrorMessage,

            screenshotPath: screenshot?.path,
        });
    }

    /**
     * Called once after the complete test execution.
     */
    onEnd(_result: FullResult): void {

        // ---------------------------------------------------------
        // Create report directory if it does not exist
        // ---------------------------------------------------------

        if (
            !fs.existsSync(
                FrameworkConstants.REPORT_PATH
            )
        ) {

            fs.mkdirSync(
                FrameworkConstants.REPORT_PATH,
                {
                    recursive: true,
                }
            );
        }

        // ---------------------------------------------------------
        // Single report file
        // ---------------------------------------------------------

        /*
         * Every execution overwrites the same report.
         *
         * Report:
         *
         * reports/IMS_Fee_Verification.html
         */

        const outPath = path.join(
            FrameworkConstants.REPORT_PATH,
            'IMS_Fee_Verification.html'
        );

        // ---------------------------------------------------------
        // Generate HTML
        // ---------------------------------------------------------

        fs.writeFileSync(
            outPath,
            this.renderHtml(),
            'utf8'
        );

        console.log(
            `\nIMS Fee Verification report generated: ${outPath}\n`
        );
    }

    /**
     * Generates complete stakeholder-facing HTML report.
     */
    private renderHtml(): string {

        // ---------------------------------------------------------
        // Categorize results
        // ---------------------------------------------------------

        const discrepancies =
            this.rows.filter(
                r => r.category === 'Fee Discrepancy'
            );

        const defects =
            this.rows.filter(
                r => r.category === 'Automation Defect'
            );

        const passed =
            this.rows.filter(
                r => r.category === 'Passed'
            );

        const skipped =
            this.rows.filter(
                r => r.category === 'Skipped'
            );

        // ---------------------------------------------------------
        // Create table row
        // ---------------------------------------------------------

        const row = (r: ReportRow): string => {

            const badgeClass =
                r.category
                    .toLowerCase()
                    .replace(/\s+/g, '-');

            const c = r.comparison;

            // -----------------------------------------------------
            // Screenshot HTML
            // -----------------------------------------------------

            let screenshotHtml = '—';

            if (r.screenshotPath) {

                /*
                 * Convert screenshot path to a path relative
                 * to the report directory.
                 */

                const reportDir =
                    FrameworkConstants.REPORT_PATH;

                let relativeScreenshot =
                    path.relative(
                        reportDir,
                        r.screenshotPath
                    );

                /*
                 * Convert Windows backslashes to forward
                 * slashes for HTML.
                 */

                relativeScreenshot =
                    relativeScreenshot.replace(
                        /\\/g,
                        '/'
                    );

                screenshotHtml = `
                    <a
                        href="${escapeHtml(relativeScreenshot)}"
                        target="_blank"
                    >
                        <img
                            class="screenshot"
                            src="${escapeHtml(relativeScreenshot)}"
                            alt="Failure Screenshot"
                        />
                    </a>
                `;
            }

            // -----------------------------------------------------
            // Return table row
            // -----------------------------------------------------

            return `
                <tr class="${badgeClass}">

                    <td class="test-name">
                        ${escapeHtml(r.title)}
                    </td>

                    <td>
                        <span class="badge ${badgeClass}">
                            ${escapeHtml(r.category)}
                        </span>
                    </td>

                    <td>
                        ${
                            c
                                ? escapeHtml(c.expectedFee)
                                : '—'
                        }
                    </td>

                    <td>
                        ${
                            c
                                ? escapeHtml(c.displayedFee)
                                : '—'
                        }
                    </td>

                    <td>
                        ${(r.durationMs / 1000).toFixed(1)}s
                    </td>

                    <td class="detail">
                        ${
                            r.errorMessage
                                ? escapeHtml(
                                      r.errorMessage
                                  )
                                : '—'
                        }
                    </td>

                    <td class="screenshot-cell">
                        ${screenshotHtml}
                    </td>

                </tr>
            `;
        };

        // ---------------------------------------------------------
        // HTML
        // ---------------------------------------------------------

        return `
<!DOCTYPE html>

<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>
        IMS Program Fee Verification — Execution Report
    </title>

    <style>

        * {
            box-sizing: border-box;
        }

        body {

            font-family:
                Arial,
                Helvetica,
                sans-serif;

            margin: 0;

            padding: 30px;

            background: #f5f7fa;

            color: #172b4d;
        }

        h1 {

            margin-bottom: 5px;

            font-size: 28px;
        }

        .generated {

            color: #6b778c;

            margin-bottom: 30px;

            font-size: 14px;
        }

        /* -------------------------------------------------------
           Summary Cards
        ------------------------------------------------------- */

        .summary {

            display: grid;

            grid-template-columns:
                repeat(4, 1fr);

            gap: 20px;

            margin-bottom: 40px;
        }

        .card {

            background: white;

            border-radius: 10px;

            padding: 25px;

            box-shadow:
                0 2px 8px
                rgba(0, 0, 0, 0.08);
        }

        .card .num {

            font-size: 34px;

            font-weight: bold;

            margin-bottom: 5px;
        }

        .card .label {

            font-size: 14px;

            color: #6b778c;

            text-transform: uppercase;
        }

        .card.passed .num {

            color: #00875a;
        }

        .card.discrepancy .num {

            color: #de350b;
        }

        .card.defect .num {

            color: #ff8b00;
        }

        .card.skipped .num {

            color: #6554c0;
        }

        /* -------------------------------------------------------
           Sections
        ------------------------------------------------------- */

        section {

            margin-bottom: 40px;
        }

        section h2 {

            font-size: 22px;

            margin-bottom: 15px;
        }

        /* -------------------------------------------------------
           Table
        ------------------------------------------------------- */

        table {

            width: 100%;

            border-collapse: separate;

            border-spacing: 0;

            background: white;

            border-radius: 10px;

            overflow: hidden;

            box-shadow:
                0 2px 8px
                rgba(0, 0, 0, 0.08);
        }

        th {

            background: #f1f3f5;

            color: #5e6c84;

            text-transform: uppercase;

            font-size: 12px;

            letter-spacing: 0.5px;

            padding: 15px;

            text-align: left;
        }

        td {

            padding: 18px 15px;

            border-top: 1px solid #edf0f2;

            vertical-align: top;

            font-size: 14px;
        }

        /* -------------------------------------------------------
           Test Name
        ------------------------------------------------------- */

        .test-name {

            min-width: 220px;

            max-width: 300px;

            font-weight: 500;

            line-height: 1.5;
        }

        /* -------------------------------------------------------
           Detail
        ------------------------------------------------------- */

        .detail {

            min-width: 450px;

            max-width: 700px;

            white-space: normal;

            word-break: break-word;

            line-height: 1.6;

            color: #344563;
        }

        /* -------------------------------------------------------
           Category badges
        ------------------------------------------------------- */

        .badge {

            display: inline-block;

            padding: 6px 10px;

            border-radius: 20px;

            font-size: 12px;

            font-weight: bold;
        }

        .badge.passed {

            background: #d9f7e8;

            color: #00875a;
        }

        .badge.fee-discrepancy {

            background: #ffebe6;

            color: #de350b;
        }

        .badge.automation-defect {

            background: #fff0b3;

            color: #974f00;
        }

        .badge.skipped {

            background: #eae6ff;

            color: #403294;
        }

        /* -------------------------------------------------------
           Screenshot
        ------------------------------------------------------- */

        .screenshot-cell {

            width: 220px;

            text-align: center;

            vertical-align: middle;
        }

        .screenshot {

            width: 180px;

            max-height: 120px;

            object-fit: contain;

            border: 1px solid #dfe1e6;

            border-radius: 6px;

            cursor: pointer;

            transition:
                transform 0.2s ease,
                box-shadow 0.2s ease;
        }

        .screenshot:hover {

            transform: scale(1.05);

            box-shadow:
                0 4px 12px
                rgba(0, 0, 0, 0.2);
        }

        /* -------------------------------------------------------
           Responsive
        ------------------------------------------------------- */

        @media (max-width: 1200px) {

            .summary {

                grid-template-columns:
                    repeat(2, 1fr);
            }

            table {

                display: block;

                overflow-x: auto;
            }
        }

        @media (max-width: 700px) {

            body {

                padding: 15px;
            }

            .summary {

                grid-template-columns: 1fr;
            }

            h1 {

                font-size: 22px;
            }
        }

    </style>

</head>

<body>

    <h1>
        IMS Program Fee Verification — Execution Report
    </h1>

    <div class="generated">

        Generated:
        ${new Date().toLocaleString()}

    </div>

    <!-- =======================================================
         SUMMARY
    ======================================================== -->

    <div class="summary">

        <div class="card passed">

            <div class="num">
                ${passed.length}
            </div>

            <div class="label">
                Passed
            </div>

        </div>


        <div class="card discrepancy">

            <div class="num">
                ${discrepancies.length}
            </div>

            <div class="label">
                Fee Discrepancies
            </div>

        </div>


        <div class="card defect">

            <div class="num">
                ${defects.length}
            </div>

            <div class="label">
                Automation Defects
            </div>

        </div>


        <div class="card skipped">

            <div class="num">
                ${skipped.length}
            </div>

            <div class="label">
                Skipped
            </div>

        </div>

    </div>


    <!-- =======================================================
         FEE DISCREPANCIES
    ======================================================== -->

    ${
        discrepancies.length > 0
            ? `

    <section>

        <h2>
            ⚠ Fee Discrepancies
        </h2>

        <table>

            <thead>

                <tr>

                    <th>Test</th>

                    <th>Category</th>

                    <th>Expected Fee</th>

                    <th>Displayed Fee</th>

                    <th>Duration</th>

                    <th>Detail</th>

                    <th>Screenshot</th>

                </tr>

            </thead>

            <tbody>

                ${discrepancies.map(row).join('')}

            </tbody>

        </table>

    </section>

    `
            : ''
    }


    <!-- =======================================================
         AUTOMATION DEFECTS
    ======================================================== -->

    ${
        defects.length > 0
            ? `

    <section>

        <h2>
            🛠 Automation Defects
        </h2>

        <table>

            <thead>

                <tr>

                    <th>Test</th>

                    <th>Category</th>

                    <th>Expected Fee</th>

                    <th>Displayed Fee</th>

                    <th>Duration</th>

                    <th>Detail</th>

                    <th>Screenshot</th>

                </tr>

            </thead>

            <tbody>

                ${defects.map(row).join('')}

            </tbody>

        </table>

    </section>

    `
            : ''
    }


    <!-- =======================================================
         PASSED
    ======================================================== -->

    ${
        passed.length > 0
            ? `

    <section>

        <h2>
            ✔ Passed
        </h2>

        <table>

            <thead>

                <tr>

                    <th>Test</th>

                    <th>Category</th>

                    <th>Expected Fee</th>

                    <th>Displayed Fee</th>

                    <th>Duration</th>

                    <th>Detail</th>

                    <th>Screenshot</th>

                </tr>

            </thead>

            <tbody>

                ${passed.map(row).join('')}

            </tbody>

        </table>

    </section>

    `
            : ''
    }


    <!-- =======================================================
         SKIPPED
    ======================================================== -->

    ${
        skipped.length > 0
            ? `

    <section>

        <h2>
            ⏭ Skipped
        </h2>

        <table>

            <thead>

                <tr>

                    <th>Test</th>

                    <th>Category</th>

                    <th>Expected Fee</th>

                    <th>Displayed Fee</th>

                    <th>Duration</th>

                    <th>Detail</th>

                    <th>Screenshot</th>

                </tr>

            </thead>

            <tbody>

                ${skipped.map(row).join('')}

            </tbody>

        </table>

    </section>

    `
            : ''
    }

</body>

</html>
        `;
    }
}


/**
 * Removes Playwright ANSI/control characters and unnecessary
 * framework information from an error message.
 */
function cleanPlaywrightError(
    error: string
): string {

    let cleaned = error;

    // ---------------------------------------------------------
    // Remove ANSI escape/control characters
    // ---------------------------------------------------------

    cleaned = cleaned.replace(
        /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g,
        ''
    );

    // ---------------------------------------------------------
    // Remove Playwright Call log
    // ---------------------------------------------------------

    cleaned =
        cleaned.split('Call log:')[0];

    // ---------------------------------------------------------
    // Remove stack trace
    // ---------------------------------------------------------

    cleaned =
        cleaned.split(/\n\s*at\s+/)[0];

    // ---------------------------------------------------------
    // Remove excessive whitespace
    // ---------------------------------------------------------

    cleaned =
        cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
}


/**
 * Escape HTML characters to prevent broken HTML
 * and unsafe content inside the report.
 */
function escapeHtml(
    input: string
): string {

    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}