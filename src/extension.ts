import * as vscode from 'vscode';
import { ExtensionContext } from "vscode";
import { activateDebug } from "./activateDebug";

/**
 * Override method to perform actions when activating the extension.
 * 
 * @param context {vscode.ExtensionContext}
 */
export async function activate(context: ExtensionContext) {
    activateDebug(context, new GenericDebugAdapterServerDescriptorFactory());
}

/**
 * Override method to perform actions when deactivating the extension.
 */
export function deactivate() {

}

export interface DisposableDebugAdapterDescriptorFactory extends vscode.DebugAdapterDescriptorFactory {
    dispose(): any;
}

/**
 * Decribes a debug adapter: in our case, describes a debugger running at a given port.
 */
class GenericDebugAdapterServerDescriptorFactory implements DisposableDebugAdapterDescriptorFactory {

    createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        return new vscode.DebugAdapterServer(session.configuration.configurableDebuggerPort);
    }

    dispose() { }
}