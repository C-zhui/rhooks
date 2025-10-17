import createEmotion from "@emotion/css/create-instance";
import { css, cx } from "@emotion/css";
import { FC, HTMLProps, useLayoutEffect, useRef } from "react";
import { Observable, of } from "rxjs";
import { castArray, random, times } from "lodash-es";
import { useLatest } from "react-use";

type CssTemplateType = typeof css;

export const EmotionDiv: FC<
  HTMLProps<HTMLDivElement> & {
    getCss$?: (css: CssTemplateType) => Observable<string | string[]>;
    getCss?: (css: CssTemplateType) => string | string[];
    deps?: any[];
  }
> = ({ getCss$: getCss$, getCss: getCss, deps, ...props }) => {
  const ref = useRef<HTMLDivElement>(null);
  const lProps = useLatest(props);

  useLayoutEffect(() => {
    let api = createEmotion({
      // The key option is required when there will be multiple instances in a single app
      key: String.fromCharCode(
        ...times(random(3, 7)).map(() => random(97, 122))
      ),
    });

    let oldApi = null as any;
    let i = 0;

    const css = (...args: any) => api.css(...args);

    let cls1 = "";
    let cls2 = "";

    const addClass = () => {
      if (ref.current) {
        ref.current.className = cx(lProps.current.className, cls1, cls2);
      }
    };

    if (getCss && ref.current) {
      const cls = getCss(css);
      cls2 = cx(cls);
      addClass();
    }

    const sub = (getCss$ || (() => of()))(css).subscribe((s) => {
      if (ref.current) {
        const classes = castArray(s);
        if (i === 0) {
          cls1 = cx(classes);
          addClass();
        } else {
          requestAnimationFrame(() => {
            if (!ref.current) {
              return;
            }
            cls1 = cx(classes);
            addClass();
          });
        }
      }

      if (oldApi) {
        requestAnimationFrame(() => {
          oldApi?.flush();
          oldApi = null;
        });
      }

      i++;
      if (i > 10) {
        i = 0;
        oldApi = api;
        api = createEmotion({
          // The key option is required when there will be multiple instances in a single app
          key: String.fromCharCode(
            ...times(random(3, 7)).map(() => random(97, 122))
          ),
        });
      }
    });

    return () => {
      sub.unsubscribe();
      api.flush();
      if (oldApi) {
        oldApi?.flush();
      }
    };
  }, deps || []);

  return (
    <div {...props} ref={ref} className="">
      {props.children}
    </div>
  );
};
