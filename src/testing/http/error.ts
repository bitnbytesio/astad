export class TestHttpError extends Error {
  readonly code: number;
  constructor(readonly status: number, message: string) {
    super(message);
    this.code = status;
  }
}