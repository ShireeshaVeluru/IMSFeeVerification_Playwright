import * as XLSX from 'xlsx';

export interface FeeRow {
    programName: string;
    programUrlPath: string;
    batchName: string;
    expectedFee: string;
}

/**
 * Thin, synchronous wrapper around SheetJS. Equivalent to
 * ExcelUtility.java — the ONLY place that knows the spreadsheet's
 * column order, so a column reshuffle in FeeData.xlsx means editing
 * one function, not every test.
 *
 * Deliberately synchronous: Playwright test files are collected
 * (i.e. `test(...)` is called once per row) before any test runs, so
 * the data must be available at module-load time, not behind a
 * Promise. This is the direct TypeScript analogue of TestNG calling
 * a @DataProvider before the suite starts.
 */
export class ExcelUtility {

    private constructor() {}

    static getSheetData(filePath: string, sheetName: string): FeeRow[] {

        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[sheetName];

        if (!sheet) {
            throw new Error(`Sheet not found: ${sheetName}`);
        }

        const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

        if (raw.length < 2) {
            throw new Error(`No rows found in sheet: ${sheetName}`);
        }

        const headerRow = raw[0].map(cell => String(cell ?? '').trim().toLowerCase());

        const indexes = {
            programName: ExcelUtility.findHeaderIndex(headerRow, ['program name', 'program']),
            programUrlPath: ExcelUtility.findHeaderIndex(headerRow, ['url', 'path', 'program url', 'program path']),
            batchName: ExcelUtility.findHeaderIndex(headerRow, ['batch name', 'batch']),
            expectedFee: ExcelUtility.findHeaderIndex(headerRow, ['expected fee', 'fee']),
        };

        const rows = raw.slice(1)
            .map((row) => ({
                programName: ExcelUtility.cell(row, indexes.programName),
                programUrlPath: ExcelUtility.cell(row, indexes.programUrlPath),
                batchName: ExcelUtility.cell(row, indexes.batchName),
                expectedFee: ExcelUtility.cell(row, indexes.expectedFee),
            }))
            .filter((row) => row.programName || row.programUrlPath || row.batchName || row.expectedFee);

        if (rows.length === 0) {
            throw new Error(`No valid fee rows found in sheet: ${sheetName}`);
        }

        return rows;
    }

    private static findHeaderIndex(headerRow: string[], aliases: string[]): number {
        for (const alias of aliases) {
            const index = headerRow.findIndex(header => header.includes(alias));
            if (index !== -1) {
                return index;
            }
        }
        throw new Error(`Required header not found: ${aliases.join(' | ')}`);
    }

    private static cell(row: unknown[], col: number): string {
        const value = row[col];
        return value === null || value === undefined ? '' : String(value).trim();
    }

}
