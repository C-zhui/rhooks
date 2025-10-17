import { Signal, createComputed, createEffect, createSignal } from "../signals";

const num = createSignal(1);
const num1 = createSignal(1);

const num2 = createComputed(() => num.value + 1);

createEffect(() => {
    console.log(num.value, num2.value);
});

setInterval(() => {
    Signal.batch(() => {
        num.value = num.value + 1;
        num1.value = num1.value + 1;
    });
}, 3000);

export default function () {
    return null
}