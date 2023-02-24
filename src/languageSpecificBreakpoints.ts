import * as vscode from 'vscode';
import { BreakpointType, GetBreakpointTypesResponse } from './DAPExtension';

export class LanguageSpecificBreakpointsProvider implements vscode.TreeDataProvider<LanguageSpecificBreakpointsTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData?: vscode.Event<void | LanguageSpecificBreakpointsTreeItem | LanguageSpecificBreakpointsTreeItem[] | null | undefined> | undefined = this._onDidChangeTreeData.event;

    public async getChildren(element?: LanguageSpecificBreakpointsTreeItem | undefined): Promise<vscode.ProviderResult<LanguageSpecificBreakpointsTreeItem[]>> {
        if (element) return element.getChildren();

        while (!vscode.debug.activeDebugSession) await new Promise<void>(resolve => setTimeout(() => {
            resolve()
        }, 200));

        const response: GetBreakpointTypesResponse = await vscode.debug.activeDebugSession?.customRequest('getBreakpointTypes');
        const breakpointTypes: BreakpointType[] = response.breakpointTypes;

        return [
            new LanguageSpecificBreakpointTypeFolderTreeItem('Enabled', breakpointTypes.filter(breakpointType => breakpointType.isEnabled).map(breakpointType => new LanguageSpecificBreakpointTypeTreeItem(
                breakpointType.id,
                breakpointType.name,
                breakpointType.targetElementTypeId,
                breakpointType.description,
                this
            )), this),
            new LanguageSpecificBreakpointTypeFolderTreeItem('Disabled', breakpointTypes.filter(breakpointType => !breakpointType.isEnabled).map(breakpointType => new LanguageSpecificBreakpointTypeTreeItem(
                breakpointType.id,
                breakpointType.name,
                breakpointType.targetElementTypeId,
                breakpointType.description,
                this
            )), this),
        ]
    }

    public getTreeItem(element: LanguageSpecificBreakpointsTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    public refresh(item: LanguageSpecificBreakpointsTreeItem | undefined): void {
        this._onDidChangeTreeData.fire(item);
    }
}


export abstract class LanguageSpecificBreakpointsTreeItem extends vscode.TreeItem {
    private provider: LanguageSpecificBreakpointsProvider;

    constructor(label: string | vscode.TreeItemLabel, provider: LanguageSpecificBreakpointsProvider, collapsibleState?: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
        this.provider = provider;
    }

    abstract getChildren(): LanguageSpecificBreakpointsTreeItem[] | null | undefined;

    public refresh(): void {
        this.provider.refresh(undefined);
    }
}


export class LanguageSpecificBreakpointTypeFolderTreeItem extends LanguageSpecificBreakpointsTreeItem {
    private breakpointTypes: LanguageSpecificBreakpointTypeTreeItem[];

    constructor(name: string, breakpointTypes: LanguageSpecificBreakpointTypeTreeItem[], provider: LanguageSpecificBreakpointsProvider) {
        super(name, provider, vscode.TreeItemCollapsibleState.Collapsed);
        this.breakpointTypes = breakpointTypes;
    }

    public getChildren(): LanguageSpecificBreakpointsTreeItem[] | null | undefined {
        return this.breakpointTypes;
    }
}


export class LanguageSpecificBreakpointTypeTreeItem extends LanguageSpecificBreakpointsTreeItem {
    readonly typeId: string;
    readonly targetElementTypeId: string;

    constructor(typeId: string, name: string, targetElementTypeId: string, description: string, provider: LanguageSpecificBreakpointsProvider) {
        super(name, provider, vscode.TreeItemCollapsibleState.None);
        this.typeId = typeId;
        this.targetElementTypeId = targetElementTypeId;
        this.description = `Target type: ${targetElementTypeId}. ${description}`;
        this.contextValue = 'breakpointType';
    }

    public getChildren(): LanguageSpecificBreakpointsTreeItem[] | null | undefined {
        return undefined;
    }
}

