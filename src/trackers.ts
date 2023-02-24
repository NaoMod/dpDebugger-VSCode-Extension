import * as vscode from 'vscode';

/**
 * Factory for {@link GenericDebugAdapterTracker}.
 */
export class GenericDebugAdapterTrackerFactory implements vscode.DebugAdapterTrackerFactory {
    createDebugAdapterTracker(session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        return new GenericDebugAdapterTracker();
    }
}

/**
 * Listener for debug adapter messages.
 */
export class GenericDebugAdapterTracker implements vscode.DebugAdapterTracker {

    onDidSendMessage(message: any): void {
        console.error('>> Message sent by debugger:');
        console.error(message);
    }

    onError(error: Error): void {
        console.error('>> Error:');
        console.error(error);
    }

    onWillReceiveMessage(message: any): void {
        console.error('>> Message received by debugger:');
        console.error(message);
    }
}