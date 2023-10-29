import { IHttpContext } from "./context.js";

export interface IViewEngine {
  render(ctx: IHttpContext, template: string, data: any): Promise<any>
}