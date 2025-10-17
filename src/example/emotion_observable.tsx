import { interval, map, of, startWith } from "rxjs";
import { EmotionDiv } from "../emotion";
import { random, range, times } from "lodash-es";
import { useState } from "react";
import { $text } from "../component/Observable/jsxHelper";
import { ForList } from "../component/ControlFlow";

export default function App() {
  const [show, setshow] = useState(true);
  return (
    <div>
      <button onClick={() => setshow(!show)}>toggle</button>
      {show && (
        <EmotionDiv
          getCss={(css) =>
            css`
              display: flex;
              gap: 10px;
              width: 90vw;
              flex-wrap: wrap;
            `
          }
        >
          <ForList
            list={range(100)}
            getKey={(i) => i}
            renderItem={() => (
              <EmotionDiv
                getCss={(css) => css`
                  width: 250px;
                  height: 250px;
                `}
              >
                <EmotionDiv
                  getCss$={(css) =>
                    interval(random(400, 500)).pipe(
                      startWith(0),
                      map(
                        () =>
                          css`
                            height: ${random(100, 200)}px;
                            width: ${random(100, 200)}px;
                            background: hsl(${random(0, 360)}, 100%, 50%);
                            transition: all 0.3s linear;
                            color: grey;
                          `
                      )
                    )
                  }
                >
                  <EmotionDiv
                    getCss={(css) =>
                      css`
                        color: white;
                        white-space: wrap;
                        word-break: break-all;

                      `
                    }
                  >
                    {$text(
                      interval(1000).pipe(
                        startWith(0),
                        map(() =>
                          String.fromCharCode(
                            ...times(random(30, 50)).map(() => random(97, 122))
                          )
                        )
                      )
                    )}
                  </EmotionDiv>
                </EmotionDiv>
              </EmotionDiv>
            )}
          />
        </EmotionDiv>
      )}
    </div>
  );
}
