/** @file Events related to changes in asset state. */
import type AssetEventType from '#/events/AssetEventType'
import type * as backendModule from '#/services/backend'

import type * as spinner from '#/components/Spinner'

// This is required, to whitelist this event.
// eslint-disable-next-line no-restricted-syntax
declare module '#/hooks/eventHooks' {
    /** A map containing all known event types. */
    export interface KnownEventsMap {
        readonly assetEvent: AssetEvent
    }
}

// ==================
// === AssetEvent ===
// ==================

/** Properties common to all asset state change events. */
interface AssetBaseEvent<Type extends AssetEventType> {
    readonly type: Type
}

/** All possible events. */
interface AssetEvents {
    readonly newProject: AssetNewProjectEvent
    readonly newFolder: AssetNewFolderEvent
    readonly uploadFiles: AssetUploadFilesEvent
    readonly newDataConnector: AssetNewDataConnectorEvent
    readonly openProject: AssetOpenProjectEvent
    readonly closeProject: AssetCloseProjectEvent
    readonly cancelOpeningAllProjects: AssetCancelOpeningAllProjectsEvent
    readonly copy: AssetCopyEvent
    readonly cut: AssetCutEvent
    readonly cancelCut: AssetCancelCutEvent
    readonly move: AssetMoveEvent
    readonly delete: AssetDeleteEvent
    readonly restore: AssetRestoreEvent
    readonly download: AssetDownloadEvent
    readonly downloadSelected: AssetDownloadSelectedEvent
    readonly removeSelf: AssetRemoveSelfEvent
    readonly temporarilyAddLabels: AssetTemporarilyAddLabelsEvent
    readonly temporarilyRemoveLabels: AssetTemporarilyRemoveLabelsEvent
    readonly addLabels: AssetAddLabelsEvent
    readonly removeLabels: AssetRemoveLabelsEvent
    readonly deleteLabel: AssetDeleteLabelEvent
}

/** A type to ensure that {@link AssetEvents} contains every {@link AssetEventType}. */
// This is meant only as a sanity check, so it is allowed to break lint rules.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type SanityCheck<
    T extends {
        readonly [Type in keyof typeof AssetEventType]: AssetBaseEvent<
            (typeof AssetEventType)[Type]
        >
    } = AssetEvents,
    // eslint-disable-next-line no-restricted-syntax
> = T

/** A signal to create a project. */
export interface AssetNewProjectEvent extends AssetBaseEvent<AssetEventType.newProject> {
    readonly placeholderId: backendModule.ProjectId
    readonly templateId: string | null
    readonly onSpinnerStateChange: ((state: spinner.SpinnerState) => void) | null
}

/** A signal to create a directory. */
export interface AssetNewFolderEvent extends AssetBaseEvent<AssetEventType.newFolder> {
    readonly placeholderId: backendModule.DirectoryId
}

/** A signal to upload files. */
export interface AssetUploadFilesEvent extends AssetBaseEvent<AssetEventType.uploadFiles> {
    readonly files: Map<backendModule.AssetId, File>
}

/** A signal to create a data connector. */
export interface AssetNewDataConnectorEvent
    extends AssetBaseEvent<AssetEventType.newDataConnector> {
    readonly placeholderId: backendModule.SecretId
    readonly value: string
}

/** A signal to open the specified project. */
export interface AssetOpenProjectEvent extends AssetBaseEvent<AssetEventType.openProject> {
    readonly id: backendModule.ProjectId
    readonly shouldAutomaticallySwitchPage: boolean
    readonly runInBackground: boolean
}

/** A signal to close the specified project. */
export interface AssetCloseProjectEvent extends AssetBaseEvent<AssetEventType.closeProject> {
    readonly id: backendModule.ProjectId
}

/** A signal to cancel automatically opening any project that is currently opening. */
export interface AssetCancelOpeningAllProjectsEvent
    extends AssetBaseEvent<AssetEventType.cancelOpeningAllProjects> {}

/** A signal that multiple assets should be copied. `ids` are the `Id`s of the newly created
 * placeholder items. */
export interface AssetCopyEvent extends AssetBaseEvent<AssetEventType.copy> {
    readonly ids: Set<backendModule.AssetId>
    readonly newParentKey: backendModule.AssetId
    readonly newParentId: backendModule.DirectoryId
}

/** A signal to cut multiple assets. */
export interface AssetCutEvent extends AssetBaseEvent<AssetEventType.cut> {
    readonly ids: Set<backendModule.AssetId>
}

/** A signal that a cut operation has been cancelled. */
export interface AssetCancelCutEvent extends AssetBaseEvent<AssetEventType.cancelCut> {
    readonly ids: Set<backendModule.AssetId>
}

/** A signal to move multiple assets. */
export interface AssetMoveEvent extends AssetBaseEvent<AssetEventType.move> {
    readonly ids: Set<backendModule.AssetId>
    readonly newParentKey: backendModule.AssetId
    readonly newParentId: backendModule.DirectoryId
}

/** A signal to delete assets. */
export interface AssetDeleteEvent extends AssetBaseEvent<AssetEventType.delete> {
    readonly ids: Set<backendModule.AssetId>
}

/** A signal to restore assets from trash. */
export interface AssetRestoreEvent extends AssetBaseEvent<AssetEventType.restore> {
    readonly ids: Set<backendModule.AssetId>
}

/** A signal to download assets. */
export interface AssetDownloadEvent extends AssetBaseEvent<AssetEventType.download> {
    readonly ids: Set<backendModule.AssetId>
}

/** A signal to download the currently selected assets. */
export interface AssetDownloadSelectedEvent
    extends AssetBaseEvent<AssetEventType.downloadSelected> {}

/** A signal to remove the current user's permissions for an asset. */
export interface AssetRemoveSelfEvent extends AssetBaseEvent<AssetEventType.removeSelf> {
    readonly id: backendModule.AssetId
}

/** A signal to temporarily add labels to the selected assetss. */
export interface AssetTemporarilyAddLabelsEvent
    extends AssetBaseEvent<AssetEventType.temporarilyAddLabels> {
    readonly ids: Set<backendModule.AssetId>
    readonly labelNames: ReadonlySet<backendModule.LabelName>
}

/** A signal to temporarily remove labels from the selected assetss. */
export interface AssetTemporarilyRemoveLabelsEvent
    extends AssetBaseEvent<AssetEventType.temporarilyRemoveLabels> {
    readonly ids: Set<backendModule.AssetId>
    readonly labelNames: ReadonlySet<backendModule.LabelName>
}

/** A signal to add labels to the selected assetss. */
export interface AssetAddLabelsEvent extends AssetBaseEvent<AssetEventType.addLabels> {
    readonly ids: Set<backendModule.AssetId>
    readonly labelNames: ReadonlySet<backendModule.LabelName>
}

/** A signal to remove labels from the selected assetss. */
export interface AssetRemoveLabelsEvent extends AssetBaseEvent<AssetEventType.removeLabels> {
    readonly ids: Set<backendModule.AssetId>
    readonly labelNames: ReadonlySet<backendModule.LabelName>
}

/** A signal to remove a label from all assets. */
export interface AssetDeleteLabelEvent extends AssetBaseEvent<AssetEventType.deleteLabel> {
    readonly labelName: backendModule.LabelName
}

/** Every possible type of asset event. */
export type AssetEvent = AssetEvents[keyof AssetEvents]
