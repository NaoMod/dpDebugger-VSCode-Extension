import * as vscode from 'vscode';
import { BreakpointType, GetBreakpointTypesResponse } from './DAPExtension';
import { LeafTreeItem, TreeDataProvider, TreeItem } from './treeItem';

/**
 * Data provider for the domain-specific breakpoints view.
 */
export class DomainSpecificBreakpointsProvider extends TreeDataProvider {
    // Stores the ids of the currently enabled breakpoint types
    private _enabledBreakpointTypesIds: Set<string> = new Set();

    public async getChildren(element?: TreeItem | undefined): Promise<TreeItem[] | null | undefined> {
        if (!vscode.debug.activeDebugSession) return undefined;
        if (element) return element.getChildren();

        const response: GetBreakpointTypesResponse = await vscode.debug.activeDebugSession.customRequest('getBreakpointTypes');
        const breakpointTypes: BreakpointType[] = response.breakpointTypes;
        this._enabledBreakpointTypesIds = new Set(breakpointTypes.filter(breakpointType => breakpointType.isEnabled).map(breakpointType => breakpointType.id));

        return breakpointTypes.map(breakpointType => new DomainSpecificBreakpointTypeTreeItem(
            breakpointType.id,
            breakpointType.name,
            breakpointType.targetElementTypeId,
            breakpointType.description,
            breakpointType.isEnabled,
            this
        ));
    }

    public get enabledBreakpointTypesIds(): Set<string> {
        return this._enabledBreakpointTypesIds;
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
        this.checkboxState = isEnabled ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
    }

    public get provider(): DomainSpecificBreakpointsProvider {
        return this._provider as DomainSpecificBreakpointsProvider;
    }
} 