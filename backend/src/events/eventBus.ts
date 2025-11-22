import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  emitEvent<T>(eventName: string, data: T): void {
    console.log(`[EventBus] Emitting: ${eventName}`, JSON.stringify(data, null, 2));
    this.emit(eventName, data);
  }

  onEvent<T>(eventName: string, handler: (data: T) => void | Promise<void>): void {
    console.log(`[EventBus] Registering listener for: ${eventName}`);
    this.on(eventName, handler);
  }

  offEvent<T>(eventName: string, handler: (data: T) => void | Promise<void>): void {
    this.off(eventName, handler);
  }
}

export const eventBus = EventBus.getInstance();
