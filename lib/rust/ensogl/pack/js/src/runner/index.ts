/** @file Runner for the code generated by `ensogl-pack`. It is responsible for downloading and
 * compiling WASM, displaying loading and help screens, and configuring the application. */

import * as dom from 'runner/dom/dom'
import * as name from 'runner/name'
import * as log from 'runner/log'
import * as wasm from 'runner/wasm'
import * as config from 'runner/config'
import * as array from 'runner/data/array'
import * as debug from 'runner/debug'

import host from 'runner/host'
import { logger } from 'runner/log'
import { sortedWasmFunctions } from 'runner/wasm'
import { HelpScreenSection } from 'runner/debug'

// ===============
// === Exports ===
// ===============

export { log }
export { config }
export type { LogLevel } from 'runner/log/logger'

export { logger, Logger, Consumer } from 'runner/log'
export { Option } from 'runner/config'

// ==============================
// === Files to be downloaded ===
// ==============================

/** Files that are downloaded from server during app startup. */
class Files<T> {
    /** Main JS file that is responsible for initializing and compiling WASM. */
    pkgJs: T
    /** Main WASM file that contains the compiled WASM code. */
    pkgWasm: T
    /** Dynamic assets. */
    assets: T[]

    constructor(pkgJs: T, pkgWasm: T, assets: T[]) {
        this.pkgJs = pkgJs
        this.pkgWasm = pkgWasm
        this.assets = assets
    }

    async mapAndAwaitAll<S>(f: (t: T) => Promise<S>): Promise<Files<S>> {
        const mapped = await Promise.all(this.toArray().map(f))
        const out = this.fromArray(mapped)
        if (out != null) {
            return out
        } else {
            log.panic()
        }
    }

    /** Converts the structure fields to an array. */
    toArray(): T[] {
        return [this.pkgJs, this.pkgWasm, ...this.assets]
    }

    /** Assign array values to the structure fields. The elements order should be the same as the
     * output of the `toArray` function. */
    fromArray<S>(array: S[]): Files<S> | null {
        const [pkgJs, pkgWasm, ...assets] = array
        if (pkgJs != null && pkgWasm != null) {
            return new Files<S>(pkgJs, pkgWasm, assets)
        } else {
            return null
        }
    }
}

class AssetDefinition {
    dir: string
    files: string[]

    constructor(dir: string, files: string[]) {
        this.dir = dir
        this.files = files
    }
}

class Assets<T> {
    assets: Asset<T>[]

    constructor(assets: Asset<T>[]) {
        this.assets = assets
    }

    async mapAndAwaitAll<S>(f: (t: T) => Promise<S>): Promise<Assets<S>> {
        const assets = await Promise.all(this.assets.map(asset => asset.mapAndAwaitAll(f)))
        return new Assets(assets)
    }
}

class Asset<T> {
    type: string
    key: string
    data: Map<string, T>

    constructor(type: string, key: string, data: Map<string, T>) {
        this.type = type
        this.key = key
        this.data = data
    }

    async mapAndAwaitAll<S>(f: (t: T) => Promise<S>): Promise<Asset<S>> {
        const mapValue: ([k, v]: [string, T]) => Promise<[string, S]> = async ([k, v]) => [
            k,
            await f(v),
        ]
        const data = new Map(await Promise.all(Array.from(this.data, mapValue)))
        return new Asset(this.type, this.key, data)
    }
}

// ===========
// === App ===
// ===========

/** Preferred frame time for the `Scheduler`. */
const FRAME_TIME_MS = 16

/** A task scheduler used to run tasks in the next animation frame if the current animation frame is
 * running too long. */
class Scheduler {
    done: Promise<void>
    doneResolve: () => void = () => {}
    time: DOMHighResTimeStamp = 0
    tasks: (() => void)[] = []

    constructor() {
        this.done = new Promise(resolve => {
            this.doneResolve = resolve
        })
    }

    add(task: () => void) {
        this.tasks.push(task)
    }

    run(): Promise<void> {
        if (host.node) {
            for (const task of this.tasks) {
                task()
            }
            this.doneResolve()
        } else {
            this.onFrame()
        }
        return this.done
    }

    onFrame() {
        for (;;) {
            const time = window.performance.now()
            const delta = time - this.time
            if (delta > FRAME_TIME_MS) {
                break
            }
            const task = this.tasks.shift()
            if (task != null) {
                task()
            } else {
                this.doneResolve()
                break
            }
        }
        if (this.tasks.length === 0) {
            this.doneResolve()
        } else {
            this.time = window.performance.now()
            window.requestAnimationFrame(this.onFrame.bind(this))
        }
    }
}

// ===========
// === App ===
// ===========

/** The main application class. */
export class App {
    packageInfo: debug.PackageInfo
    config: config.Options
    wasm: any = null
    loader: wasm.Loader | null = null
    assets: Assets<ArrayBuffer> | null = null
    wasmFunctions: string[] = []
    beforeMainEntryPoints = new Map<string, wasm.BeforeMainEntryPoint>()
    mainEntryPoints = new Map<string, wasm.EntryPoint>()
    progressIndicator: wasm.ProgressIndicator | null = null
    initialized = false

    constructor(opts?: {
        configOptions?: config.Options
        packageInfo?: Record<string, string>
        config?: config.StringConfig
    }) {
        this.packageInfo = new debug.PackageInfo(opts?.packageInfo ?? {})
        this.config = config.options
        const unrecognized = log.Task.runCollapsed('Resolving application configuration.', () => {
            const inputConfig = opts?.configOptions
            if (inputConfig != null) {
                this.config = inputConfig
            }
            logger.log(this.config.prettyPrint())
            return this.config.loadAll([opts?.config, host.urlParams()])
        })
        if (unrecognized.length > 0) {
            logger.error(`Unrecognized configuration parameters: ${unrecognized.join(', ')}.`)
            this.showConfigOptions(unrecognized)
        } else {
            this.initBrowser()
            this.initialized = true
        }
        // Export the app to a global variable, so Rust can access it.
        host.exportGlobal({ ensoglApp: this })
    }

    /** Registers the Rust function that extracts asset source files. */
    registerGetDynamicAssetsSourcesRustFn(fn: GetAssetsSourcesFn) {
        logger.log(`Registering 'getAssetsSourcesFn'.`)
        rustGetAssetsSourcesFn = fn
    }

    /** Registers the Rust function that injects dynamic assets. */
    registerSetDynamicAssetRustFn(fn: SetAssetFn) {
        logger.log(`Registering 'setAssetFn'.`)
        rustSetAssetFn = fn
    }

    /** Log the message on the remote server. */
    remoteLog(message: string, data: any) {
        // TODO: Implement remote logging. This should be done after cloud integration.
    }

    /** Initialize the browser. Set the background color, print user-facing warnings, etc. */
    initBrowser() {
        if (host.browser) {
            this.styleRoot()
            dom.disableContextMenu()
            if (this.config.options.debug.value) {
                logger.log('Application is run in debug mode. Logs will not be hidden.')
            } else {
                this.printScamWarning()
                log.router.hideLogs()
            }
        }
    }

    /** Set the background color of the root element. */
    styleRoot() {
        const root = document.getElementById('root')
        if (root != null) {
            root.style.backgroundColor = 'rgb(234,238,241)'
        }
    }

    /** Runs the application. It will initialize DOM elements, display a loader, run before main
     * entry points and the main entry point. It will also list available entry points if the
     * provided entry point is missing. */
    async run(): Promise<void> {
        if (!this.initialized) {
            logger.log("App wasn't initialized properly. Skipping run.")
        } else {
            await this.loadAndInitWasm()
            await this.runEntryPoints()
        }
    }

    /** Compiles and runs the downloaded WASM file. */
    async compileAndRunWasm(pkgJs: string, wasm: Buffer | Response): Promise<unknown> {
        return await log.Task.asyncRunNoGroup<unknown>('WASM compilation', async () => {
            /* eslint @typescript-eslint/no-implied-eval: "off" */
            /* eslint @typescript-eslint/no-unsafe-assignment: "off" */
            const snippetsFn: any = Function(
                // A hack to make Emscripten output load correctly (e.g. 'msdf-gen'). Emscripten
                // generates a code which overrides `module.exports` after checking if the code
                // is run in node. The check is performed by checking the values of `process`.
                // Setting it to something else prevents the code from running.
                `const process = "Overridden to prevent Emscripten from redefining module.exports."
                 const module = {}
                 ${pkgJs}
                 return module.exports`
            )()
            const out: unknown = await snippetsFn.init(wasm)
            if (this.config.groups.debug.options.enableSpector.value) {
                /* eslint @typescript-eslint/no-unsafe-member-access: "off" */
                /* eslint @typescript-eslint/no-unsafe-call: "off" */
                if (host.browser) {
                    const spectorModule: unknown = snippetsFn.spector()
                    console.log(spectorModule)
                    // @ts-ignore
                    const spector = new spectorModule.Spector()
                    // @ts-ignore
                    spector.displayUI()
                }
            }
            return out
        })
    }

    /** Download and load the WASM to memory. */
    async loadWasm() {
        const loader = new wasm.Loader(this.config)

        const assetsUrl = this.config.groups.loader.options.assetsUrl.value
        const manifest = await log.Task.asyncRunCollapsed(
            'Downloading assets manifest.',
            async () => {
                const manifestResponse = await fetch(`${assetsUrl}/manifest.json`)
                const manifest: Record<
                    string,
                    Record<string, AssetDefinition>
                > = await manifestResponse.json()
                return manifest
            }
        )
        const assetsUrls: string[] = []
        const assetsInfo: Asset<number>[] = []
        for (const [type, typeAssets] of Object.entries(manifest)) {
            for (const [key, asset] of Object.entries(typeAssets)) {
                const toUrl = (name: string) => {
                    const index = assetsUrls.length
                    assetsUrls.push(`${assetsUrl}/${type}/${asset.dir}/${name}`)
                    return index
                }
                const urls = new Map(asset.files.map(name => [name, toUrl(name)]))
                assetsInfo.push(new Asset<number>(type, key, urls))
            }
        }
        const files = new Files(
            this.config.groups.loader.options.jsUrl.value,
            this.config.groups.loader.options.wasmUrl.value,
            assetsUrls
        )

        const responses = await files.mapAndAwaitAll(url => fetch(url))
        loader.load(responses.toArray())
        const downloadSize = loader.showTotalBytes()
        const task = log.Task.startCollapsed(`Downloading application files (${downloadSize}).`)

        void loader.done.then(() => task.end())
        const assetsResponses = responses.assets
        const assetsBlobs = await Promise.all(
            assetsResponses.map(response => response.blob().then(blob => blob.arrayBuffer()))
        )
        const assets = assetsInfo.map(info => {
            const data = new Map(Array.from(info.data, ([k, i]) => [k, assetsBlobs[i]!]))
            return new Asset(info.type, info.key, data)
        })

        const pkgJs = await responses.pkgJs.text()
        this.loader = loader
        this.wasm = await this.compileAndRunWasm(pkgJs, responses.pkgWasm)
        this.assets = new Assets(assets)
    }

    /** Loads the WASM binary and its dependencies. After the files are fetched, the WASM module is
     * compiled and initialized. */
    async loadAndInitWasm() {
        await this.loadWasm()
        this.wasmFunctions = wasm.sortedWasmFunctions(this.wasm)
        this.beforeMainEntryPoints = wasm.BeforeMainEntryPoint.fromNames(this.wasmFunctions)
        this.mainEntryPoints = wasm.EntryPoint.fromNames(this.wasmFunctions)
        this.packageInfo.display()
    }

    /** Run all before main entry points. See the docs of `wasm.entryPoint` to learn more. */
    async runBeforeMainEntryPoints(): Promise<void> {
        const count = this.beforeMainEntryPoints.size
        const scheduler = new Scheduler()
        if (this.beforeMainEntryPoints.size) {
            for (const entryPoint of this.beforeMainEntryPoints.values()) {
                scheduler.add(() => {
                    log.Task.runTimed(`Running entry point '${entryPoint.displayName()}'.`, () => {
                        const fn = this.wasm[entryPoint.name()]
                        if (fn != null) {
                            fn()
                        } else {
                            logger.internalError(`Entry point not found.`)
                        }
                    })
                })
            }
        }
        const [time] = await log.Task.asyncRunCollapsedTimed(
            `Running ${count} before main entry points.`,
            async () => {
                return await scheduler.run()
            }
        )
        this.checkBeforeMainEntryPointsTime(time)
    }

    /** Check whether the time needed to run before main entry points is reasonable. Print a warning
     * message otherwise. */
    checkBeforeMainEntryPointsTime(time: number) {
        if (time > this.config.groups.startup.options.maxBeforeMainTimeMs.value) {
            logger.error(
                `Entry points took ${time} milliseconds to run. This is too long. ` +
                    'Before main entry points should be used for fast initialization only.'
            )
        }
    }

    /** Show a spinner. The displayed progress is constant. */
    showProgressIndicator(progress: number) {
        if (this.progressIndicator) {
            this.hideProgressIndicator()
        }
        this.progressIndicator = new wasm.ProgressIndicator(this.config)
        this.progressIndicator.set(progress)
    }

    /** Hide the progress indicator. */
    hideProgressIndicator() {
        if (this.progressIndicator) {
            // Setting the progress to 100% is necessary to allow animation to finish.
            this.progressIndicator.set(1)
            this.progressIndicator.destroy()
            this.progressIndicator = null
        }
    }

    /** Run both before-main entry points and main entry point. */
    async runEntryPoints() {
        const entryPointName = this.config.groups.startup.options.entry.value
        const entryPoint = this.mainEntryPoints.get(entryPointName)
        if (entryPoint) {
            await this.runBeforeMainEntryPoints()
            log.Task.runCollapsed(`Sending dynamic assets to Rust.`, () => {
                if (this.assets) {
                    for (const asset of this.assets.assets) {
                        this.setAsset(asset.type, asset.key, asset.data)
                    }
                }
            })
            if (this.loader) this.loader.destroy()
            logger.log(`Running the main entry point '${entryPoint.displayName()}'.`)
            const fn = this.wasm[entryPoint.name()]
            if (fn != null) {
                fn()
            } else {
                logger.internalError(`Entry point not found.`)
            }
        } else {
            if (this.loader) this.loader.destroy()
            this.showEntryPointSelector(entryPointName)
        }
    }

    /// Displays a debug screen which allows the user to run one of predefined debug examples.
    showEntryPointSelector(unknownEntryPoint?: string) {
        logger.log('Showing entry point selection help screen.')
        const msg = unknownEntryPoint ? `Unknown entry point '${unknownEntryPoint}'. ` : ''
        const title = msg + 'Available entry points:'
        const entries = Array.from(this.mainEntryPoints.values()).map(entryPoint => {
            // FIXME: Currently, this does not work. It should be fixed by wasm-bindgen or wasm-pack
            //     team. See: https://github.com/rustwasm/wasm-bindgen/issues/3224
            /* eslint @typescript-eslint/no-unsafe-assignment: "off" */
            const docsFn = this.wasm[entryPoint.docsFnName()]
            let description = 'No description.'
            if (docsFn) {
                const rustDocs = docsFn()
                if (rustDocs) {
                    description = rustDocs
                }
            }
            const href = '?startup.entry=' + entryPoint.strippedName
            return new debug.HelpScreenEntry(entryPoint.strippedName, [description], href)
        })
        const name = 'Entry points'
        const sections = [new debug.HelpScreenSection({ name, entries })]

        const headers = ['Name', 'Description']
        new debug.HelpScreen().display({ title, headers, sections })
    }

    showConfigOptions(unknownOptions?: string[]) {
        logger.log('Showing config options help screen.')
        let msg = ''
        if (unknownOptions) {
            const optionLabel = unknownOptions.length > 1 ? 'options' : 'option'
            msg = `Unknown config ${optionLabel}: ${unknownOptions.map(t => `'${t}'`).join(', ')}. `
        }
        const sectionsData: [string, string, debug.HelpScreenEntry[]][] = Object.entries(
            this.config.groups
        ).map(([groupName, group]) => {
            const groupOptions = group.optionsRecursive()
            const entriesData: [string, string, string][] = groupOptions.map(opt => [
                opt.qualifiedName(),
                opt.description,
                String(opt.default),
            ])
            entriesData.sort()
            const entries = entriesData.map(([name, description, def]) => {
                return new debug.HelpScreenEntry(name, [description, def])
            })
            const option = this.config.options[groupName]
            if (option != null) {
                const entry = new debug.HelpScreenEntry(groupName, [
                    option.description,
                    String(option.default),
                ])
                entries.unshift(entry)
            }
            const name =
                groupName.charAt(0).toUpperCase() +
                groupName.slice(1).replace(/([A-Z])/g, ' $1') +
                ' Options'
            const description = group.description
            return [name, description, entries]
        })
        sectionsData.sort()
        const sections = sectionsData.map(
            ([name, description, entries]) =>
                new debug.HelpScreenSection({ name, description, entries })
        )

        const rootEntries = Object.entries(this.config.options).flatMap(([optionName, option]) => {
            if (optionName in this.config.groups) {
                return []
            }
            const entry = new debug.HelpScreenEntry(optionName, [
                option.description,
                String(option.default),
            ])
            return [entry]
        })
        if (rootEntries.length > 0) {
            const name = 'Other Options'
            sections.push(new debug.HelpScreenSection({ name, entries: rootEntries }))
        }

        const title = msg + 'Available options:'
        const headers = ['Name', 'Description', 'Default']
        new debug.HelpScreen().display({ title, headers, sections })
    }

    /** Print the warning for the end user that they should not copy any code to the console. */
    printScamWarning() {
        const headerCss = `
            color : white;
            background : crimson;
            display : block;
            border-radius : 8px;
            font-weight : bold;
            padding: 10px 20px 10px 20px;
        `
        const headerCss1 = headerCss + 'font-size : 46px;'
        const headerCss2 = headerCss + 'font-size : 20px;'
        const msgCSS = 'font-size:16px;'

        const msg1 =
            'This is a browser feature intended for developers. If someone told you to ' +
            'copy-paste something here, it is a scam and will give them access to your ' +
            'account and data.'
        const msg2 =
            'See https://github.com/enso-org/enso/blob/develop/docs/security/selfxss.md for more ' +
            'information.'
        console.log('%cStop!', headerCss1)
        console.log('%cYou may be victim of a scam!', headerCss2)
        console.log('%c' + msg1, msgCSS)
        console.log('%c' + msg2, msgCSS)
    }

    getAssetSources(): Map<string, Map<string, Map<string, ArrayBuffer>>> | null {
        return log.Task.run('Getting dynamic asset sources from Rust.', () => {
            if (!rustGetAssetsSourcesFn) {
                logger.error('The Rust dynamic asset sources function was not registered.')
                return null
            } else {
                const resultUnmangled = rustGetAssetsSourcesFn()
                const mangleKeys = <T>(map: Map<string, T>) =>
                    new Map(Array.from(map, ([key, value]) => [name.mangle(key), value]))
                const result = new Map(
                    Array.from(resultUnmangled, ([key, value]) => [key, mangleKeys(value)])
                )
                logger.log(`Got ${result.size} asset definitions.`)
                return result
            }
        })
    }

    setAsset(builder: string, keyMangled: string, data: Map<string, ArrayBuffer>) {
        if (!rustSetAssetFn) {
            logger.error('The Rust asset injection function was not registered.')
        } else {
            const key = name.unmangle(keyMangled)
            rustSetAssetFn(builder, key, data)
        }
    }
}

// ==========================
// === App Initialization ===
// ==========================

type GetAssetsSourcesFn = () => Map<string, Map<string, Map<string, ArrayBuffer>>>
type SetAssetFn = (builder: string, key: string, data: Map<string, ArrayBuffer>) => void

let rustGetAssetsSourcesFn: null | GetAssetsSourcesFn = null
let rustSetAssetFn: null | SetAssetFn = null
