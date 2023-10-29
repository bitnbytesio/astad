interface PK {
  issue(): any
  to(): any
  from(): any
}

export class MongoConnection {
  constructor(protected client: any, protected pk: PK) { }

  issuePrimaryKey() {
    return this.pk.issue();
  }

}