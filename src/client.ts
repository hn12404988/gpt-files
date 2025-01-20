import AssistantClient, {
  type Assistant,
  type CreateAssistantArgs,
  type UpdateAssistantArgs,
} from './clients/assistant.ts';
import FileClient, { type FileResponse } from './clients/file.ts';
import { FileDestination } from './clients/core.ts';
import VectorStoreClient, {
  type VectorStore,
  type VectorStoreFile,
} from './clients/vector_store.ts';

export default class Client {
  private readonly assistantClient: AssistantClient;
  private readonly fileClient: FileClient;
  private readonly vectorStoreClient: VectorStoreClient;

  constructor(apiKey: string, { verbose }: { verbose?: boolean }) {
    this.assistantClient = new AssistantClient(apiKey, { verbose });
    this.fileClient = new FileClient(apiKey, { verbose });
    this.vectorStoreClient = new VectorStoreClient(apiKey, { verbose });
  }

  /************************ Assistant Operations ************************/

  async newAssistant(args: CreateAssistantArgs): Promise<Assistant> {
    const assistant = await this.assistantClient.createAssistant(args);
    if (!args.vectorStore) {
      console.log('Skipping vector store creation');
    } else {
      console.log('Creating vector store for the assistant');
      const store = await this.vectorStoreClient.create(args.name);
      await this.assistantClient.updateAssistant(assistant.id, {
        vectorStoreId: store.id,
      });
      console.log(`Vector store created: ${store.id}`);
    }
    return await this.assistantClient.assistant(assistant.id);
  }

  updateAssistant(
    assistantId: string,
    args: UpdateAssistantArgs,
  ): Promise<Assistant> {
    return this.assistantClient.updateAssistant(assistantId, args);
  }

  async deleteAssistant(
    assistantId: string,
    includeFiles: boolean,
  ): Promise<void> {
    const assistant = await this.assistantClient.assistant(assistantId);
    const vStoreId = AssistantClient.tryGetVectorStoreId(assistant);
    if (vStoreId && includeFiles) {
      console.log(
        `Deleting all the files attached to vector store ${vStoreId}`,
      );
      // Delete all the files attached to the vector store
      const files = await this.listVectorStoreFiles(assistantId);
      for (const file of files) {
        console.log(`Deleting file ${file.id}`);
        await this.fileClient.delete(file.id);
      }
      // Delete the vector store
      console.log(`Deleting vector store ${vStoreId}`);
      await this.vectorStoreClient.delete(vStoreId);
    } else {
      console.log(
        `Vector store not found for assistant ${assistantId}. Skipping deletion.`,
      );
    }
    // Delete the assistant
    await this.assistantClient.deleteAssistant(assistantId);
  }

  listAssistants(): Promise<Assistant[]> {
    return this.assistantClient.listAssistants();
  }

  getAssistant(assistantId: string): Promise<Assistant> {
    return this.assistantClient.assistant(assistantId);
  }

  /**
   * @NOTE: One file can possibly be attached to both vector store and code interpreter.
   */
  private tryGetFileDestination(
    { assistant, files, fileId }: {
      assistant: Assistant;
      files: VectorStoreFile[];
      fileId: string;
    },
  ): FileDestination[] {
    const destination: FileDestination[] = [];
    const fileFound = files.find((f) => f.id === fileId);
    if (fileFound) {
      destination.push(FileDestination.File);
    }
    const codeFiles = assistant.tool_resources?.code_interpreter?.file_ids ||
      [];
    if (codeFiles.includes(fileId)) {
      destination.push(FileDestination.Code);
    }
    return destination;
  }

  /************************ Vector Store Operations ************************/

  createVectorStore(name: string): Promise<VectorStore> {
    return this.vectorStoreClient.create(name);
  }

  deleteVectorStore(vStoreId: string): Promise<void> {
    return this.vectorStoreClient.delete(vStoreId);
  }

  listVectorStores(): Promise<VectorStore[]> {
    return this.vectorStoreClient.list();
  }

  getVectorStore(vStoreId: string): Promise<VectorStore> {
    return this.vectorStoreClient.get(vStoreId);
  }

  /************************ File Operations ************************/

  getFile(fileId: string): Promise<FileResponse> {
    return this.fileClient.get(fileId);
  }

  /**
   * This function is blocked by openai. It is not possible to download a file from the API.
   * Both "vector store" and "code interpreter" files are blocked.
   * Error message: Not allowed to download files of purpose: assistants
   */
  async downloadFile(fileId: string, fileName?: string): Promise<void> {
    // Get the filename if `fileName` is empty
    // Checking there is no file in the destination path
    if (!fileName) {
      console.log(`No file name provided. Searching for file id: ${fileId}`);
      const file = await this.fileClient.get(fileId);
      fileName = file.filename;
      console.log(`File name: ${fileName}`);
    } else {
      console.log(`File name provided: ${fileName}`);
    }

    // Checking if the file already exists
    let found = false;
    try {
      Deno.statSync(`./${fileName}`);
      found = true;
    } catch (e: unknown) {
      if (e instanceof Deno.errors.NotFound) {
        found = false;
      } else {
        throw e;
      }
    }
    if (found) {
      throw new Error(`File already exists at ./${fileName}`);
    }

    // Downloading the file
    return this.fileClient.download(fileId, fileName);
  }

  /**
   * @returns The vector store id
   * @private
   */
  private async createVectorStoreIfNotExists(
    assistant: Assistant,
  ): Promise<string> {
    let vStoreId = AssistantClient.tryGetVectorStoreId(assistant);
    if (!vStoreId) {
      console.log(
        `Vector store not found for assistant ${assistant.id}. Creating a new one.`,
      );
      const store = await this.vectorStoreClient.create(assistant.name);
      vStoreId = store.id;
      console.log(`Created vector store ${vStoreId}`);
      console.log(
        `Updating assistant ${assistant.id} with vector store ${vStoreId}`,
      );
      await this.assistantClient.updateAssistant(assistant.id, {
        vectorStoreId: vStoreId,
      });
    }
    return vStoreId;
  }

  async uploadFile(
    { filePath, assistantId, overwrite, fileDestination, newFileName }: {
      filePath: string;
      assistantId: string;
      overwrite: boolean;
      fileDestination: FileDestination;
      newFileName?: string;
    },
  ): Promise<FileResponse> {
    const assistant = await this.assistantClient.assistant(assistantId);
    const fileName = FileClient.getFileName({ filePath, newFileName });
    const existingFile = await this.fileClient.search(fileName);
    if (existingFile) {
      console.log(
        `File name: '${fileName}' already exists with file id: '${existingFile?.id}'`,
      );
      if (!overwrite) {
        throw new Error(
          `File name: '${fileName}' already exists. Use --overwrite to replace it if needed.`,
        );
      } else {
        console.log(`Overwriting file: ${existingFile.id}`);
        await this.fileClient.delete(existingFile.id);
      }
    }
    const fileData = await this.fileClient.upload({ filePath, fileName });

    // Attach the file to the vector store or code interpreter
    if (fileDestination === 'code') {
      await this.assistantClient.attachCodeFile(assistant, fileData.id);
    } else {
      const vStoreId = await this.createVectorStoreIfNotExists(assistant);
      await this.vectorStoreClient.attachFile({ file: fileData, vStoreId });
    }
    return fileData;
  }

  /**
   * Upload all files from a directory (but not subdirectories and exclude hidden files).
   * step 1: Check if the directory exists
   * step 2: List all the files via fileClient.list()
   * step 3: List all files in the directory (excluding hidden files that start with a dot)
   * step 4: If overwrite is false, check if the files already exist in the destination
   * step 5: Upload each file via `fileClient.upload()`
   */
  async uploadDir({ dirPath, assistantId, overwrite, fileDestination }: {
    dirPath: string;
    assistantId: string;
    overwrite: boolean;
    fileDestination: FileDestination;
  }): Promise<void> {
    // Step 1
    try {
      await Deno.stat(dirPath);
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        throw new Error(`Directory not found: ${dirPath}`);
      } else {
        throw e;
      }
    }

    // Step 2
    const previouslyUploadedFiles = await this.fileClient.list();

    // Step 3
    const localFiles = [];
    for await (const dirEntry of Deno.readDir(dirPath)) {
      if (dirEntry.isFile && !dirEntry.name.startsWith('.')) {
        localFiles.push(dirEntry.name);
      }
    }

    // Throw error if any file already exists
    if (!overwrite) {
      for (const file of localFiles) {
        if (previouslyUploadedFiles.find((f) => f.filename === file)) {
          throw new Error(`File already exists: ${file}`);
        }
      }
    }

    // Get assistant and vector store id
    let assistant = await this.assistantClient.assistant(assistantId);
    const originalCodeFiles = assistant.tool_resources.code_interpreter
      ?.file_ids;
    const vStoreId = await this.createVectorStoreIfNotExists(assistant);

    // Upload each file
    console.log(`Uploading ${localFiles.length} files from ${dirPath}`);
    localFiles.forEach((f) => console.log(f));
    console.log(`Destination: ${fileDestination}\n`);
    const newlyUploadedFiles: FileResponse[] = [];
    const attachedFiles: VectorStoreFile[] = [];
    try {
      for (const file of localFiles) {
        const resp = await this.fileClient.upload({
          filePath: `${dirPath}/${file}`,
          fileName: file,
        });
        newlyUploadedFiles.push(resp);
        if (fileDestination === 'code') {
          await this.assistantClient.attachCodeFile(assistant, resp.id);
        } else {
          const f = await this.vectorStoreClient.attachFile({
            file: resp,
            vStoreId,
          });
          attachedFiles.push(f);
        }
      }
    } catch (e: unknown) {
      // Delete all the files uploaded so far
      console.error(
        `Error uploading files. Deleting all the uploaded files: ${e}`,
      );
      for (const file of newlyUploadedFiles) {
        await this.fileClient.delete(file.id);
        for (const f of attachedFiles) {
          if (f.id === file.id) {
            await this.vectorStoreClient.detachFile({ fileId: f.id, vStoreId });
            break;
          }
        }
      }
      await this.assistantClient.updateAssistant(assistantId, {
        codeFileIds: originalCodeFiles,
      });
      throw e;
    }
    console.log('All files uploaded successfully\n');

    if (overwrite) {
      // Delete all the files that were already uploaded previously with the same name
      console.log('Deleting files previously uploaded with the same name');
      const vectorStoreFiles = await this.listVectorStoreFiles(assistantId);
      for (const file of localFiles) {
        const existingFile = previouslyUploadedFiles.find((f) =>
          f.filename === file
        );
        if (existingFile) {
          console.log(`Deleting old file ${existingFile.filename}`);
          await this.fileClient.delete(existingFile.id);
          assistant = await this.detachFileCore({
            fileId: existingFile.id,
            assistant,
            vectorStoreFiles,
          });
        }
      }
    }
  }

  async detachFile(
    { fileId, assistantId }: { fileId: string; assistantId: string },
  ) {
    const assistant = await this.assistantClient.assistant(assistantId);
    const vectorStoreFiles = await this.listVectorStoreFiles(assistantId);
    return this.detachFileCore({ fileId, assistant, vectorStoreFiles });
  }

  private async detachFileCore(
    { fileId, assistant, vectorStoreFiles }: {
      fileId: string;
      assistant: Assistant;
      vectorStoreFiles: VectorStoreFile[];
    },
  ): Promise<Assistant> {
    const destinations = this.tryGetFileDestination({
      assistant,
      files: vectorStoreFiles,
      fileId,
    });
    let newAssistant = assistant;
    for (const destination of destinations) {
      const destinationName = destination === 'file'
        ? 'vector store'
        : 'code interpreter';
      try {
        console.log(`Detaching file ${fileId} from ${destinationName}`);
        if (destination === 'file') {
          const vStoreId = AssistantClient.tryGetVectorStoreId(assistant);
          if (vStoreId) {
            console.log(
              `Detaching file ${fileId} from vector store ${vStoreId}`,
            );
            await this.vectorStoreClient.detachFile({ fileId, vStoreId });
          } else {
            console.log(
              `Vector store not found for assistant ${assistant.id}. Skipping detaching file.`,
            );
          }
        } else if (destination === 'code') {
          newAssistant = await this.assistantClient.detachCodeFile(
            assistant,
            fileId,
          );
        }
        console.log(`Detached file ${fileId} from ${destinationName}`);
      } catch (e) {
        console.error(
          `Failed to detach file ${fileId} from ${destinationName}.`,
        );
        console.error(e);
      }
    }
    return newAssistant;
  }

  deleteFile(
    { fileId }: { fileId: string },
  ) {
    return this.fileClient.delete(fileId);
  }

  async listVectorStoreFiles(assistantId: string): Promise<VectorStoreFile[]> {
    const assistant = await this.assistantClient.assistant(assistantId);
    const vStoreId = AssistantClient.tryGetVectorStoreId(assistant);
    if (!vStoreId) {
      console.log(
        `Vector store not found for assistant ${assistantId}. Skipping listing files.`,
      );
      return [];
    } else {
      return this.vectorStoreClient.listFiles(vStoreId);
    }
  }

  allFiles(): Promise<FileResponse[]> {
    return this.fileClient.list();
  }
}
