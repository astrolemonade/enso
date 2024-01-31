/** @file Globals defined outside of TypeScript files.
 * These are from variables defined at build time, environment variables,
 * monkeypatching on `window` and generated code. */
/// <reference types="vite/client" />

// This file is being imported for its types.
// eslint-disable-next-line no-restricted-syntax, @typescript-eslint/consistent-type-imports
import * as buildJson from './../../build.json' assert { type: 'json' }

// =============
// === Types ===
// =============

/** Nested configuration options with `string` values. */
interface StringConfig {
    [key: string]: StringConfig | string
}

/** The public interface exposed to `window` by the IDE. */
interface Enso {
    main: (inputConfig?: StringConfig) => Promise<void>
}

// ===================
// === Backend API ===
// ===================

/** `window.backendApi` is a context bridge to the main process, when we're running in an
 * Electron context. It contains non-authentication-related functionality. */
interface BackendApi {
    /** Return the ID of the new project. */
    importProjectFromPath: (openedPath: string) => Promise<string>
}

// ==========================
// === Authentication API ===
// ==========================

/** `window.authenticationApi` is a context bridge to the main process, when we're running in an
 * Electron context.
 *
 * # Safety
 *
 * We're assuming that the main process has exposed the `authenticationApi` context bridge (see
 * `lib/client/src/preload.ts` for details), and that it contains the functions defined in this
 * interface. Our app can't function if these assumptions are not met, so we're disabling the
 * TypeScript checks for this interface when we use it. */
interface AuthenticationApi {
    /** Open a URL in the system browser. */
    openUrlInSystemBrowser: (url: string) => void
    /** Set the callback to be called when the system browser redirects back to a URL in the app,
     * via a deep link. See `setDeepLinkHandler` for details. */
    setDeepLinkHandler: (callback: (url: string) => void) => void
    /** Saves the access token to a file. */
    saveAccessToken: (accessToken: string | null) => void
}

// =====================================
// === Global namespace augmentation ===
// =====================================

// JSDocs here are intentionally empty as these interfaces originate from elsewhere.
declare global {
    // Documentation is already inherited.
    /** */
    interface Window {
        enso?: AppRunner & Enso
        backendApi?: BackendApi
        authenticationApi: AuthenticationApi
    }

    namespace NodeJS {
        /** Environment variables. */
        interface ProcessEnv {
            readonly [key: string]: never
            // These are environment variables, and MUST be in CONSTANT_CASE.
            /* eslint-disable @typescript-eslint/naming-convention */
            // This is declared in `@types/node`. It MUST be re-declared here to suppress the error
            // about this property conflicting with the index signature above.
            // @ts-expect-error The index signature is intentional to disallow unknown env vars.
            TZ?: string
            // @ts-expect-error The index signature is intentional to disallow unknown env vars.
            APPLEID?: string
            // @ts-expect-error The index signature is intentional to disallow unknown env vars.
            APPLEIDPASS?: string
            // @ts-expect-error The index signature is intentional to disallow unknown env vars.
            APPLETEAMID?: string
            // Cloud environment variables.
            // @ts-expect-error The index signature is intentional to disallow unknown env vars.
            readonly ENSO_CLOUD_REDIRECT: string
            // @ts-expect-error The index signature is intentional to disallow unknown env vars.
            readonly ENSO_CLOUD_ENVIRONMENT: string
            // @ts-expect-error The index signature is intentional to disallow unknown env vars.
            readonly ENSO_CLOUD_API_URL?: string
            // @ts-expect-error The index signature is intentional to disallow unknown env vars.
            readonly ENSO_CLOUD_CHAT_URL?: string
            // @ts-expect-error The index signature is intentional to disallow unknown env vars.
            readonly ENSO_CLOUD_SENTRY_DSN?: string
            // @ts-expect-error The index signature is intentional to disallow unknown env vars.
            readonly ENSO_CLOUD_STRIPE_KEY?: string
            // @ts-expect-error The index signature is intentional to disallow unknown env vars.
            readonly ENSO_CLOUD_AMPLIFY_USER_POOL_ID?: string
            // @ts-expect-error The index signature is intentional to disallow unknown env vars.
            readonly ENSO_CLOUD_AMPLIFY_USER_POOL_WEB_CLIENT_ID?: string
            // @ts-expect-error The index signature is intentional to disallow unknown env vars.
            readonly ENSO_CLOUD_AMPLIFY_DOMAIN?: string
            // @ts-expect-error The index signature is intentional to disallow unknown env vars.
            readonly ENSO_CLOUD_AMPLIFY_REGION?: string
            /* eslint-enable @typescript-eslint/naming-convention */
        }
    }

    // These are used in other files (because they're globals)
    /* eslint-disable @typescript-eslint/naming-convention */
    const BUNDLED_ENGINE_VERSION: string
    const BUILD_INFO: buildJson.BuildInfo
    const PROJECT_MANAGER_IN_BUNDLE_PATH: string
    const IS_VITE: boolean
}
