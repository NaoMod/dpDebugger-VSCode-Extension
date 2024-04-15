import * as vscode from 'vscode';
import { GetAvailableStepsResponse } from './DAPExtension';
import { LeafTreeItem, TreeDataProvider, TreeItem } from "./treeItem";

/**
 * Data provider for the 'Available Steps' view.
 */
export class AvailableStepsDataProvider extends TreeDataProvider {
    public async getChildren(element?: TreeItem | undefined): Promise<TreeItem[] | null | undefined> {
        if (!vscode.debug.activeDebugSession) return undefined;
        if (element) return element.getChildren();

        const response: GetAvailableStepsResponse = await vscode.debug.activeDebugSession?.customRequest('getAvailableSteps');

        return response.availableSteps.map(step => new AvailableStepTreeItem(
            step.id,
            step.name,
            step.isEnabled,
            this,
            step.description
        ));
    }
}

/**
 * Leaf item for the 'Available Steps' view.
 */
export class AvailableStepTreeItem extends LeafTreeItem {
    readonly stepId: string;

    constructor(stepId: string, name: string, isEnabled: boolean, provider: AvailableStepsDataProvider, description?: string,) {
        super(name, isEnabled, provider, description);
        this.stepId = stepId;
    }

    public get provider(): AvailableStepsDataProvider {
        return this._provider as AvailableStepsDataProvider;
    }
} 