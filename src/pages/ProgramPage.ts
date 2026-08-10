import {
    Page,
    Locator,
    expect
} from '@playwright/test';

import { BatchDetails } from '../models/BatchDetails';
import { ConfigReader } from '../config/ConfigReader';
import { Logger } from '../utils/Logger';

/**
 * Page Object for ANY IMS "program details" page.
 *
 * All programs share the same DOM structure for the
 * "Select Batch" section, so ONE page object serves
 * the entire catalog.
 */
export class ProgramPage {

    private readonly batchCards: Locator;

    private readonly log =
        Logger.getLogger('ProgramPage');

    constructor(
        private readonly page: Page
    ) {

        // All batch cards on the page
        this.batchCards =
            this.page.locator(
                'div.col-sm-4.row.form-check.mb-3.d-flex'
            );

        this.log.info(
            'ProgramPage object created'
        );
    }

    /**
     * Navigates to the given program URL.
     */
    async open(
        programUrlPath: string
    ): Promise<this> {

        const baseUrl =
            ConfigReader.getProperty(
                'baseUrl'
            );

        const fullUrl =
            new URL(
                programUrlPath,
                baseUrl
            ).toString();

        this.log.info(
            'Opening program URL: {}',
            fullUrl
        );

        await this.page.goto(
            fullUrl,
            {
                waitUntil: 'domcontentloaded'
            }
        );

        this.log.info(
            'Program page loaded successfully: {}',
            fullUrl
        );

        return this;
    }

    /**
     * Returns complete Batch Details for
     * the given batch name.
     */
    async getBatchDetails(
        expectedBatchName: string
    ): Promise<BatchDetails> {

        this.log.info(
            'Searching for batch: {}',
            expectedBatchName
        );

        await expect(
            this.batchCards.first()
        ).toBeVisible({
            timeout: Number(
                ConfigReader.getProperty(
                    'navigationTimeout'
                )
            )
        });

        const cardCount =
            await this.batchCards.count();

        this.log.info(
            'Batch cards found: {}',
            cardCount
        );

        for (
            let i = 0;
            i < cardCount;
            i++
        ) {

            const card =
                this.batchCards.nth(i);

            const actualBatchName =
                (
                    await card
                        .locator(
                            'label.form-check-label'
                        )
                        .innerText()
                ).trim();

            this.log.info(
                'Checking batch card {}: {}',
                i + 1,
                actualBatchName
            );

            if (
                actualBatchName.toLowerCase() ===
                expectedBatchName.toLowerCase()
            ) {

                this.log.info(
                    'Matching batch found: {}',
                    actualBatchName
                );

                const details =
                    new BatchDetails();

                details.batchName =
                    actualBatchName;

                // -----------------------------------
                // Scroll matching card into view
                // -----------------------------------

                this.log.info(
                    'Scrolling batch card into view: {}',
                    actualBatchName
                );

                await card.evaluate(
                    (element) => {

                        element.scrollIntoView({
                            behavior: 'instant',
                            block: 'center',
                            inline: 'nearest'
                        });
                    }
                );

                await card.scrollIntoViewIfNeeded();

                // -----------------------------------
                // Fee
                // -----------------------------------

                const rawFee =
                    await card
                        .locator(
                            'h4.batch-total-price'
                        )
                        .innerText();

                details.fee =
                    ProgramPage.normalizeAmountString(rawFee);

                this.log.info(
                    'Displayed fee captured: {}',
                    details.fee
                );

                // -----------------------------------
                // GST
                // -----------------------------------

                const rawGst =
                    await card
                        .locator(
                            'p.batch-price-details span'
                        )
                        .innerText();

                details.gst =
                    rawGst
                        .replace(
                            /\+?\s*GST\s*\(\d+%\)\s*:?/i,
                            ''
                        )
                        .trim();

                this.log.info(
                    'GST captured: {}',
                    details.gst
                );

                // -----------------------------------
                // Batch Information
                // -----------------------------------

                const batchInfo =
                    card.locator(
                        '.batch-details p.check_text'
                    );

                await batchInfo
                    .scrollIntoViewIfNeeded();

                const info =
                    await batchInfo.innerText();

                const lines =
                    info
                        .split('\n')
                        .map(
                            line => line.trim()
                        )
                        .filter(Boolean);

                if (lines.length >= 2) {

                    details.startDate =
                        lines[0]
                            .replace(
                                'Batch Start Date:',
                                ''
                            )
                            .trim();

                    details.batchType =
                        lines[1]
                            .replace(
                                'Batch Type:',
                                ''
                            )
                            .trim();
                }

                this.log.info(
                    'Batch information captured | Start Date: {} | Batch Type: {}',
                    details.startDate,
                    details.batchType
                );

                this.log.info(
                    'Batch details completed | Batch: {} | Fee: {} | GST: {}',
                    details.batchName,
                    details.fee,
                    details.gst
                );

                return details;
            }
        }

        this.log.error(
            'Batch not found: {}',
            expectedBatchName
        );

        throw new Error(
            `Batch not found: ${expectedBatchName}`
        );
    }

    private static normalizeAmountString(raw: string): string {
        return raw
            .replace(/[₹\u00A0,\s\/-]/g, '')
            .replace(/[^\d.]/g, '')
            .trim();
    }
}