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
    { name, model, description, instructions, vectorStoreId }:
      UpdateAssistantArgs,
  ): Promise<Assistant> {
    this.log(`Updating assistant: ${assistantId}`);
    this.log(`Name: ${name}`);
    this.log(`Model: ${model}`);
    this.log(`Description: ${description}`);
    this.log(`Instructions: ${instructions}`);
    this.log(`Vector store ID: ${vectorStoreId}`);

    // deno-lint-ignore no-explicit-any
    const body: any = {
      name,
      description,
      model,
      instructions,
    };
    if (vectorStoreId) {
      body.tool_resources = {
        file_search: {
          vector_store_ids: [vectorStoreId],
        },
      };
    }

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
}
