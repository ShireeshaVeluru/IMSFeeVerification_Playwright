import {
    test as base,
    expect
} from '@playwright/test';

import { ProgramPage } from '../pages/ProgramPage';
import { Logger } from '../utils/Logger';

type Fixtures = {
    programPage: ProgramPage;
};

/**
 * Custom Playwright fixtures.
 *
 * Responsibilities:
 *
 * 1. Provides reusable Page Objects to tests.
 * 2. Initializes logging context for every test.
 * 3. Captures:
 *      - Worker ID
 *      - Test name
 *      - Browser / Playwright project
 *      - Environment
 * 4. Handles fixture lifecycle logging.
 *
 * This is especially useful when tests are executed
 * in parallel using multiple Playwright workers.
 */
export const test = base.extend<Fixtures>({

    programPage: async (
        { page },
        use,
        testInfo
    ) => {

        // ---------------------------------------------
        // Create a logger specifically for this fixture
        // ---------------------------------------------

        const log =
            Logger.getLogger('PageFixtures');

        // ---------------------------------------------
        // Set Playwright execution context
        // ---------------------------------------------

        log.setContext({
            workerIndex:
                testInfo.workerIndex,

            testName:
                testInfo.title,

            projectName:
                testInfo.project.name,

            environment:
                process.env.ENV || 'qa'
        });

        // ---------------------------------------------
        // Browser/Page initialization
        // ---------------------------------------------

        log.info(
            'Browser/Page initialized'
        );

        log.info(
            'Test execution started'
        );

        log.info(
            'Browser project: {}',
            testInfo.project.name
        );

        log.info(
            'Environment: {}',
            process.env.ENV || 'qa'
        );

        log.info(
            'Worker index: {}',
            testInfo.workerIndex
        );

        // ---------------------------------------------
        // Create Page Object
        // ---------------------------------------------

        log.info(
            'Creating ProgramPage Page Object'
        );

        const programPage =
            new ProgramPage(page);

        log.info(
            'ProgramPage Page Object initialized'
        );

        // ---------------------------------------------
        // Give ProgramPage to the test
        // ---------------------------------------------

        await use(programPage);

        // ---------------------------------------------
        // Fixture cleanup
        // ---------------------------------------------

        log.info(
            'Test execution completed'
        );

        log.info(
            'Fixture cleanup completed'
        );
    }
});

/**
 * Re-export expect so tests can use:
 *
 * import { test, expect }
 * from '../src/fixtures/pageFixtures';
 */
export { expect };