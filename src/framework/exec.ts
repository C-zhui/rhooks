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

const ctx = new Context({ a: 1 })

console.log('ctx', ctx.env)

const [err, ctx2] = ctx.then(env => {
    return { b: env.a + 1 }
})

if (!err) {
    console.log('ctx2', ctx2.env);

    (async () => {
        const [err2, ctx3] = await ctx2.thenP(env => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve({ c: env.b + 1 })
                }, 1000)
            })
        })
        if (!err2) {
            console.log('ctx3', ctx3.env);
        }
    })()
}

const [err4, ctx4] = ctx.then(env => {
    return { a: env.a.toString() }
})


if (!err4) {
    ctx4.env.a
}
