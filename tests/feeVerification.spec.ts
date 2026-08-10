import {
    test,
    expect
} from '../src/fixtures/pageFixtures';

import {
    getFeeData
} from '../src/data/FeeDataProvider';

import {
    Logger
} from '../src/utils/Logger';

const log =
    Logger.getLogger('FeeVerificationTest');

test.describe(
    'IMS Program Fee Verification',
    () => {

        for (const row of getFeeData()) {

            const {
                programName,
                programUrlPath,
                batchName,
                expectedFee
            } = row;

            test(
                `[${programName}] ${batchName} — displayed fee matches expected fee`,
                async ({ programPage }) => {

                    log.info(
                        'Starting fee verification | Program: {} | Batch: {}',
                        programName,
                        batchName
                    );

                    await programPage.open(
                        programUrlPath
                    );

                    const batchDetails =
                        await programPage
                            .getBatchDetails(
                                batchName
                            );

                    log.info(
                        'Fee comparison | Program: {} | Batch: {} | Expected: {} | Displayed: {}',
                        programName,
                        batchName,
                        expectedFee,
                        batchDetails.fee
                    );

                    await test.info().attach(
                        'fee-comparison',
                        {
                            body: JSON.stringify(
                                {
                                    program: programName,
                                    batch: batchName,
                                    expectedFee,
                                    displayedFee:
                                        batchDetails.fee,
                                    gst:
                                        batchDetails.gst,
                                    startDate:
                                        batchDetails.startDate,
                                    batchType:
                                        batchDetails.batchType
                                },
                                null,
                                2
                            ),
                            contentType:
                                'application/json'
                        }
                    );

                    expect(
                        batchDetails.fee,
                        `Fee mismatch | Program: ${programName} | Batch: ${batchName} | ` +
                        `Displayed: ${batchDetails.fee} | Expected: ${expectedFee}`
                    ).toBe(expectedFee);

                    log.info(
                        'Fee verification passed | Program: {} | Batch: {}',
                        programName,
                        batchName
                    );
                }
            );
        }
    }
);