/** Cache model loads and let only the most recent selection reach the scene. */
export class ModelLibrary {
  constructor({ loadModel, prepareModel = model => model, activateModel, pending = () => {}, failure = () => {} }) {
    Object.assign(this, { loadModel, prepareModel, activateModel, pending, failure });
    this.cache = new Map();
    this.sequence = 0;
  }

  async select(id) {
    const sequence = ++this.sequence;
    this.pending(id);
    let request = this.cache.get(id);
    if (!request) {
      request = Promise.resolve()
        .then(() => this.loadModel(id))
        .then(model => this.prepareModel(model, id));
      this.cache.set(id, request);
      request.catch(() => { if (this.cache.get(id) === request) this.cache.delete(id); });
    }
    try {
      const model = await request;
      if (sequence !== this.sequence) return false;
      this.activateModel(id, model);
      return true;
    } catch (error) {
      if (sequence === this.sequence) this.failure(id, error);
      return false;
    }
  }
}
