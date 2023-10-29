export type EventIdentifier = string | symbol;
export type EventCallback = (event: any) => any;

export interface IEventListener {
  on(event: EventIdentifier, cb: EventCallback): void
}

export interface IEventSubscriber {
  subscribe(listener: IEventListener): void
}

export interface IEventHandler {
  subscriber(subscriber: IEventSubscriber): void
  on(event: EventIdentifier, cb: EventCallback): void
  emit(event: EventIdentifier, data: any): void
}
