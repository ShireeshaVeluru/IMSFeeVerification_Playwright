import path from 'path';

/**
 * Central location for every framework path. Mirrors the Java
 * FrameworkConstants class: one place to change if the folder layout
 * ever moves, instead of hunting string literals across the suite.
 */
export class FrameworkConstants {

    private constructor() {}

    static readonly CONFIG_DIR: string = path.join(process.cwd(), 'config');

    static readonly SCREENSHOT_PATH: string = path.join(process.cwd(), 'screenshots');

    static readonly REPORT_PATH: string = path.join(process.cwd(), 'reports');

    static readonly EXCEL_PATH: string = path.join(process.cwd(), 'src', 'data', 'FeeData.xlsx');

    static readonly EXCEL_SHEET_NAME: string = 'FeeData';

}
