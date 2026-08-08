import {
  createElement,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import { resolveRoute } from "./routeResolver";

function NotFoundPage({ segment }: { segment: string }) {
  return (
    <main className="route-message">
      <p className="route-message__eyebrow">Route not found</p>
      <h1>There is no explorer at /{segment}.</h1>
      <p>Choose a workspace to continue.</p>
      <nav aria-label="Available pages" className="route-message__links">
        <a href="/mermaid">Mermaid graph</a>
        <a href="/ontology">Ontology explorer</a>
      </nav>
    </main>
  );
}

export function AppRouter() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const updatePathname = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", updatePathname);
    return () => window.removeEventListener("popstate", updatePathname);
  }, []);

  const route = useMemo(() => resolveRoute(pathname), [pathname]);

  if (route.kind === "not-found") {
    return <NotFoundPage segment={route.segment} />;
  }

  return (
    <Suspense fallback={<div className="route-loading">Loading explorer…</div>}>
      {createElement(route.route.component, { subPath: route.subPath })}
    </Suspense>
  );
}
