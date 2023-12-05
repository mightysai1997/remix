import * as React from "react";
import type { Location } from "@remix-run/router";
import { isRouteErrorResponse } from "react-router-dom";

type RemixErrorBoundaryProps = React.PropsWithChildren<{
  location: Location;
  error?: Error;
}>;

type RemixErrorBoundaryState = {
  error: null | Error;
  location: Location;
};

export class RemixErrorBoundary extends React.Component<
  RemixErrorBoundaryProps,
  RemixErrorBoundaryState
> {
  constructor(props: RemixErrorBoundaryProps) {
    super(props);
    this.state = { error: props.error || null, location: props.location };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(
    props: RemixErrorBoundaryProps,
    state: RemixErrorBoundaryState
  ) {
    // When we get into an error state, the user will likely click "back" to the
    // previous page that didn't have an error. Because this wraps the entire
    // application (even the HTML!) that will have no effect--the error page
    // continues to display. This gives us a mechanism to recover from the error
    // when the location changes.
    //
    // Whether we're in an error state or not, we update the location in state
    // so that when we are in an error state, it gets reset when a new location
    // comes in and the user recovers from the error.
    if (state.location !== props.location) {
      return { error: props.error || null, location: props.location };
    }

    // If we're not changing locations, preserve the location but still surface
    // any new errors that may come through. We retain the existing error, we do
    // this because the error provided from the app state may be cleared without
    // the location changing.
    return { error: props.error || state.error, location: state.location };
  }

  render() {
    if (this.state.error) {
      return <RemixRootDefaultErrorBoundary error={this.state.error} />;
    } else {
      return this.props.children;
    }
  }
}

/**
 * When app's don't provide a root level ErrorBoundary, we default to this.
 */
export function RemixRootDefaultErrorBoundary({ error }: { error: unknown }) {
  console.error(error);

  if (isRouteErrorResponse(error)) {
    return (
      <BoundaryShell title="Unhandled Thrown Response!">
        <h1 style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
          {error.status} {error.statusText}
        </h1>
      </BoundaryShell>
    );
  }

  let errorInstance: Error;
  if (error instanceof Error) {
    errorInstance = error;
  } else {
    let errorString =
      error == null
        ? "Unknown Error"
        : typeof error === "object" && "toString" in error
        ? error.toString()
        : JSON.stringify(error);
    errorInstance = new Error(errorString);
  }

  return (
    <BoundaryShell title="Application Error!">
      <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <h1 style={{ fontSize: "24px" }}>Application Error</h1>
        <pre
          style={{
            padding: "2rem",
            background: "hsla(10, 50%, 50%, 0.1)",
            color: "red",
            overflow: "auto",
          }}
        >
          {errorInstance.stack}
        </pre>
      </main>
    </BoundaryShell>
  );
}

function BoundaryShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1,viewport-fit=cover"
        />
        <title>{title}</title>
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              console.log(
                "💿 Hey developer 👋. You can provide a way better UX than this when your app throws errors. Check out https://remix.run/guides/errors for more information."
              );
            `,
          }}
        />
      </body>
    </html>
  );
}
