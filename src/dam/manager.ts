import { IConnection } from './connection.js';

export class EntityManager {
  constructor(protected connection: IConnection) { }

  put() { }
  flush() { }
  create() { }
  upsert() { }
}