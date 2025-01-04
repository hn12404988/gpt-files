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
      let vStoreId = AssistantClient.tryGetVectorStoreId(assistant);
      if (!vStoreId) {
        console.log(
          `Vector store not found for assistant ${assistantId}. Creating a new one.`,
        );
        const store = await this.vectorStoreClient.create(assistant.name);
        vStoreId = store.id;
        console.log(`Created vector store ${vStoreId}`);
        console.log(
          `Updating assistant ${assistantId} with vector store ${vStoreId}`,
        );
        await this.assistantClient.updateAssistant(assistantId, {
          vectorStoreId: vStoreId,
        });
      }
      await this.vectorStoreClient.attachFile({ file: fileData, vStoreId });
    }
    return fileData;
  }

  async detachFile(
    { fileId, assistantId }: { fileId: string; assistantId: string },
  ) {
    const assistant = await this.assistantClient.assistant(assistantId);
    const vectorStoreFiles = await this.listVectorStoreFiles(assistantId);
    const destinations = this.tryGetFileDestination({
      assistant,
      files: vectorStoreFiles,
      fileId,
    });
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
              `Vector store not found for assistant ${assistantId}. Skipping detaching file.`,
            );
          }
        } else if (destination === 'code') {
          await this.assistantClient.detachCodeFile(assistant, fileId);
        }
        console.log(`Detached file ${fileId} from ${destinationName}`);
      } catch (e) {
        console.error(
          `Failed to detach file ${fileId} from ${destinationName}.`,
        );
        console.error(e);
      }
    }
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
