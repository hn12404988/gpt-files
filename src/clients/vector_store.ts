import ClientCore, { ApiError, type PaginationBody } from './core.ts';
import type { FileResponse } from './file.ts';

export interface VectorStoreFile {
  id: string;
  object: string; // If not 'vector_store.file', then this file is not attached to a vector store
  usage_bytes: number;
  created_at: number;
  vector_store_id: string;
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled';
}

export interface VectorStore {
  id: string;
  object: string; // Should always be 'vector_store'
  created_at: number;
  name: string;
  usage_bytes: number;
  status: 'expired' | 'in_progress' | 'completed';
  expires_at: number;
  last_activate_at: number;
  file_counts: {
    in_progress: number;
    completed: number;
    failed: number;
    cancelled: number;
    total: number;
  };
}

/**
 * See https://platform.openai.com/docs/api-reference/vector-stores
 */
export default class VectorStoreClient extends ClientCore {
  constructor(apiKey: string, { verbose }: { verbose?: boolean } = {}) {
    super(apiKey, { verbose });
  }

  async get(vStoreId: string): Promise<VectorStore> {
    this.log(`Getting vector store info: ${vStoreId}`);
    const resp = await this.request<VectorStore>({
      endpoint: `/vector_stores/${vStoreId}`,
      options: {
        method: 'GET',
      },
    });
    if (resp.status !== 200) {
      throw new ApiError(resp);
    }
    return resp.data!;
  }

  /**
   * See https://platform.openai.com/docs/api-reference/vector-stores/create
   * @param name {string} The name of the vector store. Let's use the same name as the assistant
   * @returns {VectorStore} The created vector store
   */
  async create(name: string): Promise<VectorStore> {
    this.log(`Creating vector store: ${name}`);
    const resp = await this.request<VectorStore>({
      endpoint: '/vector_stores',
      options: {
        method: 'POST',
        body: JSON.stringify({ name }),
      },
    });

    if (resp.status !== 200) {
      throw new ApiError(resp);
    } else {
      return resp.data!;
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
      throw new ApiError(resp);
    }
    this.log(`Vector store ${vStoreId} deleted`);
  }

  async list(): Promise<VectorStore[]> {
    let after: string | undefined;
    let stores: VectorStore[] = [];
    const limit = 100 as const;
    do {
      const resp = await this.request<PaginationBody<VectorStore>>({
        endpoint: `/vector_stores?limit=${limit}${
          after ? `&after=${after}` : ''
        }`,
        options: { method: 'GET' },
      });
      if (resp.status !== 200) {
        throw new ApiError(resp);
      }
      stores = stores.concat(resp.data!.data);
      after = resp.data!.has_more ? resp.data!.last_id : undefined;
    } while (after);
    return stores;
  }

  async attachFile(
    { file, vStoreId }: { file: FileResponse; vStoreId: string },
  ): Promise<VectorStoreFile> {
    this.log(`Attaching file ${file.id} to vector store ${vStoreId}`);
    const resp = await this.request<VectorStoreFile>({
      endpoint: `/vector_stores/${vStoreId}/files`,
      options: {
        method: 'POST',
        body: JSON.stringify({ file_id: file.id }),
      },
    });
    if (resp.status !== 200) {
      throw new ApiError(resp);
    }
    return resp.data!;
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
      throw new ApiError(resp);
    }
    this.log(`File ${fileId} detached from vector store ${vStoreId}`);
  }

  async listFiles(vStoreId: string): Promise<VectorStoreFile[]> {
    let after: string | undefined;
    let files: VectorStoreFile[] = [];
    const limit = 100 as const;
    do {
      const resp = await this.request<PaginationBody<VectorStoreFile>>({
        endpoint: `/vector_stores/${vStoreId}/files?limit=${limit}${
          after ? `&after=${after}` : ''
        }`,
        options: { method: 'GET' },
      });
      if (resp.status !== 200) {
        throw new ApiError(resp);
      }
      files = files.concat(resp.data!.data);
      after = resp.data!.has_more ? resp.data!.last_id : undefined;
    } while (after);
    return files;
  }
}
