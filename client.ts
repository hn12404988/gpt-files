export interface FileResponse {
  id: string;
  filename: string;
  bytes: number;
  created_at: number;
  purpose: string;
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
      chunking_strategy: {
        type: 'auto' | 'static';
        static?: {
          max_chunk_size_tokens: number;
          chunk_overlap_tokens: number;
        };
      };
      metadata: { [key: string]: string };
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
    { name, model, description, instructions }: {
      name?: string;
      model?: string;
      description?: string;
      instructions?: string;
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

  async uploadFile({ filePath, assistantId, newFileName }: {
    filePath: string;
    assistantId: string;
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
      },
    });

    if (fileResponse.status !== 200) {
      throw new Error(
        `Error uploading file: ${fileResponse.status} ${fileResponse.statusText}\n${fileResponse.rawData}`,
      );
    }

    const fileData = fileResponse.data as FileResponse;

    const resp = await this.request({
      endpoint: `/assistants/${assistantId}/files`,
      options: {
        method: 'POST',
        body: JSON.stringify({ file_id: fileData.id }),
      },
    });

    if (resp.status !== 200) {
      throw new Error(
        `Error attaching file to assistant: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    } else {
      return fileData;
    }
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
   * See https://platform.openai.com/docs/api-reference/vector-stores-files
   * See https://platform.openai.com/docs/api-reference/files/create
   */
  async listFiles(assistantId: string): Promise<FileResponse[]> {
    const assistant = await this.assistant(assistantId);
    if (assistant.tool_resources.file_search) {
    }
    const resp = await this.request({
      endpoint: `/assistants/${assistantId}/files`,
      options: { method: 'GET' },
    });
    if (resp.status !== 200) {
      throw new Error(
        `Error listing files: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    } else {
      return (resp.data as { data: FileResponse[] }).data;
    }
  }

  async deleteFile(
    { fileId, assistantId }: { fileId: string; assistantId: string },
  ) {
    let resp = await this.request({
      endpoint: `/assistants/${assistantId}/files/${fileId}`,
      options: {
        method: 'DELETE',
      },
    });
    if (resp.status !== 200) {
      throw new Error(
        `Error detaching file from assistant: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    }

    resp = await this.request({
      endpoint: `/files/${fileId}`,
      options: {
        method: 'DELETE',
      },
    });
    if (resp.status !== 200) {
      throw new Error(
        `Error deleting file: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    }
  }
}
