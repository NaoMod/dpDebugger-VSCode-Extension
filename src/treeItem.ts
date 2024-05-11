import * as vscode from 'vscode';

/**
 * Data provider for a tree view.
 */
export abstract class TreeDataProvider implements vscode.TreeDataProvider<TreeItem<TreeDataProvider>> {
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData?: vscode.Event<void | TreeItem<TreeDataProvider> | TreeItem<TreeDataProvider>[] | null | undefined> = this._onDidChangeTreeData.event;

    public getTreeItem(element: TreeItem<TreeDataProvider>): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    /**
     * Refreshes the content of tree items.
     * 
     * @param item Tree item from which to start the refresh, undefined to refresh the entire tree. 
     */
    public refresh(item: TreeItem<TreeDataProvider> | undefined): void {
        this._onDidChangeTreeData.fire(item);
    }

    public abstract getChildren(element?: TreeItem<TreeDataProvider> | undefined): vscode.ProviderResult<TreeItem<TreeDataProvider>[]>;
}

/**
 * Item of a tree view.
 */
export abstract class TreeItem<T extends TreeDataProvider> extends vscode.TreeItem {
    protected _provider: T;

    constructor(label: string | vscode.TreeItemLabel, provider: T, collapsibleState?: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
        this._provider = provider;
    }

    /**
     * Returns the children of this item.
     */
    abstract getChildren(): vscode.ProviderResult<TreeItemChildren>;

    /**
     * Refreshes the content of this tree item.
     */
    public refresh(): void {
        this._provider.refresh(undefined);
    }
}

/**
 * Leaf item of a tree view, which has no children.
 */
export abstract class LeafTreeItem extends TreeItem<TreeDataProvider> {
    constructor(name: string, isEnabled: boolean, provider: TreeDataProvider, description?: string) {
        super(name, provider, vscode.TreeItemCollapsibleState.None);
        this.description = description;
        this.checkboxState = isEnabled ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
    }

    public getChildren(): vscode.ProviderResult<TreeItemChildren> {
        return undefined;
    }
}

type TreeItemChildren = TreeItem<TreeDataProvider>[] | null | undefined;