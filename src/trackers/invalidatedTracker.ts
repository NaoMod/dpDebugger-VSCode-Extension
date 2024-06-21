import * as vscode from 'vscode';

/**
 * Factory for {@link InvalidatedStacksDebugAdapterTracker}.
 */
export class InvalidatedStacksDebugAdapterTrackerFactory implements vscode.DebugAdapterTrackerFactory {
    public createDebugAdapterTracker(session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        return new InvalidatedStacksDebugAdapterTracker();
    }
}

/**
 * Listener for invalidated stacks debug adapter messages.
 */
export class InvalidatedStacksDebugAdapterTracker implements vscode.DebugAdapterTracker {
    private mustFocusOnNextRefresh: boolean = false;

    public onDidSendMessage(message: any): void {
        // Refresh focus on stack trace to highlight correct step position on the editor
        if (message.command === 'variables' && this.mustFocusOnNextRefresh) {
            this.refreshFocus();
            return;
        }

        if (message.event !== 'invalidated') return;

        if (message.body.areas === undefined) {
            this.mustFocusOnNextRefresh = true;
            return;
        }

        for (const area of message.body.areas) {
            if (area === 'all' || area === 'threads' || area === 'stacks') {
                this.mustFocusOnNextRefresh = true;
                return;
            }
        }

    }

    private async refreshFocus() {
        // Pretty bad but hey, it works
        vscode.commands.executeCommand('workbench.debug.action.focusCallStackView');
        await new Promise<void>(resolve => setTimeout(() => {
            resolve()
        }, 100));
        vscode.commands.executeCommand('workbench.action.debug.callStackTop');
        this.mustFocusOnNextRefresh = false;
    }
}