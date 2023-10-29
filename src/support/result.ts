type ResultErrorInput = IResultErrorAttributes | ResultError | Error;

export class Result<V = any, E = ResultErrorInput> {
  constructor(readonly value: V | E, readonly ok: boolean) { }

  error<T = ResultError>() {
    return this.value as T;
  }

  static ok<V = any>(value: V) {
    return new Result<V>(value, true);
  }
  static error<V = any>(error: ResultErrorInput) {
    return new Result<V>(ResultError.from(error), false);
  }

  // with() {

  // }
}

export interface IResultErrorAttributes {
  message: string
  code: any
  data?: IResultErrorData
}

export interface IResultErrorData {
  [key: string | number | symbol]: any
}

export class ResultError extends Error {
  expose = true;

  constructor(readonly message: string, readonly code: any, protected _data = {}) {
    super(message);
  }

  metadata() {
    return this._data;
  }

  static from(error: ResultErrorInput, data?: IResultErrorData): ResultError {
    if (error instanceof ResultError) {
      return error;
    }
    if (error instanceof Error) {
      let code = 500;
      if (data && typeof data['code'] != "undefined") {
        code = data['code'];
      } else if ((error as any).code) {
        code = (error as any).code;
      }

      return new ResultError(error.message, code || 500, data);
    }
    return new ResultError(error.message, error.code, error.data);
  }

  toJSON() {
    return {
      message: this.expose ? this.message : 'Internal server error.',
      code: this.code,
    };
  }
}
