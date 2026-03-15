import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import Layout from "@/components/Layout";
import HomePage from "@/pages/HomePage";
import ListingDetailPage from "@/pages/ListingDetailPage";
import GroupsPage from "@/pages/GroupsPage";
import GroupDetailPage from "@/pages/GroupDetailPage";
import ProfilePage from "@/pages/ProfilePage";
import CreateListingPage from "@/pages/CreateListingPage";
import MessagesPage from "@/pages/MessagesPage";
import NotFound from "@/pages/not-found";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router hook={useHashLocation}>
          <Switch>
            <Route path="/" component={() => <Layout><HomePage /></Layout>} />
            <Route path="/listing/:id" component={({ params }) => <Layout><ListingDetailPage id={Number(params.id)} /></Layout>} />
            <Route path="/groups" component={() => <Layout><GroupsPage /></Layout>} />
            <Route path="/groups/:id" component={({ params }) => <Layout><GroupDetailPage id={Number(params.id)} /></Layout>} />
            <Route path="/profile/:id" component={({ params }) => <Layout><ProfilePage id={Number(params.id)} /></Layout>} />
            <Route path="/sell" component={() => <Layout><CreateListingPage /></Layout>} />
            <Route path="/messages" component={() => <Layout><MessagesPage /></Layout>} />
            <Route path="/messages/:userId" component={({ params }) => <Layout><MessagesPage threadUserId={Number(params.userId)} /></Layout>} />
            <Route component={NotFound} />
          </Switch>
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
