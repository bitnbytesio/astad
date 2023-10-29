export interface IHttpFile {
  originalName: string
  type: string
  size: number
  path: string
  extension: string
}

export interface ITestHttpContext {
  host?: string
  method?: string
  path: string
  protocol?: string
  URL?: URL
  ip?: string
  ips?: string[]
  body?: any
  query?: Record<string, string | string[]>
  headers?: Record<string, string | string[]>
  files?: Record<string, IHttpFile>
}

export interface ITestHttpResponse<T = any> {
  headers: Record<string, string | string[]>,
  status: number,
  body: T,
  redirect?: { url: string, alt?: string }
}