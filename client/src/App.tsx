import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Feed from "./pages/Feed";
import Publish from "./pages/Publish";
import Profile from "./pages/Profile";
import Restaurants from "./pages/Restaurants";
import Rankings from "./pages/Rankings";
import AiChat from "./pages/AiChat";
import RestaurantDetail from "./pages/RestaurantDetail";
import PostDetail from "./pages/PostDetail";
import Admin from "./pages/Admin";
import { ResponsiveNav } from "./components/ResponsiveNav";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/feed"} component={Feed} />
      <Route path={"/publish"} component={Publish} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/restaurants"} component={Restaurants} />
      <Route path={"/rankings"} component={Rankings} />
      <Route path={"/ai-chat"} component={AiChat} />
      <Route path={"/post/:id"} component={PostDetail} />
      <Route path={"/restaurant/:id"} component={RestaurantDetail} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <ResponsiveNav />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
