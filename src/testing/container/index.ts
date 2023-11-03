import { Container, ContainerValue } from "../../container/index.js";

export class TestContainer {
  temp: Container
  tempValues: ContainerValue[] = []
  constructor(readonly container: Container) {
    this.temp = new Container(this.container.id.toString() + '_' + Math.random());

  }

  shouldProvide(...args: ContainerValue[]) {
    for (const data of args) {
      const serviceValue = this.container.findRegistryValue(data.id);
      if (serviceValue) {
        this.temp.register(serviceValue);
      }
      this.container.delete(data.id);
      this.container.register(data);
      this.tempValues.push(data);
    }
  }

  revert() {
    for (const data of this.tempValues) {
      this.container.delete(data.id);
      if (this.temp.has(data.id)) {
        this.container.register(data);
      }
    }
  }
}