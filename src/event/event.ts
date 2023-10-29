import { EventEmitter } from "events";
import { EventIdentifier, EventCallback } from "./contracts.js";

export class EventTransporter extends EventEmitter {
  queue(event: EventIdentifier, cb: EventCallback) {
    console.warn('Event transporter does not support queue.');
    super.on(event, cb);
  }

  on(event: EventIdentifier, cb: EventCallback) {
    super.on(event, cb);
    return this;
  }

  emit(event: EventIdentifier, data: any) {
    return super.emit(event, data);
  }
}