import { EventCallback, EventIdentifier, IEventSubscriber } from "./contracts.js";
import { EventTransporter } from "./event.js";

export class EventHandler {
  readonly transporter: EventTransporter;

  constructor(
    transporter?: EventTransporter
  ) {
    if (!transporter) {
      transporter = new EventTransporter();
    }
    this.transporter = transporter;
  }

  queue(event: EventIdentifier, cb: EventCallback) {
    this.transporter.queue(event, cb);
  }

  subscriber(subscriber: IEventSubscriber) {
    subscriber.subscribe(this);
  }

  on(event: EventIdentifier, cb: EventCallback) {
    this.transporter.on(event, cb);
  }

  emit(event: EventIdentifier, data: any) {
    return this.transporter.emit(event, data);
  }
}
