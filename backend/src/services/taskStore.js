/**
 * In-memory task store
 * Replace with PostgreSQL/MongoDB in production
 */

class TaskStore extends Map {
  constructor() {
    super();
    this._listeners = {};
  }

  set(id, task) {
    super.set(id, task);
    this._emit('change', { id, task });
    return this;
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  }

  getByStatus(status) {
    return Array.from(this.values()).filter(t => t.status === status);
  }

  getExpired() {
    const now = new Date();
    return Array.from(this.values()).filter(
      t => ['open', 'claimed'].includes(t.status) && new Date(t.deadline) < now
    );
  }
}

module.exports = new TaskStore();
