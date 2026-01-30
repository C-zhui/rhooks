import { Suspense } from "react";
import "./App.css";
import App from "./example/rstate2";
export default function(){
    return <Suspense fallback={<div>loading</div>}>
        <App />
    </Suspense>
};
