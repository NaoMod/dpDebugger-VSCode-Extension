import * as vscode from 'vscode';
import { BreakpointType, GetBreakpointTypesResponse } from './DAPExtension';
import { FolderTreeItem, LeafTreeItem, TreeDataProvider, TreeItem } from './treeItem';

/**
 * Data provider for the domain-specific breakpoints view.
 */
export class DomainSpecificBreakpointsProvider extends TreeDataProvider {
    // Stores the ids of the currently enabled breakpoint types
    private _enabledBreakpointTypesIds: Set<string> = new Set();

    public async getChildren(element?: TreeItem | undefined): Promise<TreeItem[] | null | undefined> {
        if (element) return element.getChildren();

        while (!vscode.debug.activeDebugSession) await new Promise<void>(resolve => setTimeout(() => {
            resolve()
        }, 200));

        const response: GetBreakpointTypesResponse = await vscode.debug.activeDebugSession?.customRequest('getBreakpointTypes');
        const breakpointTypes: BreakpointType[] = response.breakpointTypes;
        this._enabledBreakpointTypesIds = new Set(breakpointTypes.filter(breakpointType => breakpointType.isEnabled).map(breakpointType => breakpointType.id));

        return [
            new DomainSpecificBreakpointTypeFolderTreeItem('Enabled', breakpointTypes.filter(breakpointType => breakpointType.isEnabled).map(breakpointType => new DomainSpecificBreakpointTypeTreeItem(
                breakpointType.id,
                breakpointType.name,
                breakpointType.targetElementTypeId,
                breakpointType.description,
                true,
                this
            )), this),
            new DomainSpecificBreakpointTypeFolderTreeItem('Disabled', breakpointTypes.filter(breakpointType => !breakpointType.isEnabled).map(breakpointType => new DomainSpecificBreakpointTypeTreeItem(
                breakpointType.id,
                breakpointType.name,
                breakpointType.targetElementTypeId,
                breakpointType.description,
                false,
                this
            )), this),
        ]
    }

    public get enabledBreakpointTypesIds() : Set<string> {
        return this._enabledBreakpointTypesIds;
    }
}

/**
 * Folder for the domain-specific breakpoints view.
 */
export class DomainSpecificBreakpointTypeFolderTreeItem extends FolderTreeItem<DomainSpecificBreakpointTypeTreeItem> {
    constructor(name: string, breakpointTypes: DomainSpecificBreakpointTypeTreeItem[], provider: DomainSpecificBreakpointsProvider) {
        super(name, breakpointTypes, provider);
    }
}

/**
 * Leaf item for the domain-specific breakpoints view.
 */
export class DomainSpecificBreakpointTypeTreeItem extends LeafTreeItem {
    readonly typeId: string;
    readonly targetElementTypeId: string;

    constructor(typeId: string, name: string, targetElementTypeId: string, description: string, isEnabled: boolean, provider: DomainSpecificBreakpointsProvider) {
        super(name, provider);
        this.typeId = typeId;
        this.targetElementTypeId = targetElementTypeId;
        this.description = `Target type: ${targetElementTypeId}. ${description}`;
        this.contextValue = isEnabled ? 'enabledBreakpointType' : 'disabledBreakpointType';
    }

    public get provider(): DomainSpecificBreakpointsProvider {
        return this._provider as DomainSpecificBreakpointsProvider;
    }
} 