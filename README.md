# S3 Client for Yandex Cloud. 

## Особенности реализации

- Работа с Yandex S3 через AWS SDK с кастомным endpoint
- Рекурсивная обработка директорий
- Поддержка файлов любого типа (yaml, json, txt и др.)
- Отображение прогресса в статусной строке
- Автоматическое создание необходимых директорий

## Начало работы 

1. Настройте параметры в VS Code:
```json
{
  "yandexS3.accessKeyId": "YOUR_ACCESS_KEY",
  "yandexS3.secretAccessKey": "YOUR_SECRET_KEY",
  "yandexS3.bucketName": "YOUR_BUCKET_NAME"
}
```

2. Команды доступны через Command Palette (Ctrl+Shift+P):

- "Download from Yandex S3" - скачивает всю структуру из S3
- "Upload to Yandex S3" - загружает локальную директорию в S3
