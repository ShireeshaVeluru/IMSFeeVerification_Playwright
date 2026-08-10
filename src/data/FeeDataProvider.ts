import { FrameworkConstants } from '../constants/FrameworkConstants';
import { ExcelUtility, FeeRow } from '../utils/ExcelUtility';

/**
 * Equivalent of FeeDataProvider.java's TestNG @DataProvider. Playwright
 * has no built-in data-provider annotation, so the spec file calls
 * this once at module-load time and fans the rows out into individual
 * `test()` cases — see tests/feeVerification.spec.ts. Adding a new
 * Program/Batch is still a spreadsheet edit, not a code change.
 */
export function getFeeData(): FeeRow[] {

    return ExcelUtility.getSheetData(
        FrameworkConstants.EXCEL_PATH,
        FrameworkConstants.EXCEL_SHEET_NAME
    );

}
