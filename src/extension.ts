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

    //команда для просмотра версий
    context.subscriptions.push(
      vscode.commands.registerCommand("yandex-s3-explorer.show-versions", async () => {
        const projectInfo = getCurrentProjectInfo();
        const { versions } = await s3Client.listObjectVersions(projectInfo.name + "/");
        
        const items = versions.map(v => ({
          label: path.basename(v.Key!),
          description: `Version: ${v.VersionId?.substring(0, 8)}`,
          detail: `Last modified: ${v.LastModified?.toISOString()}`,
          version: v
        }));
        
        const selected = await vscode.window.showQuickPick(items);
        if (selected) {
          // TODO: Можно добавить действия для конкретной версии
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
  try {
    // Обновленный вызов с явной типизацией
    const { versions, isVersioned } = await client.listObjects(projectInfo.name + "/");
    
    // Показать статус версионности
    const statusMessage = `S3 Bucket: ${client.bucketName} [Versioning: ${client.versioningStatusString}]`;
    vscode.window.setStatusBarMessage(statusMessage, 5000);

    for (const version of versions) {
      if (!version.Key) continue;
      
      const relativePath = version.Key.replace(`${projectInfo.name}/`, '');
      const localFilePath = path.join(projectInfo.localPath, relativePath);
      const dirName = path.dirname(localFilePath);
      
      if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName, { recursive: true });
      }
      
      await client.downloadFileVersion(
        version.Key!, // Явное утверждение non-null
        version.VersionId, // Теперь совместимо с string | undefined
        localFilePath
      );
      
      const versionInfo = isVersioned ? ` (v${version.VersionId?.substring(0, 8)})` : '';
      vscode.window.setStatusBarMessage(`Downloaded: ${relativePath}${versionInfo}`, 3000);
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Download error: ${error}`);
  }
}

// Обновленная функция загрузки с отображением версий
async function uploadProject(client: YandexS3Client, projectInfo: {name: string, localPath: string}) {
  const { isVersioned } = await client.listObjects(); // Проверка статуса
  
  const uploadMessage = `Uploading to ${client.bucketName} [Versioning: ${isVersioned ? 'ON' : 'OFF'}]`;
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusItem.text = uploadMessage;
  statusItem.show();

  try {
    const files = getAllFiles(projectInfo.localPath);
    
    for (const file of files) {
      const relativePath = path.relative(projectInfo.localPath, file);
      const s3Key = `${projectInfo.name}/${relativePath.replace(/\\/g, '/')}`;
      
      await client.uploadFile(file, s3Key);
      vscode.window.setStatusBarMessage(`Uploaded: ${relativePath}`, 3000);
    }
  } finally {
    statusItem.hide();
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