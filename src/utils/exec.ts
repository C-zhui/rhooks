class Context<T extends object> {
    readonly env: T;

    constructor(env: T) {
        this.env = { ...env };
        Object.freeze(this.env);
    }

    then<R extends object>(callback: (env: T) => R): [Error, null] | [null, Context<Omit<T, keyof R> & R>] {
        try {
            const r = callback(this.env);
            return [null, new Context({ ...this.env, ...r })];
        } catch (e) {
            return [e as Error, null];
        }
    }

    async thenP<R>(callback: (env: T) => Promise<R>): Promise<[Error, null] | [null, Context<Omit<T, keyof R> & R>]> {
        try {
            const r = await callback(this.env);
            return [null, new Context({ ...this.env, ...r })];
        } catch (e) {
            return [e as Error, null];
        }
    }
}
