export interface IHttpError {
  status: number
  message: string
  expose?: boolean
  data?: any
}

type ResultErrorInput = IResultErrorAttributes | ResultError | Error;

export class Result<RValue = any, RError = ResultErrorInput> {
  constructor(
    readonly ok: boolean,
    readonly _error: RError | null,
    readonly _value: RValue | null = null
  ) { }

  get value() {
    return (this._error || this._value) as RError | RValue;
  }

  getValue<V = RValue>() {
    if (!this.ok) {
      throw new Error(`Can't retrieve the value from a failed result.`);
    }
    return this._value as V;
  }

  getError<E = RError>() {
    return this._error as E;
  }

  error() {
    return this._error as ResultError;
  }

  static ok<V = any>(value: V) {
    return new Result<V>(true, null, value);
  }
  static error<V = any>(error: ResultErrorInput) {
    return new Result<V>(false, ResultError.from(error));
  }

  static allOk(...results: Result[]) {
    const values = [];
    for (const result of results) {
      if (!result.ok) {
        return result;
      }
      values.push(result.getValue());
    }

    return Result.ok<typeof values>(values);
  }

  with() {

  }
}

export interface IResult<RValue = any, RError = ResultErrorInput> {
  value: RError | RValue
  getValue<V = RValue>(): V
  getError<E = RError>(): E
  error(): ResultError
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

  get status() {
    return this.code;
  }

  get data() {
    return this._data || {};
  }

  metadata(data?: any) {
    if (data) {
      this._data = data;
    }
    return this._data || {};
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

  static try(error: ResultErrorInput, data?: IResultErrorData): ResultError {
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

  toHttpResponse() {
    return {
      status: this.status,
      body: {
        message: this.expose ? this.message : 'Internal server error.',
        ...(this.data || {}),
      }
    };
  }

  toHttpError(): IHttpError {
    return {
      status: this.status,
      message: this.message,
      expose: this.expose,
      data: { ...(this.data || {}) },

    };
  }

  toObject() {
    return {
      code: this.code,
      message: this.message,
      expose: this.expose,
      data: { ...(this.data || {}) },
    };
  }

  toJSON() {
    return this.toObject();
  }
}
