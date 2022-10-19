const routes: RouteNode = {
  title: `Home Page`,
  widget: homePage,
  /*subroutes: {
    projects: {
      title: `Projects`,
      widget: projectsPage,
    },
    "tutorial-videos": {
      title: `Tutorial Videos`,
      widget: tutorialPage,
    },
  },*/
};

type RouteNode = {
  title: Lit<Str>;
  widget: Lit<Widget>;
  subroutes?: {
    [key: string]: RouteNode;
  };
};

const openPageForCurrentRoute = () => {
  // Get the path from the current url
  const currentRouteParts = location.pathname
    // Trim the leading `/`
    .slice(1)
    // Removing traling `/`
    .replace(/\/+$/, ``)
    // Split into individual pieces.
    .split(`/`);

  let selectedRouteNode = routes;
  for (const nextPart of currentRouteParts) {
    let nextRouteNode = selectedRouteNode.subroutes?.[nextPart];
    if (exists(nextRouteNode)) {
      selectedRouteNode = nextRouteNode;
    } else {
      // If the  route is not found, then we default to the home page.
      // Eventually this should default to the not found page.
      selectedRouteNode = routes;
      break;
    }
  }
  openPage(
    box(
      {
        title: selectedRouteNode.title,
        width: Size.grow,
        height: Size.grow,
        contentAlign: Align.topCenter,
      },
      selectedRouteNode.widget,
    ),
  );
};

window.addEventListener("hashchange", openPageForCurrentRoute);
window.addEventListener("load", openPageForCurrentRoute);
