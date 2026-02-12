import { useReactive } from "ahooks";

export default function Demo5() {

  const state = useReactive({
    count: 0
  })
  return (
    <div>
       <button onClick={()=>state.count++}>{state.count}</button>
    </div>
  );
}
 