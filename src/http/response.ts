type ResponseHeaders = Record<string, string | string[]>;

export class HttpResponse {
  protected _headers: ResponseHeaders = {};

  constructor(
    protected data: any,
    readonly status: number,
  ) { }

  get body() {
    return this.data;
  }

  setHeader(key: string, value: string) {
    this._headers[key] = value;
  }

  setHeaders(headers: ResponseHeaders) {
    this._headers = headers;
  }

  mergeHeaders(headers: ResponseHeaders) {
    this._headers = { ...this._headers, ...headers };
  }

  get headers() {
    return this._headers;
  }

  static noContent() {
    return new HttpResponse(undefined, 204);
  }

  toString() {
    if (this.status == 204) {
      return '';
    }
    return this.data;
  }
}