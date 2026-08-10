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

export default class FeeDiscrepancyReporter
    implements Reporter {

    /*
     * IMPORTANT:
     *
     * Map is used instead of an array so that the same
     * testcase is stored only once.
     *
     * If Playwright retries a failed testcase:
     *
     * Attempt 1 -> Failed
     * Attempt 2 -> Failed
     *
     * test.id remains the same, so the second result
     * replaces the first result.
     *
     * This prevents duplicate rows in the stakeholder report.
     */
    private rows = new Map<string, ReportRow>();

    /**
     * Called by Playwright whenever a test attempt finishes.
     */
    onTestEnd(
        test: TestCase,
        result: TestResult
    ): void {

        /*
         * ---------------------------------------------
         * Fee comparison attachment
         * ---------------------------------------------
         */

        const attachment =
            result.attachments.find(
                attachment =>
                    attachment.name === 'fee-comparison'
            );

        let comparison:
            | FeeComparison
            | undefined;

        if (attachment?.body) {

            try {

                comparison = JSON.parse(
                    attachment.body.toString()
                );

            } catch {

                comparison = undefined;
            }
        }

        /*
         * ---------------------------------------------
         * Screenshot
         * ---------------------------------------------
         */

        const screenshot =
            result.attachments.find(
                attachment =>
                    attachment.contentType === 'image/png'
            );

        /*
         * ---------------------------------------------
         * Determine report category
         * ---------------------------------------------
         */

        let category:
            | 'Passed'
            | 'Fee Discrepancy'
            | 'Automation Defect'
            | 'Skipped';

        if (result.status === 'passed') {

            category = 'Passed';

        } else if (result.status === 'skipped') {

            category = 'Skipped';

        } else {

            /*
             * A failed test is considered a Fee Discrepancy
             * when the fee comparison exists and the expected
             * and displayed values are different.
             *
             * Otherwise it is considered an Automation Defect.
             */

            const isFeeMismatch =
                result.error?.message?.includes(
                    'Fee mismatch'
                ) ||
                (
                    comparison !== undefined &&
                    comparison.expectedFee !==
                    comparison.displayedFee
                );

            category = isFeeMismatch
                ? 'Fee Discrepancy'
                : 'Automation Defect';
        }

        /*
         * ---------------------------------------------
         * Clean test title
         * ---------------------------------------------
         *
         * Removes Playwright's project/parameter suffixes
         * when they appear in the title.
         */

        const cleanTitle =
            cleanTestTitle(test.title);

        /*
         * ---------------------------------------------
         * Clean error message
         * ---------------------------------------------
         */

        const errorMessage =
            result.error?.message
                ? cleanErrorMessage(
                    result.error.message
                )
                : undefined;

        /*
         * ---------------------------------------------
         * Store result
         * ---------------------------------------------
         *
         * IMPORTANT:
         *
         * test.id is used as the Map key.
         *
         * This means retries do NOT create duplicate
         * rows in the final stakeholder report.
         */

        this.rows.set(
            test.id,
            {
                title: cleanTitle,

                status: result.status,

                durationMs:
                    result.duration,

                category,

                comparison,

                errorMessage,

                screenshotPath:
                    screenshot?.path,
            }
        );
    }

    /**
     * Called once after the complete Playwright run.
     */
    onEnd(
        _result: FullResult
    ): void {

        /*
         * ---------------------------------------------
         * Create report directory
         * ---------------------------------------------
         */

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

        /*
         * ---------------------------------------------
         * Single report file
         * ---------------------------------------------
         *
         * Every execution replaces the previous report.
         */

        const outPath =
            path.join(
                FrameworkConstants.REPORT_PATH,
                'IMS_Fee_Verification.html'
            );

        /*
         * Remove previous report if it exists.
         */

        if (fs.existsSync(outPath)) {

            fs.unlinkSync(outPath);
        }

        /*
         * Generate fresh report.
         */

        fs.writeFileSync(
            outPath,
            this.renderHtml(),
            'utf8'
        );

        console.log(
            `[FeeDiscrepancyReporter] Stakeholder report generated: ${outPath}`
        );
    }

    /**
     * Creates the complete stakeholder HTML report.
     */
    private renderHtml(): string {

        /*
         * Convert Map into array.
         */

        const rows =
            Array.from(
                this.rows.values()
            );

        /*
         * ---------------------------------------------
         * Categorize results
         * ---------------------------------------------
         */

        const discrepancies =
            rows.filter(
                row =>
                    row.category ===
                    'Fee Discrepancy'
            );

        const defects =
            rows.filter(
                row =>
                    row.category ===
                    'Automation Defect'
            );

        const passed =
            rows.filter(
                row =>
                    row.category ===
                    'Passed'
            );

        const skipped =
            rows.filter(
                row =>
                    row.category ===
                    'Skipped'
            );

        /*
         * ---------------------------------------------
         * Summary
         * ---------------------------------------------
         */

        const total =
            rows.length;

        /*
         * ---------------------------------------------
         * Generate table row
         * ---------------------------------------------
         */

        const tableRow = (
            row: ReportRow
        ): string => {

            const comparison =
                row.comparison;

            const categoryClass =
                row.category
                    .toLowerCase()
                    .replace(/\s+/g, '-');

            const action =
                getAction(row.category);

            const screenshotHtml =
                row.screenshotPath
                    ? this.createScreenshotHtml(
                        row.screenshotPath
                    )
                    : '—';

            return `
                <tr class="${categoryClass}">

                    <td class="test-name">
                        ${escapeHtml(row.title)}
                    </td>

                    <td>
                        <span class="badge ${categoryClass}">
                            ${escapeHtml(row.category)}
                        </span>
                    </td>

                    <td>
                        ${
                            comparison
                                ? escapeHtml(
                                    comparison.expectedFee
                                )
                                : '—'
                        }
                    </td>

                    <td
                        class="${
                            comparison &&
                            comparison.expectedFee !==
                            comparison.displayedFee
                                ? 'fee-mismatch'
                                : ''
                        }"
                    >
                        ${
                            comparison
                                ? escapeHtml(
                                    comparison.displayedFee
                                )
                                : '—'
                        }
                    </td>

                    <td>
                        ${
                            comparison?.gst
                                ? escapeHtml(
                                    comparison.gst
                                )
                                : '—'
                        }
                    </td>

                    <td>
                        ${
                            comparison?.startDate
                                ? escapeHtml(
                                    comparison.startDate
                                )
                                : '—'
                        }
                    </td>

                    <td>
                        ${
                            comparison?.batchType
                                ? escapeHtml(
                                    comparison.batchType
                                )
                                : '—'
                        }
                    </td>

                    <td>
                        ${escapeHtml(action)}
                    </td>

                    <td class="duration">
                        ${(
                            row.durationMs / 1000
                        ).toFixed(1)}s
                    </td>

                    <td class="details">
                        ${
                            row.errorMessage
                                ? `
                                    <div class="error-message">
                                        ${escapeHtml(
                                            row.errorMessage
                                        )}
                                    </div>
                                  `
                                : '—'
                        }
                    </td>

                    <td class="screenshot">
                        ${screenshotHtml}
                    </td>

                </tr>
            `;
        };

        /*
         * ---------------------------------------------
         * Section renderer
         * ---------------------------------------------
         */

        const renderSection = (
            title: string,
            sectionRows: ReportRow[],
            cssClass: string
        ): string => {

            if (
                sectionRows.length === 0
            ) {

                return '';
            }

            return `
                <section>

                    <h2 class="${cssClass}">
                        ${title}
                    </h2>

                    <div class="table-container">

                        <table>

                            <thead>

                                <tr>

                                    <th>Test</th>

                                    <th>Category</th>

                                    <th>Expected Fee</th>

                                    <th>Displayed Fee</th>

                                    <th>GST</th>

                                    <th>Start Date</th>

                                    <th>Batch Type</th>

                                    <th>Action</th>

                                    <th>Duration</th>

                                    <th>Details</th>

                                    <th>Screenshot</th>

                                </tr>

                            </thead>

                            <tbody>

                                ${sectionRows
                                    .map(tableRow)
                                    .join('')}

                            </tbody>

                        </table>

                    </div>

                </section>
            `;
        };

        /*
         * ---------------------------------------------
         * Final HTML
         * ---------------------------------------------
         */

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
        IMS Fee Verification Stakeholder Report
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

            color: #263238;
        }

        .header {

            background: #ffffff;

            border-radius: 10px;

            padding: 25px;

            margin-bottom: 25px;

            box-shadow:
                0 2px 8px
                rgba(0,0,0,0.08);
        }

        .header h1 {

            margin: 0 0 8px 0;

            font-size: 26px;
        }

        .header p {

            margin: 5px 0;

            color: #607d8b;
        }

        .summary {

            display: grid;

            grid-template-columns:
                repeat(
                    auto-fit,
                    minmax(180px, 1fr)
                );

            gap: 15px;

            margin-bottom: 30px;
        }

        .card {

            background: #ffffff;

            border-radius: 10px;

            padding: 20px;

            text-align: center;

            box-shadow:
                0 2px 8px
                rgba(0,0,0,0.08);
        }

        .card .num {

            font-size: 32px;

            font-weight: bold;

            margin-bottom: 5px;
        }

        .card .label {

            font-size: 14px;

            color: #607d8b;
        }

        .card.total .num {

            color: #1565c0;
        }

        .card.passed .num {

            color: #2e7d32;
        }

        .card.discrepancy .num {

            color: #d84315;
        }

        .card.defect .num {

            color: #6a1b9a;
        }

        .card.skipped .num {

            color: #757575;
        }

        section {

            background: #ffffff;

            border-radius: 10px;

            padding: 20px;

            margin-bottom: 25px;

            box-shadow:
                0 2px 8px
                rgba(0,0,0,0.08);
        }

        h2 {

            margin-top: 0;

            font-size: 20px;
        }

        h2.discrepancy {

            color: #d84315;
        }

        h2.defect {

            color: #6a1b9a;
        }

        h2.passed {

            color: #2e7d32;
        }

        h2.skipped {

            color: #757575;
        }

        .table-container {

            overflow-x: auto;

            width: 100%;
        }

        table {

            width: 100%;

            border-collapse: collapse;

            min-width: 1200px;
        }

        th {

            background: #263238;

            color: #ffffff;

            padding: 12px;

            text-align: left;

            font-size: 13px;

            white-space: nowrap;
        }

        td {

            padding: 12px;

            border-bottom:
                1px solid #e0e0e0;

            vertical-align: top;

            font-size: 13px;
        }

        tr:hover {

            background: #f8f9fa;
        }

        .test-name {

            font-weight: 600;

            min-width: 250px;

            max-width: 350px;
        }

        .badge {

            display: inline-block;

            padding: 5px 10px;

            border-radius: 15px;

            font-size: 12px;

            font-weight: bold;

            white-space: nowrap;
        }

        .badge.passed {

            background: #e8f5e9;

            color: #2e7d32;
        }

        .badge.fee-discrepancy {

            background: #fbe9e7;

            color: #d84315;
        }

        .badge.automation-defect {

            background: #f3e5f5;

            color: #6a1b9a;
        }

        .badge.skipped {

            background: #eeeeee;

            color: #616161;
        }

        .fee-mismatch {

            font-weight: bold;

            color: #d84315;

            background: #fff3e0;
        }

        .duration {

            white-space: nowrap;
        }

        .details {

            max-width: 400px;

            min-width: 300px;

            white-space: normal;

            word-break: break-word;
        }

        .error-message {

            white-space: pre-wrap;

            line-height: 1.5;

            color: #b71c1c;

            background: #ffebee;

            border-radius: 5px;

            padding: 10px;
        }

        .screenshot {

            min-width: 180px;

            text-align: center;
        }

        .screenshot img {

            max-width: 160px;

            max-height: 100px;

            border-radius: 5px;

            border: 1px solid #ddd;

            cursor: pointer;
        }

        .screenshot img:hover {

            opacity: 0.8;
        }

        .no-results {

            padding: 15px;

            color: #607d8b;

            text-align: center;
        }

        .footer {

            text-align: center;

            color: #90a4ae;

            font-size: 12px;

            margin-top: 30px;
        }

    </style>

</head>

<body>

    <div class="header">

        <h1>
            IMS Fee Verification Report
        </h1>

        <p>
            Stakeholder-focused execution summary
        </p>

        <p>
            Generated:
            ${new Date().toLocaleString()}
        </p>

    </div>

    <div class="summary">

        <div class="card total">

            <div class="num">
                ${total}
            </div>

            <div class="label">
                Total Tests
            </div>

        </div>

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

    ${renderSection(
        '⚠ Fee Discrepancies — Product / Content Action Required',
        discrepancies,
        'discrepancy'
    )}

    ${renderSection(
        '🛠 Automation Defects — QA / Automation Action Required',
        defects,
        'defect'
    )}

    ${renderSection(
        '✔ Passed Tests',
        passed,
        'passed'
    )}

    ${renderSection(
        '⏭ Skipped Tests',
        skipped,
        'skipped'
    )}

    <div class="footer">

        IMS Fee Verification Automation Framework

    </div>

</body>

</html>
        `;
    }

    /**
     * Creates screenshot HTML.
     *
     * The screenshot is embedded as Base64 so the stakeholder
     * report remains viewable even when the screenshot file
     * itself is not directly available.
     */
    private createScreenshotHtml(
        screenshotPath: string
    ): string {

        try {

            if (
                !fs.existsSync(
                    screenshotPath
                )
            ) {

                return 'Screenshot unavailable';
            }

            const image =
                fs.readFileSync(
                    screenshotPath
                );

            const base64 =
                image.toString('base64');

            return `
                <a
                    href="data:image/png;base64,${base64}"
                    target="_blank"
                    title="Open screenshot"
                >

                    <img
                        src="data:image/png;base64,${base64}"
                        alt="Failure screenshot"
                    >

                </a>
            `;

        } catch {

            return 'Screenshot unavailable';
        }
    }
}

/**
 * Removes unnecessary Playwright title information.
 */
function cleanTestTitle(
    title: string
): string {

    return title
        .replace(
            /\s*›\s*.*$/,
            ''
        )
        .trim();
}

/**
 * Cleans Playwright error messages so the stakeholder
 * report focuses on the useful failure information.
 */
function cleanErrorMessage(
    message: string
): string {

    let cleaned = message;

    /*
     * Remove Playwright call log when present.
     */

    const callLogIndex =
        cleaned.indexOf(
            'Call log:'
        );

    if (
        callLogIndex !== -1
    ) {

        cleaned =
            cleaned.substring(
                0,
                callLogIndex
            );
    }

    /*
     * Remove excessive blank lines.
     */

    cleaned =
        cleaned.replace(
            /\n{3,}/g,
            '\n\n'
        );

    /*
     * Remove leading/trailing whitespace.
     */

    return cleaned.trim();
}

/**
 * Determines who should take action.
 */
function getAction(
    category: ReportRow['category']
): string {

    switch (category) {

        case 'Fee Discrepancy':

            return 'Product / Content Team';

        case 'Automation Defect':

            return 'QA / Automation Team';

        case 'Passed':

            return 'No Action';

        case 'Skipped':

            return 'Review if required';

        default:

            return 'Review';
    }
}

/**
 * Prevents HTML injection.
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
