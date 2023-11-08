import * as vscode from 'vscode';
import { GetAvailableStepsResponse } from './DAPExtension';
import { FolderTreeItem, LeafTreeItem, TreeDataProvider, TreeItem } from "./treeItem";

export class AvailableStepsDataProvider extends TreeDataProvider {
    public async getChildren(element?: TreeItem | undefined): Promise<TreeItem[] | null | undefined> {
        if (!vscode.debug.activeDebugSession) return undefined;
        if (element) return element.getChildren();

        const response: GetAvailableStepsResponse = await vscode.debug.activeDebugSession?.customRequest('getAvailableSteps');

        return [
            new FolderTreeItem('Enabled', response.availableSteps.filter(step => step.isEnabled).map(step => new AvailableStepTreeItem(
                step == response.availableSteps[0],
                step.id,
                step.name,
                step.description,
                true,
                this
            )), this),
            new FolderTreeItem('Disabled', response.availableSteps.filter(step => !step.isEnabled).map(step => new AvailableStepTreeItem(
                step == response.availableSteps[0],
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

    constructor(isDefault: boolean, stepId: string, name: string, description: string, isEnabled: boolean, provider: AvailableStepsDataProvider) {
        super(name, provider);
        this.stepId = stepId;
        this.description = isDefault ? `(default) ${description}` : description;
        if (isDefault) {
            this.contextValue = isEnabled ? 'enabledDefaultStep' : 'disabledStep';
        } else {
            this.contextValue = isEnabled ? 'enabledStep' : 'disabledStep';
        }

    }

    public get provider(): AvailableStepsDataProvider {
        return this._provider as AvailableStepsDataProvider;
    }
} 