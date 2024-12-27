import ClientCore from './core.ts';

export interface FileResponse {
  id: string;
  filename: string;
  bytes: number;
  created_at: number;
  purpose: string;
}

export default class FileClient extends ClientCore {
  constructor(apiKey: string, { verbose }: { verbose?: boolean } = {}) {
    super(apiKey, { verbose });
  }

  async get(fileId: string): Promise<FileResponse> {
    this.log(`Getting file ${fileId}`);
    const resp = await this.request({
      endpoint: `/files/${fileId}`,
      options: {
        method: 'GET',
      },
      useV2: false,
    });
    if (resp.status !== 200) {
      throw new Error(
        `Error getting file: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    }
    this.log(`File ${fileId} retrieved`);
    this.log(`Response: ${JSON.stringify(resp.data, null, 2)}`);
    return resp.data as FileResponse;
  }

  async upload(
    { filePath, newFileName }: { filePath: string; newFileName?: string },
  ): Promise<FileResponse> {
    this.log(`Uploading file: ${filePath} with new name: ${newFileName}`);
    const formData = new FormData();
    const file = await Deno.readFile(filePath);
    const blob = new Blob([file], { type: 'application/octet-stream' });
    const originalFilename = filePath.split('/').pop();
    const uploadFilename = newFileName || originalFilename;

    formData.append('purpose', 'assistants');
    formData.append(
      'file',
      blob,
      uploadFilename,
    );
    for (const e of formData.entries()) {
      this.log(`Form data entry: ${JSON.stringify(e, null, 2)}`);
    }

    const fileResponse = await this.request({
      endpoint: '/files',
      options: {
        method: 'POST',
      },
      useV2: false,
      formData,
    });
    if (fileResponse.status !== 200) {
      throw new Error(
        `Error uploading file: ${fileResponse.status} ${fileResponse.statusText}\n${fileResponse.rawData}`,
      );
    }
    this.log(`File uploaded: ${JSON.stringify(fileResponse.data, null, 2)}`);
    return fileResponse.data as FileResponse;
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
      throw new Error(
        `Error deleting file: ${resp.status} ${resp.statusText}\n${resp.rawData}`,
      );
    }
    this.log(`File ${fileId} deleted`);
    this.log(`Response: ${JSON.stringify(resp.data, null, 2)}`);
  }
}
