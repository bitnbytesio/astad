export class Conf {
  protected bag: Record<any, any> = {};

  constructor(protected opts: { env: Record<string, string>, mergeEnv: boolean } = {
    env: {},
    mergeEnv: false,
  }) { }

  /**
   * read environment variable value
   * @param key 
   * @returns 
   */
  env(key: string): string | undefined {
    return process.env[key];
  }

  /**
   * read value from local environment, if not exists fallback to process
   * @param key 
   * @returns 
   */
  var(key: string) {
    if (typeof this.opts.env[key] != 'undefined') {
      return this.opts.env[key];
    }
    return this.env(key);
  }

  dvar(k: string, d: string) {
    let v = this.opts.env[k] as string | undefined;
    if (typeof v == 'undefined') {
      v = this.env(k);
    }
    if (typeof v == 'undefined') {
      return d;
    }
    return v;
  }

  setVar(k: string, d: string) {
    this.opts.env[k] = d;
  }

  set<T = any>(k: any, v: T) {
    return this.bag[k] = v;
  }

  get<T = any>(k: any, d: T | null = null): T | null {
    return this.bag[k] || d;
  }

}