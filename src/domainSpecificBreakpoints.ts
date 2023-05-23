import * as vscode from 'vscode';
import { BreakpointType, GetBreakpointTypesResponse } from './dapExtension';

export class DomainSpecificBreakpointsProvider implements vscode.TreeDataProvider<DomainSpecificBreakpointsTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData?: vscode.Event<void | DomainSpecificBreakpointsTreeItem | DomainSpecificBreakpointsTreeItem[] | null | undefined> = this._onDidChangeTreeData.event;
    
    // Stores the ids of the currently enabled breakpoint types
    enabledBreakpointTypeIds: Set<string> = new Set();

    public async getChildren(element?: DomainSpecificBreakpointsTreeItem | undefined): Promise<vscode.ProviderResult<DomainSpecificBreakpointsTreeItem[]>> {
        if (element) return element.getChildren();

        while (!vscode.debug.activeDebugSession) await new Promise<void>(resolve => setTimeout(() => {
            resolve()
        }, 200));

        const response: GetBreakpointTypesResponse = await vscode.debug.activeDebugSession?.customRequest('getBreakpointTypes');
        const breakpointTypes: BreakpointType[] = response.breakpointTypes;
        this.enabledBreakpointTypeIds = new Set(breakpointTypes.filter(breakpointType => breakpointType.isEnabled).map(breakpointType => breakpointType.id));

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

    public getTreeItem(element: DomainSpecificBreakpointsTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    public refresh(item: DomainSpecificBreakpointsTreeItem | undefined): void {
        this._onDidChangeTreeData.fire(item);
    }
}


export abstract class DomainSpecificBreakpointsTreeItem extends vscode.TreeItem {
    private provider: DomainSpecificBreakpointsProvider;

    constructor(label: string | vscode.TreeItemLabel, provider: DomainSpecificBreakpointsProvider, collapsibleState?: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
        this.provider = provider;
    }

    abstract getChildren(): DomainSpecificBreakpointsTreeItemChildren;

    public refresh(): void {
        this.provider.refresh(undefined);
    }
}


export class DomainSpecificBreakpointTypeFolderTreeItem extends DomainSpecificBreakpointsTreeItem {
    private breakpointTypes: DomainSpecificBreakpointTypeTreeItem[];

    constructor(name: string, breakpointTypes: DomainSpecificBreakpointTypeTreeItem[], provider: DomainSpecificBreakpointsProvider) {
        super(name, provider, vscode.TreeItemCollapsibleState.Collapsed);
        this.breakpointTypes = breakpointTypes;
    }

    public getChildren(): DomainSpecificBreakpointsTreeItemChildren {
        return this.breakpointTypes;
    }
}


export class DomainSpecificBreakpointTypeTreeItem extends DomainSpecificBreakpointsTreeItem {
    readonly typeId: string;
    readonly targetElementTypeId: string;

    constructor(typeId: string, name: string, targetElementTypeId: string, description: string, isEnabled: boolean, provider: DomainSpecificBreakpointsProvider) {
        super(name, provider, vscode.TreeItemCollapsibleState.None);
        this.typeId = typeId;
        this.targetElementTypeId = targetElementTypeId;
        this.description = `Target type: ${targetElementTypeId}. ${description}`;
        this.contextValue = isEnabled ? 'enabledBreakpointType' : 'disabledBreakpointType';
    }

    public getChildren(): DomainSpecificBreakpointsTreeItemChildren {
        return undefined;
    }
}

type DomainSpecificBreakpointsTreeItemChildren = DomainSpecificBreakpointTypeTreeItem[] | null | undefined;