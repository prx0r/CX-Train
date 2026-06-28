type NodeFn<T> = (state: T) => Partial<T> | Promise<Partial<T>>;

export class StateGraph<T extends Record<string, any>> {
  private nodes = new Map<string, NodeFn<T>>();
  private edges = new Map<string, string>();
  private entryPoint: string | null = null;
  private finishPoints = new Set<string>();

  addNode(name: string, node: NodeFn<T>): this {
    if (this.nodes.has(name)) throw new Error(`Node already exists: ${name}`);
    this.nodes.set(name, node);
    return this;
  }

  addEdge(from: string, to: string): this {
    if (!this.nodes.has(from)) throw new Error(`Source node not found: ${from}`);
    if (!this.nodes.has(to)) throw new Error(`Target node not found: ${to}`);
    this.edges.set(from, to);
    return this;
  }

  setEntryPoint(name: string): this {
    if (!this.nodes.has(name)) throw new Error(`Entry node not found: ${name}`);
    this.entryPoint = name;
    return this;
  }

  setFinishPoint(name: string): this {
    if (!this.nodes.has(name)) throw new Error(`Finish node not found: ${name}`);
    this.finishPoints.add(name);
    return this;
  }

  compile(): (state: T) => Promise<T> {
    if (!this.entryPoint) throw new Error('No entry point set');
    if (this.finishPoints.size === 0) throw new Error('No finish point set');

    const nodes = this.nodes;
    const edges = this.edges;
    const finishPoints = this.finishPoints;
    const entryPoint = this.entryPoint;

    return async (initialState: T): Promise<T> => {
      let current: string = entryPoint;
      let state = { ...initialState };

      while (current) {
        const node = nodes.get(current)!;
        const partial = await node(state);
        state = { ...state, ...partial };

        if (finishPoints.has(current)) break;

        const next = edges.get(current);
        if (!next) break;
        current = next;
      }

      return state;
    };
  }
}
