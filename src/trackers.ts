import * as vscode from 'vscode';
import { TreeDataProvider } from './treeItem';

/**
 * Factory for {@link StoppedDebugAdapterTracker}.
 */
export class StoppedDebugAdapterTrackerFactory implements vscode.DebugAdapterTrackerFactory {
    public providers: TreeDataProvider[] = [];

    public createDebugAdapterTracker(session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        return new StoppedDebugAdapterTracker(this.providers);
    }
}

/**
 * Listener for stopped debug adapter messages.
 */
export class StoppedDebugAdapterTracker implements vscode.DebugAdapterTracker {
    constructor(private providers: TreeDataProvider[]) { }

    public onDidSendMessage(message: any): void {
        if (message.event && message.event === 'stopped') {
            for (const provider of this.providers) {
                provider.refresh(undefined);
            }
        }
    }
}