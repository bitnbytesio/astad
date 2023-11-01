type ResponseHeaders = Record<string, string | string[]>;

export interface IHttpError {
  status: number
  message: string
  data?: any
}

export interface IHttpResponse<T = any> {
  body?: T
  status: number
  headers?: Record<string, string>
}

export class HttpResponse {
  protected _headers: ResponseHeaders = {};

  constructor(
    protected data: any,
    protected status: number,
  ) { }

  get body() {
    return this.data;
  }

  setStatus(status: number) {
    this.status = status;
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