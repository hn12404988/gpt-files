import ClientCore from './core.ts';
import type { FileResponse } from './file.ts';

export interface VectorStoreFile {
  id: string;
  object: string; // If not 'vector_store.file', then this file is not attached to a vector store
  usage_bytes: number;
  created_at: number;
  vector_store_id: string;
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled';
}

export default class VectorStoreClient extends ClientCore {
  constructor(apiKey: string, { verbose }: { verbose?: boolean } = {}) {
    super(apiKey, { verbose });
  }

  /**
   * See https://platform.openai.com/docs/api-reference/vector-stores/create
   * @param name {string} The name of the vector store. Let's use the same name as the assistant
   * @returns {string} The ID of the created vector store
   */
  async create(name: string): Promise<string> {
    this.log(`Creating vector store: ${name}`);
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
      this.log(`Vector store created: ${JSON.stringify(resp.data, null, 2)}`);
      return (resp.data as { id: string }).id;
    }
  }

  async delete(vStoreId: string): Promise<void> {
    this.log(`Deleting vector store ${vStoreId}`);
    const resp = await this.request({
      endpoint: `/vector_stores/${vStoreId}`,
      options: {
        method: 'DELETE',
      },
    });
    if (resp.status !== 200) {
      throw new Error(
        `Error deleting vector store: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    }
    this.log(`Vector store ${vStoreId} deleted`);
  }

  async attachFile(
    { file, vStoreId }: { file: FileResponse; vStoreId: string },
  ): Promise<VectorStoreFile> {
    this.log(`Attaching file ${file.id} to vector store ${vStoreId}`);
    const resp = await this.request({
      endpoint: `/vector_stores/${vStoreId}/files`,
      options: {
        method: 'POST',
        body: JSON.stringify({ file_id: file.id }),
      },
    });
    if (resp.status !== 200) {
      throw new Error(
        `Error attaching file to vector store: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    }
    return resp.data as VectorStoreFile;
  }

  async detachFile(
    { fileId, vStoreId }: { fileId: string; vStoreId: string },
  ): Promise<void> {
    this.log(`Detaching file ${fileId} from vector store ${vStoreId}`);
    const resp = await this.request({
      endpoint: `/vector_stores/${vStoreId}/files/${fileId}`,
      options: {
        method: 'DELETE',
      },
    });
    if (resp.status !== 200) {
      throw new Error(
        `Error detaching file from vector store: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    }
    this.log(`File ${fileId} detached from vector store ${vStoreId}`);
    this.log(`Response: ${JSON.stringify(resp.data, null, 2)}`);
  }

  async listFiles(vStoreId: string): Promise<VectorStoreFile[]> {
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
}
