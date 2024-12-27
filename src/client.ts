import AssistantClient, {
  type Assistant,
  type CreateAssistantArgs,
  type UpdateAssistantArgs,
} from './clients/assistant.ts';
import FileClient, { type FileResponse } from './clients/file.ts';
import VectorStoreClient, {
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
    const vStoreId = await this.vectorStoreClient.create(args.name);
    await this.assistantClient.updateAssistant(assistant.id, {
      tool_resources: {
        file_search: {
          vector_store_ids: [vStoreId],
        },
      },
    });
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
      const files = await this.listFiles(assistantId);
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

  /************************ File Operations ************************/

  async uploadFile(
    { filePath, assistantId, newFileName }: {
      filePath: string;
      assistantId: string;
      newFileName?: string;
    },
  ): Promise<FileResponse> {
    const assistant = await this.assistantClient.assistant(assistantId);
    let vStoreId = AssistantClient.tryGetVectorStoreId(assistant);
    if (!vStoreId) {
      console.log(
        `Vector store not found for assistant ${assistantId}. Creating a new one.`,
      );
      vStoreId = await this.vectorStoreClient.create(assistant.name);
      console.log(`Created vector store ${vStoreId}`);
      console.log(
        `Updating assistant ${assistantId} with vector store ${vStoreId}`,
      );
      await this.assistantClient.updateAssistant(assistantId, {
        tool_resources: {
          file_search: {
            vector_store_ids: [vStoreId],
          },
        },
      });
    }
    const fileData = await this.fileClient.upload({ filePath, newFileName });
    await this.vectorStoreClient.attachFile({ file: fileData, vStoreId });
    return fileData;
  }

  async removeFile(
    { fileId, assistantId }: { fileId: string; assistantId: string },
  ) {
    const assistant = await this.assistantClient.assistant(assistantId);
    const vStoreId = AssistantClient.tryGetVectorStoreId(assistant);
    try {
      if (vStoreId) {
        console.log(`Detaching file ${fileId} from vector store ${vStoreId}`);
        await this.vectorStoreClient.detachFile({ fileId, vStoreId });
      } else {
        console.log(
          `Vector store not found for assistant ${assistantId}. Skipping detaching file.`,
        );
      }
    } catch (error) {
      console.error(
        `Error detaching file ${fileId} from vector store ${vStoreId}: ${error}`,
      );
    }
    await this.fileClient.delete(fileId);
  }

  async listFiles(assistantId: string): Promise<VectorStoreFile[]> {
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
}
