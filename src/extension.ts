import * as vscode from 'vscode';
import { ExtensionContext } from "vscode";
import { DebugSetup } from './activateDebug';

/**
 * Override method to perform actions when activating the extension.
 * 
 * @param context Context of the extension.
 */
export async function activate(context: ExtensionContext) {
    const debugSetup: DebugSetup = new DebugSetup();
    debugSetup.activateDebug(context, new GenericDebugAdapterServerDescriptorFactory());
}

/**
 * Decribes a debug adapter: in our case, describes a debugger running at a given port.
 */
class GenericDebugAdapterServerDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {

    public createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        return new vscode.DebugAdapterServer(session.configuration.configurableDebuggerPort);
    }
}