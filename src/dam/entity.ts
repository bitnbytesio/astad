export interface IEntitySource {
  toSource(): any
}

export type EntitySource = { source: (data: any) => any }

export type EntityObject<T = any> = IEntitySource & EntitySource & { attrs: T };

/**
 * will track changes
 */
export class EntityState {
  /**
   * store cloned attributes
   */
  original: any = null;
  /**
   * store attributes ref
   */
  current: any = null;

  constructor(attrs: any) {
    this.original = structuredClone(attrs);
    this.current = attrs;
  }

  changes() {

  }

  cloneOriginal() {

  }

  clone() {

  }
}

/**
 * use for typecasting and self validation
 */
export class EntitySchema {

}

export class EntitySchemaManager {

}

export class EntityCollection<T> extends Array<T> {

}

// class ExampleEntity {
//   readonly state: EntityState;

//   constructor(protected attrs: any = {}) {
//     this.state = new EntityState(attrs);
//   }

//   static source(data: any): ExampleEntity {
//     return new ExampleEntity({
//       id: data._id.toString(),
//       name: data.name,
//       createdAt: data.createdAt,
//     });
//   }

//   toSource() {

//   }
// }

export class EntityComposer {

}