export class SimpleAuthClient {
  constructor(private token: string) {}

  getAuthHeader(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
    };
  }

  fetch(url: string, options?: RequestInit): Promise<Response> {
    return fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        ...this.getAuthHeader(),
      },
    });
  }
}
