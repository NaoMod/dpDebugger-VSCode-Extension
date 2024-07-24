# VSCode Extension for dpDebugger

Extension adding support for [dpDebugger](https://github.com/NaoMod/dpDebugger) in VSCode.

> **Warning**
>
> This repository stores the live version of dpDebugger VSCode extension, as well as different versions referenced in multiple papers.
>
> To access the live version of the extension, refer to the [main](https://github.com/NaoMod/dpDebugger-VSCode-Extension/tree/main) branch.
> 
> To access the version referenced in the paper *dpDebugger: a Domain-parametric Debugger for DSLs
using DAP and Language Protocols* submitted to the Tools and Demonstrations track at MODELS 2024, go to the [toolsMODELS2024](https://github.com/NaoMod/dpDebugger-VSCode-Extension/tree/toolsMODELS2024) tag.
>
> Similarly, to access the version referenced in the paper *Language Protocols for Domain-Specific Interactive Debugging* submitted to the SoSym journal, go to the [sosym2024](https://github.com/NaoMod/dpDebugger-VSCode-Extension/tree/sosym2024) tag.

## Requirements

- [Node.js](https://nodejs.org) 18.0+
- [TypeScript](https://www.typescriptlang.org/) 4.8+
- [Visual Studio Code](https://code.visualstudio.com/) 1.63+

## Build

From the root folder:
- `npm i`
- `tsc`

## Launching the VSCode Extension

Open the root folder in Visual Studio Code (*File* > *Open Folder...*).

Open the **Run and Debug** view from the left sidebar (or press *Ctrl+Shift+D*).

From the dropdown menu at the top of the view, select the *Launch dpDebugger Extension* launch configuration.

Then, press the *Start Debugging* button (green arrow on the left of the launch configuration's name) or press *F5*. This should start a new Visual Studio Code instance.

## Debugging a Program

Sample programs for the State Machines DSL are provided in the folder *./sampleWorkspace*. To start debugging one of them, first make sure you have both the [State Machines Runtime](https://github.com/NaoMod/State-Machines-dpDebugger) and [dpDebugger](https://github.com/NaoMod/dpDebugger) running. Open the folder in the new instance of VSCode (*File > Open Folder...*).

Open the **Run and Debug** view on the left sidebar (or with the shortcut *Ctrl+Shift+D*).

As in the previous section, the dropdown menu allows you to select which program you wish to debug.
Make sure the attributes in the launch configuration, such as the port of the debugger and language runtime, are coherent with the setup running on your machine. Launch configurations are stored in the file *./sampleWorkspace/.vscode/launch.json*, and can be modified as needed. Then, press the *Start Debugging* button (green arrow on the left of the launch configuration's name) or press *F5*.