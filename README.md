# S3 Client for Yandex Cloud. 

## Особенности реализации

- Работа с Yandex S3 через AWS SDK с кастомным endpoint
- Поддержка файлов любого типа (yaml, json, txt и др.)
- Автоматическое создание необходимых директорий
- Автоматическое определение текущего проекта через vscode.workspace.workspaceFolders
- Использование имени проекта как префикса в S3 (например: my-project/file.txt)
- Поддержка вложенных директорий внутри проекта
- Прогресс-бар для загрузки файлов
- Обработка путей для разных ОС (Windows/Linux)

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

## Основные особенности

#### Для загрузки/выгрузки всегда используется корневая папка открытого проекта

На S3 файлы сохраняются в папке с именем проекта

#### При скачивании:

- Ищутся все объекты с префиксом имя_проекта/
- Файлы сохраняются в текущий проект

#### При выгрузке:

Все файлы проекта загружаются в S3 с префиксом имя_проекта/

#### Чтобы проверить:

1. Настройте ключи доступа

2. Откройте проект в VS Code

3. Вызовите Command Palette (Ctrl+Shift+P)

4. Выберите "Upload to Yandex S3" - все файлы будут загружены в папку S3 с именем проекта

5. Для теста скачивания можно временно переименовать папку проекта и использовать "Download from Yandex S3"

## Сборка и установка

#### Для тестирования выполните

```
npm install
npm run compile
```
запустите Debug (f5)

#### Для публикации

```
npm install -g @vscode/vsce
vsce package
vsce publish
```