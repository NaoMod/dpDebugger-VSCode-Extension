import * as vscode from 'vscode';
import { GetAvailableStepsResponse } from './DAPExtension';
import { FolderTreeItem, LeafTreeItem, TreeDataProvider, TreeItem } from "./treeItem";

export class AvailableStepsDataProvider extends TreeDataProvider {
    public async getChildren(element?: TreeItem | undefined): Promise<TreeItem[] | null | undefined> {
        if (element) return element.getChildren();

        await this.waitForDebugSession();

        const response: GetAvailableStepsResponse = await vscode.debug.activeDebugSession?.customRequest('getAvailableSteps');

        return [
            new FolderTreeItem('Enabled', response.availableSteps.filter(step => step.isEnabled).map(step => new AvailableStepTreeItem(
                step.id,
                step.name,
                step.description,
                true,
                this
            )), this),
            new FolderTreeItem('Disabled', response.availableSteps.filter(step => !step.isEnabled).map(step => new AvailableStepTreeItem(
                step.id,
                step.name,
                step.description,
                false,
                this
            )), this)
        ]
    }
}

/**
 * Leaf item for the available steps view.
 */
export class AvailableStepTreeItem extends LeafTreeItem {
    readonly stepId: string;

    constructor(stepId: string, name: string, description: string, isEnabled: boolean, provider: AvailableStepsDataProvider) {
        super(name, provider);
        this.stepId = stepId;
        this.description = description;
        this.contextValue = isEnabled ? 'enabledStep' : 'disabledStep';
    }

    public get provider(): AvailableStepsDataProvider {
        return this._provider as AvailableStepsDataProvider;
    }
} 