import {
  Links,
  LiveReload,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration
} from "remix";

const Nav = () => {
  return (
    <header>
      <nav>
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/articles">Articles</NavLink>
      </nav>
    </header>
  );
};

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Nav />
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        {process.env.NODE_ENV === "development" && <LiveReload />}
      </body>
    </html>
  );
}
