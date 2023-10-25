export interface IViewEngine {
  render(template: string, data: any): Promise<any>
}