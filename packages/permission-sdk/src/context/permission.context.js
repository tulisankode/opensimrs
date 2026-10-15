export class PermissionContext {
  static #context = new Map();

  static setContext(key, value) {
    this.#context.set(key, value);
  }

  static getContext(key) {
    return this.#context.get(key);
  }
}

export const REDIS = "REDIS";
