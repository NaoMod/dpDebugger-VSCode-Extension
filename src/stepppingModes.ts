import * as vscode from 'vscode';
import { GetSteppingModesResponse, SteppingMode } from './DAPExtension';
import { FolderTreeItem, LeafTreeItem, TreeDataProvider, TreeItem } from './treeItem';

/**
 * Data provider for the stepping mode tree view.
 */
export class SteppingModesProvider extends TreeDataProvider {
    public async getChildren(element?: TreeItem | undefined): Promise<TreeItem[] | null | undefined> {
        if (!vscode.debug.activeDebugSession) return undefined;
        if (element) return element.getChildren();

        const response: GetSteppingModesResponse = await vscode.debug.activeDebugSession.customRequest('getSteppingModes');
        const steppingModes: SteppingMode[] = response.steppingModes;

        return [
            new FolderTreeItem('Enabled', steppingModes.filter(steppingMode => steppingMode.isEnabled).map(steppingMode => new SteppingModeTreeItem(steppingMode.id, steppingMode.name, steppingMode.description, true, this)), this),
            new FolderTreeItem('Disabled', steppingModes.filter(steppingMode => !steppingMode.isEnabled).map(steppingMode => new SteppingModeTreeItem(steppingMode.id, steppingMode.name, steppingMode.description, false, this)), this)
        ]
    }
}

/**
 * Leaf item for the stepping mode tree view.
 */
export class SteppingModeTreeItem extends LeafTreeItem {
    readonly modeId: string;

    constructor(modeId: string, name: string, description: string, isEnabled: boolean, provider: TreeDataProvider) {
        super(name, provider);
        this.modeId = modeId;
        this.description = description;
        this.contextValue = isEnabled ? 'enabledSteppingMode' : 'disabledSteppingMode';
    }
}