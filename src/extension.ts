import * as vscode from "vscode";
import { YandexS3Client } from "./s3client";
import * as path from "path";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
    const s3Client = new YandexS3Client();

    context.subscriptions.push(
        vscode.commands.registerCommand("yandex-s3-explorer.download", async () => {
            try {
                const projectInfo = getCurrentProjectInfo();
                await downloadProject(s3Client, projectInfo);
                vscode.window.showInformationMessage(`Downloaded project '${projectInfo.name}' successfully`);
            } catch (error) {
                vscode.window.showErrorMessage(`Download failed: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("yandex-s3-explorer.upload", async () => {
            try {
                const projectInfo = getCurrentProjectInfo();
                await uploadProject(s3Client, projectInfo);
                vscode.window.showInformationMessage(`Uploaded project '${projectInfo.name}' successfully`);
            } catch (error) {
                vscode.window.showErrorMessage(`Upload failed: ${error}`);
            }
        })
    );
}

function getCurrentProjectInfo() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error("No project folder open in VS Code");
    }
    
    const rootUri = workspaceFolders[0].uri;
    return {
        name: path.basename(rootUri.fsPath),
        localPath: rootUri.fsPath
    };
}

async function downloadProject(client: YandexS3Client, projectInfo: {name: string, localPath: string}) {
    const objects = await client.listObjects(projectInfo.name + "/");
    
    for (const object of objects) {
        if (!object.Key) continue;
        
        // Удаляем имя проекта из пути
        const relativePath = object.Key.replace(`${projectInfo.name}/`, '');
        const localFilePath = path.join(projectInfo.localPath, relativePath);
        const dirName = path.dirname(localFilePath);
        
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, { recursive: true });
        }
        
        await client.downloadFile(object.Key, localFilePath);
        vscode.window.setStatusBarMessage(`Downloaded: ${relativePath}`, 3000);
    }
}

async function uploadProject(client: YandexS3Client, projectInfo: {name: string, localPath: string}) {
    const files = getAllFiles(projectInfo.localPath);
    
    for (const file of files) {
        const relativePath = path.relative(projectInfo.localPath, file);
        const s3Key = `${projectInfo.name}/${relativePath.replace(/\\/g, '/')}`; // Для Windows путей
        
        await client.uploadFile(file, s3Key);
        vscode.window.setStatusBarMessage(`Uploaded: ${relativePath}`, 3000);
    }
}

function getAllFiles(dirPath: string): string[] {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    return entries.flatMap(entry => {
        const fullPath = path.join(dirPath, entry.name);
        return entry.isDirectory() ? getAllFiles(fullPath) : fullPath;
    });
}

export function deactivate() {}