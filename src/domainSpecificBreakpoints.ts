import * as vscode from 'vscode';
import { BreakpointType, GetBreakpointTypesResponse } from './DAPExtension';
import { LeafTreeItem, TreeDataProvider, TreeItem } from './treeItem';

/**
 * Data provider for the 'Domain-Specific Breakpoints' view.
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
            breakpointType.isEnabled,
            this,
            breakpointType.description,
            breakpointType.targetElementTypeId
        ));
    }

    public get enabledBreakpointTypesIds(): Set<string> {
        return this._enabledBreakpointTypesIds;
    }
}

/**
 * Leaf item for the 'Domain-Specific Breakpoints' view.
 */
export class DomainSpecificBreakpointTypeTreeItem extends LeafTreeItem {
    readonly typeId: string;
    readonly targetElementTypeId: string | undefined;

    constructor(typeId: string, name: string, isEnabled: boolean, provider: DomainSpecificBreakpointsProvider, description?: string, targetElementTypeId?: string) {
        let formattedDescription: string = targetElementTypeId == undefined ? `No target type.` : `Target type: ${targetElementTypeId}.`;
        if (description !== undefined) formattedDescription = `${formattedDescription} ${description}`;

        super(name, isEnabled, provider, formattedDescription);
        this.typeId = typeId;
        this.targetElementTypeId = targetElementTypeId;
    }

    public get provider(): DomainSpecificBreakpointsProvider {
        return this._provider as DomainSpecificBreakpointsProvider;
    }
} 