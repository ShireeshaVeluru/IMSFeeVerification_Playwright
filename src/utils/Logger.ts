import fs from 'fs';
import path from 'path';

interface LoggerContext {
    workerIndex?: number;
    testName?: string;
    projectName?: string;
    environment?: string;
}

export class Logger {

    private static readonly LOG_DIRECTORY = path.resolve(
        process.cwd(),
        'logs'
    );

    private static readonly LOG_FILE = path.join(
        Logger.LOG_DIRECTORY,
        'automation.log'
    );

    private context: LoggerContext = {};

    private constructor(
        private readonly scope: string
    ) {
        Logger.initialize();
    }

    /**
     * Creates a logger for a particular class/module.
     */
    static getLogger(scope: string): Logger {
        return new Logger(scope);
    }

    /**
     * Sets execution context for the current logger.
     *
     * Includes:
     * - Worker index
     * - Test name
     * - Browser/project
     * - Environment
     */
    setContext(context: LoggerContext): void {
        this.context = context;
    }

    /**
     * INFO log.
     */
    info(
        message: string,
        ...args: unknown[]
    ): void {

        const formattedMessage =
            this.format(message, args);

        this.write(
            'INFO',
            formattedMessage
        );

        console.log(
            this.buildConsoleMessage(
                'INFO',
                formattedMessage
            )
        );
    }

    /**
     * WARN log.
     */
    warn(
        message: string,
        ...args: unknown[]
    ): void {

        const formattedMessage =
            this.format(message, args);

        this.write(
            'WARN',
            formattedMessage
        );

        console.warn(
            this.buildConsoleMessage(
                'WARN',
                formattedMessage
            )
        );
    }

    /**
     * ERROR log.
     */
    error(
        message: string,
        ...args: unknown[]
    ): void {

        const formattedMessage =
            this.format(message, args);

        this.write(
            'ERROR',
            formattedMessage
        );

        console.error(
            this.buildConsoleMessage(
                'ERROR',
                formattedMessage
            )
        );
    }

    /**
     * Creates logs directory if it doesn't exist.
     */
    private static initialize(): void {

        if (
            !fs.existsSync(
                Logger.LOG_DIRECTORY
            )
        ) {

            fs.mkdirSync(
                Logger.LOG_DIRECTORY,
                {
                    recursive: true
                }
            );
        }
    }

    /**
     * Builds console log message.
     */
    private buildConsoleMessage(
        level: 'INFO' | 'WARN' | 'ERROR',
        message: string
    ): string {

        return (
            `[${level}] ` +
            `[${this.scope}] ` +
            `${this.getContextString()} ` +
            `${message}`
        );
    }

    /**
     * Builds execution context.
     */
    private getContextString(): string {

        const contextParts: string[] = [];

        if (
            this.context.workerIndex !== undefined
        ) {

            contextParts.push(
                `Worker:${this.context.workerIndex}`
            );
        }

        if (
            this.context.projectName
        ) {

            contextParts.push(
                `Browser:${this.context.projectName}`
            );
        }

        if (
            this.context.environment
        ) {

            contextParts.push(
                `ENV:${this.context.environment}`
            );
        }

        if (
            this.context.testName
        ) {

            contextParts.push(
                `Test:"${this.context.testName}"`
            );
        }

        return contextParts.length > 0
            ? `[${contextParts.join(' | ')}]`
            : '';
    }

    /**
     * Writes log entry to automation.log.
     */
    private write(
        level: 'INFO' | 'WARN' | 'ERROR',
        message: string
    ): void {

        const timestamp =
            new Date()
                .toISOString()
                .replace('T', ' ')
                .replace('Z', '');

        const logLine =
            `[${timestamp}] ` +
            `[${level}] ` +
            `[${this.scope}] ` +
            `${this.getContextString()} ` +
            `${message}` +
            `${process.platform === 'win32' ? '\r\n' : '\n'}`;

        fs.appendFileSync(
            Logger.LOG_FILE,
            logLine,
            {
                encoding: 'utf8'
            }
        );
    }

    /**
     * Replaces {} placeholders with arguments.
     */
    private format(
        message: string,
        args: unknown[]
    ): string {

        let index = 0;

        return message.replace(
            /{}/g,
            () =>
                String(
                    args[index++] ?? ''
                )
        );
    }
}