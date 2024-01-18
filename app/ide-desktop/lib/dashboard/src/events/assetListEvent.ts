/** @file Events related to changes in the asset list. */
import type AssetListEventType from '#/events/AssetListEventType'
import type * as backend from '#/services/backend'

import type * as spinner from '#/components/Spinner'

// This is required, to whitelist this event.
// eslint-disable-next-line no-restricted-syntax
declare module '#/hooks/eventHooks' {
    /** A map containing all known event types. */
    export interface KnownEventsMap {
        readonly assetListEvent: AssetListEvent
    }
}

// ======================
// === AssetListEvent ===
// ======================

/** Properties common to all asset list events. */
interface AssetListBaseEvent<Type extends AssetListEventType> {
    readonly type: Type
}

/** All possible events. */
interface AssetListEvents {
    readonly newFolder: AssetListNewFolderEvent
    readonly newProject: AssetListNewProjectEvent
    readonly uploadFiles: AssetListUploadFilesEvent
    readonly newDataConnector: AssetListNewDataConnectorEvent
    readonly closeFolder: AssetListCloseFolderEvent
    readonly copy: AssetListCopyEvent
    readonly move: AssetListMoveEvent
    readonly willDelete: AssetListWillDeleteEvent
    readonly delete: AssetListDeleteEvent
    readonly removeSelf: AssetListRemoveSelfEvent
}

/** A type to ensure that {@link AssetListEvents} contains every {@link AssetListEventType}. */
// This is meant only as a sanity check, so it is allowed to break lint rules.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type SanityCheck<
    T extends {
        readonly [Type in keyof typeof AssetListEventType]: AssetListBaseEvent<
            (typeof AssetListEventType)[Type]
        >
    } = AssetListEvents,
    // eslint-disable-next-line no-restricted-syntax
> = T

/** A signal to create a new directory. */
interface AssetListNewFolderEvent extends AssetListBaseEvent<AssetListEventType.newFolder> {
    readonly parentKey: backend.DirectoryId
    readonly parentId: backend.DirectoryId
}

/** A signal to create a new project. */
interface AssetListNewProjectEvent extends AssetListBaseEvent<AssetListEventType.newProject> {
    readonly parentKey: backend.DirectoryId
    readonly parentId: backend.DirectoryId
    readonly templateId: string | null
    readonly onSpinnerStateChange: ((state: spinner.SpinnerState) => void) | null
}

/** A signal to upload files. */
interface AssetListUploadFilesEvent extends AssetListBaseEvent<AssetListEventType.uploadFiles> {
    readonly parentKey: backend.DirectoryId
    readonly parentId: backend.DirectoryId
    readonly files: File[]
}

/** A signal to create a new data connector. */
interface AssetListNewDataConnectorEvent
    extends AssetListBaseEvent<AssetListEventType.newDataConnector> {
    readonly parentKey: backend.DirectoryId
    readonly parentId: backend.DirectoryId
    readonly name: string
    readonly value: string
}

/** A signal to close (collapse) a folder. */
interface AssetListCloseFolderEvent extends AssetListBaseEvent<AssetListEventType.closeFolder> {
    readonly id: backend.DirectoryId
    readonly key: backend.DirectoryId
}

/** A signal that files should be copied. */
interface AssetListCopyEvent extends AssetListBaseEvent<AssetListEventType.copy> {
    readonly newParentKey: backend.AssetId
    readonly newParentId: backend.DirectoryId
    readonly items: backend.AnyAsset[]
}

/** A signal that a file has been moved. */
interface AssetListMoveEvent extends AssetListBaseEvent<AssetListEventType.move> {
    readonly key: backend.AssetId
    readonly newParentKey: backend.AssetId
    readonly newParentId: backend.DirectoryId
    readonly item: backend.AnyAsset
}

/** A signal that a file has been deleted. */
interface AssetListWillDeleteEvent extends AssetListBaseEvent<AssetListEventType.willDelete> {
    readonly key: backend.AssetId
}

/** A signal that a file has been deleted. This must not be called before the request is
 * finished. */
interface AssetListDeleteEvent extends AssetListBaseEvent<AssetListEventType.delete> {
    readonly key: backend.AssetId
}

/** A signal for a file to remove itself from the asset list, without being deleted. */
interface AssetListRemoveSelfEvent extends AssetListBaseEvent<AssetListEventType.removeSelf> {
    readonly id: backend.AssetId
}

/** Every possible type of asset list event. */
export type AssetListEvent = AssetListEvents[keyof AssetListEvents]
