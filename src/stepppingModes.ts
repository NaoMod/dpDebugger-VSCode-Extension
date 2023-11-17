import * as vscode from 'vscode';
import { GetSteppingModesResponse } from './DAPExtension';
import { LeafTreeItem, TreeDataProvider, TreeItem } from './treeItem';

/**
 * Data provider for the stepping mode tree view.
 */
export class SteppingModesProvider extends TreeDataProvider {
    public async getChildren(element?: TreeItem | undefined): Promise<TreeItem[] | null | undefined> {
        if (!vscode.debug.activeDebugSession) return undefined;
        if (element) return element.getChildren();

        const response: GetSteppingModesResponse = await vscode.debug.activeDebugSession.customRequest('getSteppingModes');

        return response.steppingModes.map(steppingMode => new SteppingModeTreeItem(
            steppingMode.id,
            steppingMode.name,
            steppingMode.description,
            steppingMode.isEnabled,
            this
        ));
    }
}

/**
 * Leaf item for the stepping mode tree view.
 */
export class SteppingModeTreeItem extends LeafTreeItem {
    readonly modeId: string;

    constructor(modeId: string, name: string, description: string, isEnabled: boolean, provider: TreeDataProvider) {
        super(name, description, isEnabled, provider);
        this.modeId = modeId;
    }
}