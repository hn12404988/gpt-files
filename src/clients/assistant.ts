import ClientCore, { ApiError, type PaginationBody } from './core.ts';

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

export type CreateAssistantArgs = {
  name: string;
  model: string;
  vectorStore: boolean;
  description?: string;
  instructions?: string;
};

export type UpdateAssistantArgs = {
  name?: string;
  model?: string;
  description?: string;
  instructions?: string;
  vectorStoreId?: string;
  codeFileIds?: string[];
};

/**
 * See https://platform.openai.com/docs/api-reference/assistants
 */
export default class AssistantClient extends ClientCore {
  constructor(apiKey: string, { verbose }: { verbose?: boolean } = {}) {
    super(apiKey, { verbose });
  }

  static tryGetVectorStoreId(assistant: Assistant): string | undefined {
    const fileSearchTool = assistant.tools.find(
      (tool) => tool.type === 'file_search',
    );
    if (!fileSearchTool) {
      return undefined;
    }
    const data = assistant.tool_resources.file_search;
    if (!data) {
      return undefined;
    }
    if (data.vector_store_ids.length === 0) {
      return undefined;
    }
    return data.vector_store_ids[0];
  }

  async createAssistant(
    { name, model, description, instructions }: CreateAssistantArgs,
  ): Promise<Assistant> {
    this.log(`Creating assistant: ${name}`);
    this.log(`Model: ${model}`);
    this.log(`Description: ${description}`);
    this.log(`Instructions: ${instructions}`);
    const resp = await this.request<Assistant>({
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
      throw new ApiError(resp);
    } else {
      return resp.data!;
    }
  }

  async updateAssistant(
    assistantId: string,
    { name, model, description, instructions, vectorStoreId, codeFileIds }:
      UpdateAssistantArgs,
  ): Promise<Assistant> {
    this.log(`Updating assistant: ${assistantId}`);
    this.log(`Name: ${name}`);
    this.log(`Model: ${model}`);
    this.log(`Description: ${description}`);
    this.log(`Instructions: ${instructions}`);
    this.log(`Vector store ID: ${vectorStoreId}`);
    this.log(`Code file IDs: ${codeFileIds}`);

    // deno-lint-ignore no-explicit-any
    const body: any = {};
    if (name) {
      body.name = name;
    }
    if (model) {
      body.model = model;
    }
    if (description) {
      body.description = description;
    }
    if (instructions) {
      body.instructions = instructions;
    }
    if (vectorStoreId) {
      body.tool_resources = {
        file_search: {
          vector_store_ids: [vectorStoreId],
        },
      };
    }
    if (codeFileIds) {
      body.tool_resources = {
        ...body.tool_resources,
        code_interpreter: {
          file_ids: codeFileIds,
        },
      };
    }
    this.log(`Update assistant payload: ${JSON.stringify(body)}`);

    const resp = await this.request<Assistant>(
      {
        endpoint: `/assistants/${assistantId}`,
        options: {
          method: 'POST',
          body: JSON.stringify(body),
        },
      },
    );
    if (resp.status !== 200) {
      throw new ApiError(resp);
    } else {
      return resp.data!;
    }
  }

  async deleteAssistant(assistantId: string) {
    this.log(`Deleting assistant: ${assistantId}`);
    const resp = await this.request({
      endpoint: `/assistants/${assistantId}`,
      options: {
        method: 'DELETE',
      },
    });
    if (resp.status !== 200) {
      throw new ApiError(resp);
    }
  }

  async listAssistants(): Promise<Assistant[]> {
    this.log('Listing assistants');
    let after: string | undefined;
    let assistants: Assistant[] = [];
    const limit = 100 as const;
    do {
      const resp = await this.request<PaginationBody<Assistant>>({
        endpoint: `/assistants?limit=${limit}${after ? `&after=${after}` : ''}`,
        options: {
          method: 'GET',
        },
      });
      if (resp.status !== 200) {
        throw new ApiError(resp);
      }
      assistants = assistants.concat(resp.data!.data);
      after = resp.data!.has_more ? resp.data!.last_id : undefined;
    } while (after);
    return assistants;
  }

  async assistant(assistantId: string): Promise<Assistant> {
    this.log(`Getting assistant: ${assistantId}`);
    const resp = await this.request<Assistant>({
      endpoint: `/assistants/${assistantId}`,
      options: {
        method: 'GET',
      },
    });
    if (resp.status !== 200) {
      throw new ApiError(resp);
    } else {
      return resp.data!;
    }
  }

  async attachCodeFile(
    assistant: Assistant,
    fileId: string,
  ): Promise<Assistant> {
    this.log(`Attaching code file ${fileId} to assistant ${assistant.id}`);
    const codes: string[] =
      assistant.tool_resources?.code_interpreter?.file_ids || [];
    if (codes.includes(fileId)) {
      this.log('Code file already attached. Skipping');
      return assistant;
    }
    codes.push(fileId);
    const payload = {
      tool_resources: {
        code_interpreter: {
          file_ids: codes,
        },
      },
    };
    const resp = await this.request<Assistant>({
      endpoint: `/assistants/${assistant.id}`,
      options: {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    });
    if (resp.status !== 200) {
      throw new ApiError(resp);
    } else {
      return resp.data!;
    }
  }

  async detachCodeFile(
    assistant: Assistant,
    fileId: string,
  ): Promise<Assistant> {
    this.log(`Detaching code file ${fileId} from assistant ${assistant.id}`);
    const codes: string[] =
      assistant.tool_resources?.code_interpreter?.file_ids || [];
    if (!codes.includes(fileId)) {
      this.log('Code file not attached. Skipping');
      return assistant;
    }
    const newCodes = codes.filter((id) => id !== fileId);
    const payload = {
      tool_resources: {
        code_interpreter: {
          file_ids: newCodes,
        },
      },
    };
    const resp = await this.request<Assistant>({
      endpoint: `/assistants/${assistant.id}`,
      options: {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    });
    if (resp.status !== 200) {
      throw new ApiError(resp);
    } else {
      return resp.data!;
    }
  }
}
