import * as vscode from "vscode";
import { YandexS3Client } from "./s3client";
import * as path from "path";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
    const s3Client = new YandexS3Client();

    context.subscriptions.push(
        vscode.commands.registerCommand("yandex-s3-explorer.download", async () => {
            const folderUri = await vscode.window.showOpenDialog({
                canSelectFolders: true,
                canSelectFiles: false,
                openLabel: "Select Download Folder"
            });

            if (folderUri && folderUri[0]) {
                try {
                    await downloadDirectory(s3Client, folderUri[0].fsPath);
                    vscode.window.showInformationMessage("Download completed successfully");
                } catch (error) {
                    vscode.window.showErrorMessage(`Download failed: ${error}`);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("yandex-s3-explorer.upload", async () => {
            const folderUri = await vscode.window.showOpenDialog({
                canSelectFolders: true,
                canSelectFiles: false,
                openLabel: "Select Folder to Upload"
            });

            if (folderUri && folderUri[0]) {
                try {
                    await uploadDirectory(s3Client, folderUri[0].fsPath);
                    vscode.window.showInformationMessage("Upload completed successfully");
                } catch (error) {
                    vscode.window.showErrorMessage(`Upload failed: ${error}`);
                }
            }
        })
    );
}

async function downloadDirectory(client: YandexS3Client, localPath: string) {
    const objects = await client.listObjects();
    
    for (const object of objects) {
        if (!object.Key) continue;
        
        const filePath = path.join(localPath, object.Key);
        const dirName = path.dirname(filePath);
        
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, { recursive: true });
        }
        
        await client.downloadFile(object.Key, filePath);
        vscode.window.setStatusBarMessage(`Downloaded: ${object.Key}`, 3000);
    }
}

async function uploadDirectory(client: YandexS3Client, localPath: string) {
    const files = getAllFiles(localPath);
    
    for (const file of files) {
        const relativePath = path.relative(localPath, file);
        await client.uploadFile(file, relativePath);
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