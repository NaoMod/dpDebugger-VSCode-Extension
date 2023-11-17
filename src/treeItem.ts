import * as vscode from 'vscode';

/**
 * Data provider for a tree view.
 */
export abstract class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData?: vscode.Event<void | TreeItem | TreeItem[] | null | undefined> = this._onDidChangeTreeData.event;

    public getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    /**
     * Refreshes the content of tree items.
     * 
     * @param item Tree item from which to start the refresh, undefined to refresh the entire tree. 
     */
    public refresh(item: TreeItem | undefined): void {
        this._onDidChangeTreeData.fire(item);
    }

    public abstract getChildren(element?: TreeItem | undefined): vscode.ProviderResult<TreeItem[]>;
}

/**
 * Item of a tree view.
 */
export abstract class TreeItem extends vscode.TreeItem {
    protected _provider: TreeDataProvider;

    constructor(label: string | vscode.TreeItemLabel, provider: TreeDataProvider, collapsibleState?: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
        this._provider = provider;
    }

    /**
     * Returns the children of this item.
     */
    abstract getChildren(): TreeItemChildren;

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
export abstract class LeafTreeItem extends TreeItem {
    constructor(name: string, description: string, isEnabled: boolean, provider: TreeDataProvider) {
        super(name, provider, vscode.TreeItemCollapsibleState.None);
        this.description = description;
        this.checkboxState = isEnabled ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
    }

    public getChildren(): TreeItemChildren {
        return undefined;
    }
}

type TreeItemChildren = TreeItem[] | null | undefined;