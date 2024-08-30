import { createModel } from '../state/model';

export default function () {
    return null;
}

const initState = {
    cnt: 0,
    hello: 'world'
}

const AModel = createModel<typeof initState, {
    inc: number
}, {}>({
    name: 'asd',
    state: () => initState,
    setup(api) {
        api.actions.inc.subscribe((incBy) => {
            api.setState({
                cnt: api.state.cnt + incBy
            })
        })
    }
})

const a = AModel()

a.updates.cnt.subscribe((cnt) => {
    console.log('cnt change to', cnt)
})

console.log({ ...a.state })
a.dispatch.inc(2)
console.log({ ...a.state })