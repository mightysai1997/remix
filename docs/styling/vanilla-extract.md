---
title: Vanilla Extract
---

# Vanilla Extract

[Vanilla Extract][vanilla-extract] is a zero-runtime CSS-in-TypeScript (or JavaScript) library that lets you use TypeScript as your CSS preprocessor. Styles are written in separate `*.css.ts` (or `*.css.js`) files and all code within them is executed during the build process rather than in your user's browser. If you want to keep your CSS bundle size to a minimum, Vanilla Extract also provides an official library called [Sprinkles][sprinkles] that lets you define a custom set of utility classes and a type-safe function for accessing them at runtime.

To use the built-in Vanilla Extract support, first ensure you've set up [CSS bundling][css-bundling] in your application.

Then, install Vanilla Extract's core styling package as a dev dependency.

```sh
npm install -D @vanilla-extract/css
```

You can then opt into Vanilla Extract via the `.css.ts`/`.css.js` file name convention. For example:

```ts filename=app/components/button/styles.css.ts
import { style } from "@vanilla-extract/css";

export const root = style({
  border: "solid 1px",
  background: "white",
  color: "#454545",
});
```

```tsx filename=app/components/button/index.js lines=[1,9]
import * as styles from "./styles.css"; // Note that `.ts` is omitted here

export const Button = React.forwardRef(
  ({ children, ...props }, ref) => {
    return (
      <button
        {...props}
        ref={ref}
        className={styles.root}
      />
    );
  }
);
Button.displayName = "Button";
```

[vanilla-extract]: https://vanilla-extract.style
[sprinkles]: https://vanilla-extract.style/documentation/packages/sprinkles
[css-bundling]: ./bundling
