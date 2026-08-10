/**
 * Plain data holder for one batch card scraped off a Program page.
 * Equivalent to BatchDetails.java — kept dependency-free so it can be
 * used in assertions, logs, and reports without dragging Playwright
 * types along with it.
 */
export class BatchDetails {

    constructor(
        public batchName: string = '',
        public fee: string = '',
        public gst: string = '',
        public startDate: string = '',
        public batchType: string = ''
    ) {}

    toString(): string {
        return `BatchDetails { batchName='${this.batchName}', fee='${this.fee}', ` +
               `gst='${this.gst}', startDate='${this.startDate}', batchType='${this.batchType}' }`;
    }

}
