export interface PaginationBody<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
  first_id: string;
  last_id: string;
}

export interface ApiResponse<T> {
  data?: T;
  status: number;
  statusText?: string;
  rawData?: string;
}

export default class ClientCore {
  protected readonly apiKey: string;
  private readonly baseUrl = 'https://api.openai.com/v1';
  private readonly verbose: boolean;

  protected constructor(
    apiKey: string,
    { verbose }: { verbose?: boolean } = {},
  ) {
    this.apiKey = apiKey;
    this.verbose = verbose || false;
  }

  protected log(message: string) {
    if (this.verbose) {
      console.log(message);
    }
  }

  protected async request<T>(
    { endpoint, options, formData, useV2 = true }: {
      endpoint: string;
      options: RequestInit;
      formData?: FormData;
      useV2?: boolean;
    },
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      ...options.headers,
    };
    if (!formData) {
      headers['Content-Type'] = 'application/json';
    }
    // By default, use v2
    if (useV2) {
      headers['OpenAI-Beta'] = 'assistants=v2';
    }
    const init: RequestInit = {
      ...options,
      headers,
      body: formData ? formData : options.body,
    };
    this.log(`Requesting ${this.baseUrl}${endpoint}`);
    this.log(`Options: ${JSON.stringify(init, null, 2)}`);
    const response = await fetch(`${this.baseUrl}${endpoint}`, init);
    this.log(`Response status: ${response.status}`);
    this.log(`Response statusText: ${response.statusText}`);

    const rawData = await response.text();
    this.log(`Response data: ${rawData}`);

    if (response.ok) {
      try {
        const data = JSON.parse(rawData);
        return {
          data,
          status: response.status,
        };
      } catch (_) {
        return {
          rawData,
          status: 500,
          statusText: 'Fail on json encode even when 200',
        };
      }
    } else {
      try {
        return {
          rawData,
          status: response.status,
          statusText: response.statusText,
        };
      } catch (_) {
        return {
          rawData,
          status: response.status,
          statusText: response.statusText,
        };
      }
    }
  }
}

export class ApiError extends Error {
  constructor(resp: ApiResponse<unknown>) {
    super(`Error: ${resp.status} ${resp.statusText}\n${resp.rawData}`);
  }
}
