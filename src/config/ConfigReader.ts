import fs from 'fs';
import path from 'path';
import { FrameworkConstants } from '../constants/FrameworkConstants';

export interface EnvConfig {
    env: string;
    baseUrl: string;
    browser: string;
    headless: boolean;
    actionTimeout: number;
    navigationTimeout: number;
    retries: number;
    workers: number;
    testerName: string;
}

/**
 * Loads config.{env}.json, where {env} defaults to "qa" and can be
 * overridden per run without touching any code, e.g.:
 *
 *   ENV=staging npx playwright test
 *   ENV=prod npx playwright test
 *
 * This is the single point where environment (base URL, browser,
 * timeouts) is resolved, keeping test/page-object code
 * environment-agnostic — exactly the role ConfigReader.java plays in
 * the Selenium suite.
 */
export class ConfigReader {

    private static config: EnvConfig;

    private constructor() {}

    static get(): EnvConfig {

        if (!ConfigReader.config) {

            const env = String(process.env.ENV || 'qa').trim().toLowerCase();
            const configPath = path.join(FrameworkConstants.CONFIG_DIR, `config.${env}.json`);

            if (!fs.existsSync(configPath)) {
                throw new Error(`Unable to load config file for environment: ${configPath}`);
            }

            const raw = fs.readFileSync(configPath, 'utf-8');
            const parsed = JSON.parse(raw);

            ConfigReader.config = ConfigReader.validateConfig(parsed, env);
        }

        return ConfigReader.config;

    }

    private static validateConfig(raw: unknown, env: string): EnvConfig {

        if (typeof raw !== 'object' || raw === null) {
            throw new Error(`Invalid config format for environment: ${env}`);
        }

        const configObject = raw as Record<string, unknown>;

        const baseUrl = ConfigReader.getString(configObject, 'baseUrl');
        const browser = ConfigReader.getString(configObject, 'browser');
        const headless = ConfigReader.getBooleanOverride(configObject, 'headless', 'HEADLESS');
        const actionTimeout = ConfigReader.getNumberOverride(configObject, 'actionTimeout', 'ACTION_TIMEOUT');
        const navigationTimeout = ConfigReader.getNumberOverride(configObject, 'navigationTimeout', 'NAVIGATION_TIMEOUT');
        const retries = ConfigReader.getNumberOverride(configObject, 'retries', 'RETRIES');
        const workers = ConfigReader.getNumberOverride(configObject, 'workers', 'WORKERS');
        const testerName = ConfigReader.getString(configObject, 'testerName');

        return {
            env,
            baseUrl: process.env.BASE_URL?.trim() || baseUrl,
            browser,
            headless,
            actionTimeout,
            navigationTimeout,
            retries,
            workers,
            testerName,
        };
    }

    private static getString(object: Record<string, unknown>, key: string): string {
        const value = object[key];
        if (typeof value !== 'string' || value.trim() === '') {
            throw new Error(`Config validation failed: ${key} must be a non-empty string`);
        }
        return value.trim();
    }

    private static getBooleanOverride(object: Record<string, unknown>, key: string, envKey: string): boolean {
        if (process.env[envKey] !== undefined) {
            return String(process.env[envKey]).trim().toLowerCase() === 'true';
        }
        const value = object[key];
        if (typeof value !== 'boolean') {
            throw new Error(`Config validation failed: ${key} must be a boolean`);
        }
        return value;
    }

    private static getNumberOverride(object: Record<string, unknown>, key: string, envKey: string): number {
        if (process.env[envKey] !== undefined) {
            const parsed = Number(process.env[envKey]);
            if (!Number.isFinite(parsed) || parsed < 0) {
                throw new Error(`Config validation failed: ${envKey} must be a valid non-negative number`);
            }
            return parsed;
        }
        const value = object[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
            throw new Error(`Config validation failed: ${key} must be a valid non-negative number`);
        }
        return value;
    }

    static getProperty<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
        return ConfigReader.get()[key];
    }

}
