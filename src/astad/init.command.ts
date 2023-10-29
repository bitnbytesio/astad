import * as https from 'node:https';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
// import { builtinModules as builtin } from 'node:module';

import { CliContext, CommandCompose, ICommand } from '../cli/index.js';
import { existsSync } from 'node:fs';


export class InitCommand implements ICommand {
  signature: string = "init";

  description: string = "This command will create boilerplate!";

  protected tmproot: string | null = null

  compose(): CommandCompose {
    const command = new CommandCompose(this.signature);

    return command;
  }

  get root() {
    return process.cwd();
  }


  async handle(ctx: CliContext) {
    ctx.info('Hello Astad!');
    // const usingesm = await ctx.confirm("Do you want to use ESM?");
    // if (usingesm) {
    //   ctx.info('using esm boilerplate')
    // } else {
    //   ctx.info('using common boilerplate')
    // }

    // const usingts = await ctx.confirm("Do you do it in typescript?");
    // if (usingts) {
    //   ctx.info('configuring typings')
    // } else {
    //   ctx.info('using plain javascript')
    // }

    await this.generate(ctx)
  }

  async generate(ctx: CliContext) {
    // create tmp ddirectory
    this.tmproot = await fs.mkdtemp(path.join(os.tmpdir(), 'astad-'));
    ctx.infof('tmp directory: %s', this.tmproot);

    // create tmp src
    const tmpsrc = path.join(this.tmproot, 'src')
    await fs.mkdir(tmpsrc);

    // create entry file
    const tmpentry = path.join(tmpsrc, 'index.ts');
    const entryfh = await fs.open(tmpentry, 'w+');
    // compose entry file
    const entry = new EntryBuilder('src/index.ts', entryfh);
    await entry.flush();

    // decide output directory
    const outroot = path.join(this.root, 'out-dist');
    ctx.infof('output directory: %s', outroot);
    if (existsSync(outroot)) {
      // clean it, if already exists
      ctx.infof('cleaning directory: %s', outroot);
      await fs.rm(outroot, { recursive: true });
    }
    ctx.infof('make directory: %s', outroot);
    await fs.mkdir(outroot);
    // copy content from tmp directory to output directory
    await fs.cp(this.tmproot, outroot, { recursive: true, force: true });
    console.info('content populated!');
    console.info('generating package.json...');

    const pkgjson = {
      name: 'astad-boilerplate',
      version: '0.1.0',
      private: true,
      type: 'module',
      description: "astad is a nodejs framework for api and web development",
      engines: {
        node: ">=16.4"
      },
      scripts: {
        test: "echo \"Error: no test specified\" && exit 1"
      },
      license: "UNLICENSED",
      dependencies: StmtImport.instance().modulesToInstall,
    };

    for (const m in pkgjson.dependencies) {
      try {
        const ver = await fetchPackageInfo(m);
        pkgjson.dependencies[m] = `^${ver}`;
      } catch (err) {
        console.error(err);
        pkgjson.dependencies[m] = 'latest';
      }
    }

    const outpkgjson = path.join(outroot, 'package.json');
    await fs.writeFile(outpkgjson, JSON.stringify(pkgjson, null, 2));
  }
}

class EntryBuilder {
  cursor = 0;
  stmtImport: StmtImport;
  block = 0;
  indent = 2;

  constructor(readonly file: string, protected entryfh: fs.FileHandle) {
    this.stmtImport = StmtImport.instance()
  }

  async write(str: string | Buffer) {
    let padding = '';
    if (this.block >= 1) {
      padding = new Array(this.block * this.indent).fill(' ').join('');
    }
    const { bytesWritten } = await this.entryfh.write(Buffer.from(padding + str));
    this.cursor += bytesWritten;
  }

  async flush() {
    // import statements
    await this.write(await this.stmtImport.import('dotenv', ['config']));
    await this.write(await this.stmtImport.import('astad', ['HttpApp', 'HttpKoa', 'HttpCors', 'Config']));
    await this.write(await this.stmtImport.import('koa', 'Koa'));
    await this.write(await this.stmtImport.import('koa-logger', 'koaLogger'));
    await this.write(await this.stmtImport.import('ejs', 'ejs'));

    // local import statements
    await this.newline();
    await this.comment('local imports');
    await this.write(await this.stmtImport.local(this.file, './http/web/index.js', 'web'));
    await this.write(await this.stmtImport.local(this.file, './http/api/index.js', 'api'));

    // dotenv config
    await this.newline();
    await this.comment('configure env file');
    await this.statement('config()');

    // config instance
    await this.newline();
    await this.comment('configuration instance');
    await this.statement('const conf = new Config.Conf()');
    await this.comment('set configuration example');
    await this.comment(`conf.set('debug', true);`);

    // koa framework instance
    await this.newline();
    await this.comment('koa instance');
    await this.statement(`const app = new Koa()`);
    await this.comment('add middleware directly to koa');
    await this.statement(`app.use(koaLogger())`);

    // http app instance
    await this.newline();
    await this.comment('create http app');
    await this.statement(`const httpApp = new HttpApp({ use: new HttpKoa(app), conf })`);
    await this.comment('set middlewares to use astad context');
    await this.startBlock(`if (conf.dvar('CORS', 'true')) {`)
    await this.statement('httpApp.use(new HttpCors())');
    await this.endBlock(`}`);

    // setup view engine
    await this.newline();
    await this.startBlock(`httpApp.viewEngine(new class {`);
    await this.startBlock(`async render(template: string, data: Record<any, any> = {}) {`);
    await this.statement(`return await ejs.renderFile(\`./src/resources/views/\${template}.ejs.html\`, data)`);
    await this.endBlock(`}`);
    await this.endBlock(`});`);

    // register routers
    await this.newline();
    await this.comment('register routers');
    await this.statementWithComment(`httpApp.router(web)`, 'web router');
    await this.statementWithComment(`httpApp.router('/api', api)`, 'api router');

    // start server
    await this.newline();
    await this.comment('start server');
    await this.statement(`httpApp.listen()`);

    // end file with newline
    await this.newline();
  }

  async startBlock(stmt: string) {
    await this.write(`${stmt}\n`);
    this.block += 1;
  }

  async endBlock(stmt: string) {
    this.block -= 1;
    await this.write(`${stmt}\n`);
  }

  statement(stmt: string) {
    return this.write(`${stmt};\n`);
  }

  statementWithComment(stmt: string, comment: string) {
    return this.write(`${stmt}; // ${comment}\n`);
  }

  comment(message: string) {
    return this.write(`// ${message}\n`);
  }

  newline() {
    return this.write("\n");
  }
}

class StmtImport {
  modulesToInstall: Record<string, any> = {};
  localImports: Record<string, any> = {};
  protected static _instance: StmtImport | null = null;

  constructor() { }

  static instance() {
    if (this._instance) {
      return this._instance;
    }
    return this._instance = new StmtImport();
  }

  importStatement(
    m: string,
    alias: string | string[] = [],
    { node = false, local = null, external = true }: { node: boolean, local: null | string, external: boolean },
  ) {
    if (external) {
      this.modulesToInstall[m] = true;
    }
    if (local) {
      if (!Array.isArray(this.localImports[local])) {
        this.localImports[local] = [];
      }
      this.localImports[local].push(m);
    }

    const aliasstr = Array.isArray(alias) ? `{ ${alias.join(', ')} }` : alias;
    const stmt = `import ${aliasstr} from '${node ? 'node:' + m : m}';\n`
    // const { bytesWritten } = await entryfh.write(Buffer.from(stmt));
    return stmt;
  }

  node(m: string, alias: string | string[] = []) {
    return this.importStatement(m, alias, { node: true, local: null, external: false });
  }

  import(m: string, alias: string | string[] = []) {
    return this.importStatement(m, alias, { node: false, local: null, external: true });
  }

  local(file: string, m: string, alias: string | string[] = []) {
    return this.importStatement(m, alias, { node: false, local: file, external: false });
  }
}

// @ts-ignore
function fetchPackageInfo(m: string) {
  return new Promise((resolve, reject) => {
    const req = https.get(`https://registry.npmjs.org/${m}/latest`, res => {
      if (res.statusCode != 200) {
        reject(res.statusCode);
        return;
      }

      const chunks: any = [];

      res.on('data', chunk => {
        chunks.push(chunk);
      });
      res.on('end', () => {
        resolve(JSON.parse(Buffer.concat(chunks).toString()).version);
      });
    });

    req.on('error', reject);
    req.end();
  });
}