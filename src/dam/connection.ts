import { Result } from "../support/result.js"



export interface IConnectionIssuePK {
  issuePrimaryKey(): Promise<IPrimaryKey>
}

export interface IConnection {
  find<T = any>(): Promise<Result<Array<T>>>

  findOne<T = any>(): Promise<Result<T>>
  findMany<T = any>(): Promise<Result<Array<T>>>

  insertOne(): Promise<Result<IPrimaryKey>>
  insertMany(): Promise<Result>

  updateOne(): Promise<Result>
  updateMany(): Promise<Result>

  upsert(): Promise<Result>

  deleteOne(): Promise<Result>
  deleteMany(): Promise<Result>
}

export interface IPrimaryKey<T = any> {
  id: T
  toString(): string
}