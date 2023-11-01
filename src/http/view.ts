import { IHttpContext } from "./context.js";
import { IHttpError } from "./response.js";

export interface IViewEngine {
  render(ctx: IHttpContext, template: string, data: any): Promise<any>
  renderError(ctx: IHttpContext, error: IHttpError): Promise<any>
}