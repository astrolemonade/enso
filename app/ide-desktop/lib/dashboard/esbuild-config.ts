/**
 * @file Configuration for the esbuild bundler and build/watch commands.
 *
 * The bundler processes each entry point into a single file, each with no external dependencies and
 * minified. This primarily involves resolving all imports, along with some other transformations
 * (like TypeScript compilation).
 *
 * See the bundlers documentation for more information:
 * https://esbuild.github.io/getting-started/#bundling-for-node.
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as url from 'node:url'

import * as esbuild from 'esbuild'
import * as esbuildPluginNodeModules from '@esbuild-plugins/node-modules-polyfill'
import esbuildPluginTime from 'esbuild-plugin-time'

import postcss from 'postcss'
import tailwindcss from 'tailwindcss'

import * as utils from '../../utils'

// =================
// === Constants ===
// =================

const THIS_PATH = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)))

// =============================
// === Environment variables ===
// =============================

export interface Arguments {
    /** Path where bundled files are output. */
    outputPath: string
    /** Directory with assets. Its contents are to be copied. */
    assetsPath: string
    /** `true` if in development mode (live-reload), `false` if in production mode. */
    devMode: boolean
}

/**
 * Get arguments from the environment.
 */
export function argumentsFromEnv(): Arguments {
    const assetsPath = utils.requireEnv('ENSO_BUILD_GUI_ASSETS')
    const outputPath = path.resolve(utils.requireEnv('ENSO_BUILD_GUI'), 'assets')
    return { assetsPath, outputPath, devMode: false }
}

// ======================
// === Inline plugins ===
// ======================

function esbuildPluginGenerateTailwind(): esbuild.Plugin {
    return {
        name: 'enso-generate-tailwind',
        setup: build => {
            interface CacheEntry {
                contents: string
                lastModified: number
            }
            // Required since `onStart` is called on every rebuild.
            let cachedOutput: Record<string, CacheEntry> = {}
            const tailwindPostcssPlugin = tailwindcss({
                config: path.resolve(THIS_PATH, 'tailwind.config.ts'),
            })
            const cssProcessor = postcss([tailwindPostcssPlugin])
            build.onLoad({ filter: /\.css$/ }, async loadArgs => {
                const lastModified = (await fs.stat(loadArgs.path)).mtimeMs
                let output = cachedOutput[loadArgs.path]
                if (!output || output.lastModified !== lastModified) {
                    console.log(`Processing CSS file '${loadArgs.path}'.`)
                    const result = await cssProcessor.process(
                        await fs.readFile(loadArgs.path, 'utf8'),
                        { from: loadArgs.path }
                    )
                    console.log(`Processed CSS file '${loadArgs.path}'.`)
                    output = { contents: result.css, lastModified }
                    cachedOutput[loadArgs.path] = output
                }
                return { contents: output.contents, loader: 'css' }
            })
        },
    }
}

// ================
// === Bundling ===
// ================

/** Generate the bundler options. */
export function bundlerOptions(args: Arguments) {
    const { outputPath } = args
    const buildOptions = {
        absWorkingDir: THIS_PATH,
        bundle: true,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        loader: { '.html': 'copy' },
        entryPoints: [path.resolve(THIS_PATH, 'src', 'tailwind.css')],
        outdir: outputPath,
        outbase: 'src',
        plugins: [
            esbuildPluginNodeModules.NodeModulesPolyfillPlugin(),
            esbuildPluginTime(),
            esbuildPluginGenerateTailwind(),
        ],
        define: {
            // We are defining a constant, so it should be `CONSTANT_CASE`.
            // eslint-disable-next-line @typescript-eslint/naming-convention
            IS_DEV_MODE: JSON.stringify(args.devMode),
        },
        sourcemap: true,
        minify: true,
        metafile: true,
        format: 'esm',
        platform: 'browser',
        color: true,
    } satisfies esbuild.BuildOptions
    // The narrower type is required to avoid non-null assertions elsewhere.
    // The intersection with `esbuild.BuildOptions` is required to allow mutation.
    const correctlyTypedBuildOptions: esbuild.BuildOptions & typeof buildOptions = buildOptions
    return correctlyTypedBuildOptions
}

/** ESBuild options for bundling (one-off build) the package.
 *
 * Relies on the environment variables to be set. */
export function bundleOptions() {
    return bundlerOptions(argumentsFromEnv())
}
