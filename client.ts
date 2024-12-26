export interface FileResponse {
  id: string;
  filename: string;
  bytes: number;
  created_at: number;
  purpose: string;
}

export interface VectorStoreFile {
  id: string;
  object: string; // If not 'vector_store.file', then this file is not attached to a vector store
  usage_bytes: number;
  created_at: number;
  vector_store_id: string;
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled';
}

/**
 * See https://platform.openai.com/docs/api-reference/assistants/createAssistant
 */
export interface ToolResources {
  code_interpreter?: {
    file_ids: string[];
  };
  file_search?: {
    vector_store_ids: string[];
    vector_stores: {
      file_ids: string[];
    }[];
  };
}

export interface Tools {
  type: 'code_interpreter' | 'file_search' | 'function';
}

export interface Assistant {
  id: string;
  name: string;
  description: string;
  instructions: string;
  model: string;
  tools: Tools[];
  tool_resources: ToolResources;
}

export default class GptFilesClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openai.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request({ endpoint, options, useV2 = true }: {
    endpoint: string;
    options: RequestInit;
    useV2?: boolean;
  }): Promise<
    { data: unknown; rawData: string; status: number; statusText?: string }
  > {
    console.log(JSON.stringify(options));
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };
    // By default, use v2
    if (useV2) {
      headers['OpenAI-Beta'] = 'assistants=v2';
    }
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const rawData = await response.text();

    if (response.ok) {
      try {
        const data = JSON.parse(rawData);
        return {
          data,
          rawData,
          status: response.status,
        };
      } catch (_) {
        return {
          data: null,
          rawData,
          status: 500,
          statusText: 'Fail on json encode even when 200',
        };
      }
    } else {
      try {
        const data = JSON.parse(rawData);
        return {
          data,
          rawData,
          status: response.status,
          statusText: response.statusText,
        };
      } catch (_) {
        return {
          data: null,
          rawData,
          status: response.status,
          statusText: response.statusText,
        };
      }
    }
  }

  async createAssistant(
    { name, model, description, instructions }: {
      name: string;
      model: string;
      description?: string;
      instructions?: string;
    },
  ): Promise<Assistant> {
    const resp = await this.request({
      endpoint: '/assistants',
      options: {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          model,
          instructions,
          tools: [
            { type: 'code_interpreter' },
            { type: 'file_search' },
          ],
        }),
      },
    });

    if (resp.status !== 200) {
      throw new Error(
        `Error creating assistant: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    } else {
      return resp.data as Assistant;
    }
  }

  async updateAssistant(
    assistantId: string,
    { name, model, description, instructions, tool_resources }: {
      name?: string;
      model?: string;
      description?: string;
      instructions?: string;
      tool_resources?: unknown;
    },
  ): Promise<Assistant> {
    const resp = await this.request(
      {
        endpoint: `/assistants/${assistantId}`,
        options: {
          method: 'POST',
          body: JSON.stringify({
            name,
            description,
            model,
            instructions,
            tool_resources,
          }),
        },
      },
    );
    if (resp.status !== 200) {
      throw new Error(
        `Error updating assistant: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    } else {
      return resp.data as Assistant;
    }
  }

  async deleteAssistant(assistantId: string) {
    const resp = await this.request({
      endpoint: `/assistants/${assistantId}`,
      options: {
        method: 'DELETE',
      },
    });
    if (resp.status !== 200) {
      throw new Error(
        `Error deleting assistant: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    }
  }

  async listAssistants(): Promise<Assistant[]> {
    const resp = await this.request({
      endpoint: '/assistants',
      options: {
        method: 'GET',
      },
    });
    if (resp.status !== 200) {
      throw new Error(
        `Error listing assistants: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    } else {
      return (resp.data as { data: Assistant[] }).data as Assistant[];
    }
  }

  async assistant(assistantId: string): Promise<Assistant> {
    const resp = await this.request({
      endpoint: `/assistants/${assistantId}`,
      options: {
        method: 'GET',
      },
    });
    if (resp.status !== 200) {
      throw new Error(
        `Error getting assistant: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    } else {
      return resp.data as Assistant;
    }
  }

  private async attachFile2VectorStore({ filePath, vStoreId, newFileName }: {
    filePath: string;
    vStoreId: string;
    newFileName?: string;
  }): Promise<FileResponse> {
    const formData = new FormData();
    const file = await Deno.readFile(filePath);
    const originalFilename = filePath.split('/').pop();
    const uploadFilename = newFileName || originalFilename;

    formData.append('purpose', 'assistants');
    formData.append('file', new Blob([file]), uploadFilename);

    const fileResponse = await this.request({
      endpoint: '/files',
      options: {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
      useV2: false,
    });
    if (fileResponse.status !== 200) {
      throw new Error(
        `Error uploading file: ${fileResponse.status} ${fileResponse.statusText}\n${fileResponse.rawData}`,
      );
    }

    const fileData = fileResponse.data as FileResponse;

    // Attach the file to the vector store
    const resp = await this.request({
      endpoint: `/vector_stores/${vStoreId}/files/`,
      options: {
        method: 'POST',
        body: JSON.stringify({ file_id: fileData.id }),
      },
    });
    if (resp.status !== 200) {
      throw new Error(
        `Error attaching file to vector store: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    }
    return fileData;
  }

  private detachFileFromVectorStore(
    { fileId, vStoreId }: { fileId: string; vStoreId: string },
  ) {
    return this.request({
      endpoint: `/vector_stores/${vStoreId}/files/${fileId}`,
      options: {
        method: 'DELETE',
      },
    });
  }

  private deleteFile(fileId: string) {
    return this.request({
      endpoint: `/files/${fileId}`,
      options: {
        method: 'DELETE',
      },
      useV2: false,
    });
  }

  /**
   * See https://platform.openai.com/docs/api-reference/vector-stores/create
   * @param name {string} The name of the vector store. Let's use the same name as the assistant
   * @returns {string} The ID of the created vector store
   */
  private async createVectorStore(name: string): Promise<string> {
    const resp = await this.request({
      endpoint: '/vector_stores',
      options: {
        method: 'POST',
        body: JSON.stringify({ name }),
      },
    });

    if (resp.status !== 200) {
      throw new Error(
        `Error creating vector store: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    } else {
      return (resp.data as { id: string }).id;
    }
  }

  /**
   * Check whether the assistant has a vector store. If not, create one.
   * @param {Assistant} assistant
   * @private
   */
  private async tryCreateVectorStore(assistant: Assistant): Promise<void> {
    if (
      assistant.tool_resources.file_search &&
      assistant.tool_resources.file_search.vector_store_ids.length > 0
    ) {
      return;
    }
    const vectorStoreId = await this.createVectorStore(assistant.name);
    console.log(
      `Created vector store ${vectorStoreId} for assistant ${assistant.id}`,
    );
    const payload = assistant.tool_resources;
    await this.updateAssistant(
      assistant.id,
      {
        tool_resources: {
          ...payload,
          file_search: {
            vector_store_ids: [vectorStoreId],
          },
        },
      },
    );
  }

  /**
   * @TODO: Able to get all files, not just the first 100
   * See https://platform.openai.com/docs/api-reference/vector-stores-files
   * See https://platform.openai.com/docs/api-reference/files/create
   */
  async listFiles(assistantId: string): Promise<VectorStoreFile[]> {
    const assistant = await this.assistant(assistantId);
    await this.tryCreateVectorStore(assistant);
    const vStoreId = assistant.tool_resources.file_search!.vector_store_ids[0];
    const resp = await this.request({
      endpoint: `/vector_stores/${vStoreId}/files?limit=100&order=desc`,
      options: { method: 'GET' },
    });
    if (resp.status !== 200) {
      throw new Error(
        `Error listing files: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    } else {
      return (resp.data as { data: VectorStoreFile[] }).data;
    }
  }

  async uploadFile({ filePath, assistantId, newFileName }: {
    filePath: string;
    assistantId: string;
    newFileName?: string;
  }): Promise<FileResponse> {
    const assistant = await this.assistant(assistantId);
    await this.tryCreateVectorStore(assistant);
    return this.attachFile2VectorStore({
      filePath,
      vStoreId: assistant.tool_resources.file_search!.vector_store_ids[0],
      newFileName,
    });
  }

  async removeFile(
    { fileId, assistantId }: { fileId: string; assistantId: string },
  ) {
    const assistant = await this.assistant(assistantId);
    const stores = assistant.tool_resources.file_search!.vector_stores;
    const storeIds = assistant.tool_resources.file_search!.vector_store_ids;
    if (stores.length !== 1) {
      throw new Error(
        `Assistant ${assistantId} has ${stores.length} vector stores, expected 1`,
      );
    }
    if (storeIds.length !== 1) {
      throw new Error(
        `Assistant ${assistantId} has ${storeIds.length} vector store IDs, expected 1`,
      );
    }
    let found = false;
    // Check this `fileId` is in the `tool_resources` object
    for (const store of stores) {
      if (store.file_ids.includes(fileId)) {
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error(
        `File ${fileId} is not attached to the assistant ${assistantId}`,
      );
    }
    await this.detachFileFromVectorStore({
      fileId,
      vStoreId: storeIds[0],
    });
    await this.deleteFile(fileId);
  }
}
