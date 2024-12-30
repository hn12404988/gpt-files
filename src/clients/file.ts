import ClientCore, { ApiError, type PaginationBody } from './core.ts';
import { typeByExtension } from '@std/media-types';

export interface FileResponse {
  id: string;
  filename: string;
  bytes: number;
  created_at: number;
  purpose: string;
}

/**
 * See https://platform.openai.com/docs/api-reference/files
 */
export default class FileClient extends ClientCore {
  constructor(apiKey: string, { verbose }: { verbose?: boolean } = {}) {
    super(apiKey, { verbose });
  }

  static getFileName(
    { filePath, newFileName }: { filePath: string; newFileName?: string },
  ): string {
    const originalFilename = filePath.split('/').pop();
    const name = newFileName || originalFilename;
    if (!name) {
      throw new Error('File name is required');
    }
    return name;
  }

  static getFileType(filePath: string): string {
    const extension = filePath.split('.').pop();
    if (!extension) {
      throw new Error('File extension is required');
    }
    return typeByExtension(extension) ?? 'application/octet-stream';
  }

  async get(fileId: string): Promise<FileResponse> {
    this.log(`Getting file ${fileId}`);
    const resp = await this.request<FileResponse>({
      endpoint: `/files/${fileId}`,
      options: {
        method: 'GET',
      },
      useV2: false,
    });
    if (resp.status !== 200) {
      throw new ApiError(resp);
    }
    this.log(`File ${fileId} retrieved`);
    this.log(`Response: ${JSON.stringify(resp.data, null, 2)}`);
    return resp.data!;
  }

  async upload(
    { filePath, fileName }: { filePath: string; fileName: string },
  ): Promise<FileResponse> {
    this.log(`Uploading file: ${filePath} with file name: ${fileName}`);
    const formData = new FormData();
    const file = await Deno.readFile(filePath);
    const blob = new Blob([file], { type: FileClient.getFileType(filePath) });

    formData.append('purpose', 'assistants');
    formData.append(
      'file',
      blob,
      fileName,
    );
    for (const e of formData.entries()) {
      this.log(`Form data entry: ${JSON.stringify(e, null, 2)}`);
    }

    const resp = await this.request<FileResponse>({
      endpoint: '/files',
      options: {
        method: 'POST',
      },
      useV2: false,
      formData,
    });
    if (resp.status !== 200) {
      throw new ApiError(resp);
    }
    return resp.data!;
  }

  async delete(fileId: string) {
    this.log(`Deleting file ${fileId}`);
    const resp = await this.request({
      endpoint: `/files/${fileId}`,
      options: {
        method: 'DELETE',
      },
      useV2: false,
    });
    if (resp.status !== 200) {
      throw new ApiError(resp);
    }
    this.log(`File ${fileId} deleted`);
  }

  async search(fileName: string): Promise<FileResponse | null> {
    let after: string | undefined;
    const limit = 100 as const;
    do {
      const resp = await this.request<PaginationBody<FileResponse>>({
        endpoint: `/files?limit=${limit}${after ? `&after=${after}` : ''}`,
        options: {
          method: 'GET',
        },
        useV2: false,
      });
      if (resp.status !== 200) {
        throw new ApiError(resp);
      }
      const files = resp.data!.data;
      const file = files.find((f) => f.filename === fileName);
      if (file) {
        return file;
      }
      after = resp.data!.has_more ? resp.data!.last_id : undefined;
    } while (after);
    return null;
  }

  async list(): Promise<FileResponse[]> {
    let after: string | undefined;
    let files: FileResponse[] = [];
    const limit = 100 as const;
    do {
      const resp = await this.request<PaginationBody<FileResponse>>({
        endpoint: `/files?limit=${limit}${after ? `&after=${after}` : ''}`,
        options: {
          method: 'GET',
        },
        useV2: false,
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
