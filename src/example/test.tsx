import React, { useEffect, useState, useCallback } from "react";

let i = 0;
export default function Demo5() {
  const [count, setCount] = useState(0);
  const [obj, setObj] = useState(null);

  useEffect(() => {
    if (count > 0) {
      setObj({
        longStr: createBigString(),
        func() {},
        [`key${i++}`]: 123,
      });
    } else {
      setObj({});
    }
  }, [count]);

  return (
    <div>
      <button
        onClick={() => {
          obj;
          setCount(count + 1);
        }}
      >
        Click me
      </button>
      <button onClick={() => setCount(count - 1)}>Click me</button>
    </div>
  );
}

function createBigString(n = 100000) {
  console.log("createBigString");
  let str = "";
  for (let i = 0; i < n; i++) {
    str += btoa(Math.random().toString());
  }
  return str;
}
