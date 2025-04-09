import { 
  S3Client, 
  ListObjectVersionsCommand, 
  GetObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  GetBucketVersioningCommand,
  GetBucketVersioningCommandOutput,
  GetObjectCommandInput
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import * as vscode from "vscode";
import * as fs from "fs";
import * as stream from "stream";
import { promisify } from "util";
import * as path from "path"; // <-- Добавьте эту строку

const pipeline = promisify(stream.pipeline);

interface S3ObjectVersion {
  Key?: string;
  VersionId?: string;
  LastModified?: Date;
}

export class YandexS3Client {
  private client: S3Client;
  public bucketName: string;
  private versioningStatus: 'Enabled' | 'Suspended' | 'Disabled' | 'Unknown' = 'Unknown';
  

  constructor() {
      const config = vscode.workspace.getConfiguration("yandexS3");
      
      this.bucketName = config.get("bucketName") as string;
      const accessKeyId = config.get("accessKeyId") as string;
      const secretAccessKey = config.get("secretAccessKey") as string;

      if (!accessKeyId || !secretAccessKey || !this.bucketName) {
          throw new Error("Missing Yandex S3 configuration in settings");
      }

      this.client = new S3Client({
          endpoint: "https://storage.yandexcloud.net",
          region: "ru-central1",
          credentials: {
              accessKeyId,
              secretAccessKey
          },
          forcePathStyle: true
      });
  }

  get versioningStatusString(): string {
    return this.versioningStatus === 'Enabled' ? 'ON' :
           this.versioningStatus === 'Suspended' ? 'SUSPENDED' :
           this.versioningStatus === 'Disabled' ? 'OFF' : 'UNKNOWN';
  }

  async checkVersioning(): Promise<void> {
    try {
      const response: GetBucketVersioningCommandOutput = await this.client.send(
        new GetBucketVersioningCommand({ Bucket: this.bucketName })
      );
      this.versioningStatus = response.Status || 'Disabled';
    } catch (error) {
      this.versioningStatus = 'Unknown';
    }
  }

  async listObjects(prefix: string = ""): Promise<{ 
    versions: S3ObjectVersion[], 
    isVersioned: boolean 
  }>  {
    await this.checkVersioning();
    
    const isVersioned = this.versioningStatus === 'Enabled';
    
    if (isVersioned) {
      const response = await this.client.send(new ListObjectVersionsCommand({
        Bucket: this.bucketName,
        Prefix: prefix
      }));
      return {
        versions: response.Versions || [],
        isVersioned: true
      };
    }
  
    const response = await this.client.send(new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix
    }));
    
    return {
      versions: response.Contents?.map(item => ({
        Key: item.Key,
        VersionId: undefined // Изменено с null на undefined
      })) || [],
      isVersioned: false
    };
  }

  async listObjectVersions(prefix: string = "") {
    try {
      const command = new ListObjectVersionsCommand({
        Bucket: this.bucketName,
        Prefix: prefix
      });
      
      const response = await this.client.send(command);
      
      // Для бакетов без версионности версии будут иметь VersionId=null
      return {
        versions: response.Versions || [],
        deleteMarkers: response.DeleteMarkers || []
      };
    } catch (error) {
      // Если команда не поддерживается, fallback к обычному списку
      return this.listObjects(prefix);
    }
  }

  async restoreFileVersion(key: string, versionId: string) {
    try {
      // Создаем новую версию копируя старую
      await this.client.send(new CopyObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        CopySource: `${this.bucketName}/${key}?versionId=${versionId}`
      }));
    } catch (error) {
      vscode.window.showErrorMessage(`Version restore failed: ${error}`);
      throw error;
    }
  }

  async uploadFile(localPath: string, key: string) {
      try {
          const fileStream = fs.createReadStream(localPath);
          
          const upload = new Upload({
              client: this.client,
              params: {
                  Bucket: this.bucketName,
                  Key: key,
                  Body: fileStream
              }
          });
  
          upload.on("httpUploadProgress", (progress) => {
              if (progress.loaded && progress.total) {
                  const percent = Math.round((progress.loaded / progress.total) * 100);
                  vscode.window.setStatusBarMessage(`Uploading ${path.basename(key)}: ${percent}%`, 3000);
              }
          });
  
          await upload.done();
      } catch (error) {
          vscode.window.showErrorMessage(`Upload failed: ${error}`);
          throw error;
      }
  }

  async downloadFile(key: string, localPath: string) {
      try {
          const command = new GetObjectCommand({
              Bucket: this.bucketName,
              Key: key
          });

          const response = await this.client.send(command);
          
          if (response.Body) {
              await pipeline(
                  response.Body as stream.Readable,
                  fs.createWriteStream(localPath)
              );
          }
      } catch (error) {
          vscode.window.showErrorMessage(`Download failed: ${error}`);
          throw error;
      }
  }

  async downloadFileVersion(
    key: string, 
    versionId: string | undefined, // Изменен тип
    localPath: string
  ) {
    const params: GetObjectCommandInput = {
      Bucket: this.bucketName,
      Key: key
    };
    
    if (versionId) {
      params.VersionId = versionId;
    }
  
    try {
      const command = new GetObjectCommand(params);
      const response = await this.client.send(command);
      
      if (response.Body) {
        await pipeline(
          response.Body as stream.Readable,
          fs.createWriteStream(localPath)
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Download failed: ${error}`);
      throw error;
    }
  }
}
