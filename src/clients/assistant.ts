import ClientCore from './core.ts';

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

    const resp = await this.request(
      {
        endpoint: `/assistants/${assistantId}`,
        options: {
          method: 'POST',
          body: JSON.stringify(body),
        },
      },
    );
    if (resp.status !== 200) {
      throw new Error(
        `Error updating assistant: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    } else {
      this.log(`Updated assistant: ${JSON.stringify(resp.data, null, 2)}`);
      return resp.data as Assistant;
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
      throw new Error(
        `Error deleting assistant: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    }
  }

  async listAssistants(): Promise<Assistant[]> {
    this.log('Listing assistants');
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
      this.log(`Assistants: ${JSON.stringify(resp.data, null, 2)}`);
      return (resp.data as { data: Assistant[] }).data as Assistant[];
    }
  }

  async assistant(assistantId: string): Promise<Assistant> {
    this.log(`Getting assistant: ${assistantId}`);
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
      this.log(`Assistant: ${JSON.stringify(resp.data, null, 2)}`);
      return resp.data as Assistant;
    }
  }
}
