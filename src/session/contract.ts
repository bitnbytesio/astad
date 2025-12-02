/**
 * @added v0.2.12
 */
export interface ISessionDriver {
  /**
   * get session id
   */
  id(): string
  /**
   * open/create new session
   * @param id 
   */
  open(id?: string): Promise<string>
  /**
   * write session data
   * @param data 
   */
  write(data: any): Promise<void>
  /**
   * read session data
   */
  read(): Promise<any>
  /**
   * closing session will auto flush data
   * closed session can be reopened
   */
  close(): Promise<void>
  /**
   * destroyed session cannot be recovered
   */
  destroy(): Promise<void>

  /**
   * reset session without closing and destroying
   */
  reset(): Promise<void>
}