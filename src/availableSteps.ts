import * as vscode from 'vscode';
import { GetAvailableStepsResponse } from './DAPExtension';
import { LeafTreeItem, TreeDataProvider, TreeItem } from "./treeItem";

export class AvailableStepsDataProvider extends TreeDataProvider {
    public async getChildren(element?: TreeItem | undefined): Promise<TreeItem[] | null | undefined> {
        if (!vscode.debug.activeDebugSession) return undefined;
        if (element) return element.getChildren();

        const response: GetAvailableStepsResponse = await vscode.debug.activeDebugSession?.customRequest('getAvailableSteps');

        return response.availableSteps.map((step, i) => new AvailableStepTreeItem(
            step.id,
            step.name,
            step.description,
            step.isEnabled,
            this
        ));
    }
}

/**
 * Leaf item for the available steps view.
 */
export class AvailableStepTreeItem extends LeafTreeItem {
    readonly stepId: string;

    constructor(stepId: string, name: string, description: string, isEnabled: boolean, provider: AvailableStepsDataProvider) {
        super(name, description, isEnabled, provider);
        this.stepId = stepId;
    }

    public get provider(): AvailableStepsDataProvider {
        return this._provider as AvailableStepsDataProvider;
    }
} 