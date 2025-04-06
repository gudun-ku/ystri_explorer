import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as vscode from "vscode";
import * as fs from "fs";
import * as stream from "stream";
import { promisify } from "util";
import * as path from "path"; // <-- Добавьте эту строку

const pipeline = promisify(stream.pipeline);

export class YandexS3Client {
    private client: S3Client;
    private bucketName: string;

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

    async listObjects(prefix: string = "") {
      try {
          const command = new ListObjectsV2Command({
              Bucket: this.bucketName,
              Prefix: prefix,
              Delimiter: "/"
          });
          
          const response = await this.client.send(command);
          return response.Contents || [];
      } catch (error) {
          vscode.window.showErrorMessage(`S3 List Objects error: ${error}`);
          return [];
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
}
