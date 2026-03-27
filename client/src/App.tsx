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
import AdminPage from "@/pages/AdminPage";
import GuidesPage from "@/pages/GuidesPage";
import GuideDetailPage from "@/pages/GuideDetailPage";
import CreateGuidePage from "@/pages/CreateGuidePage";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import SearchPage from "@/pages/SearchPage";
import SavedListsPage from "@/pages/SavedListsPage";
import AdvertisePage from "@/pages/AdvertisePage";
import FeedPage from "@/pages/FeedPage";
import MyListingsPage from "@/pages/MyListingsPage";
import { BusinessesPage } from "@/pages/BusinessesPage";
import { BusinessPage } from "@/pages/BusinessPage";
import { CreateBusinessPage } from "@/pages/CreateBusinessPage";
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
            <Route path="/admin" component={() => <Layout><AdminPage /></Layout>} />
            <Route path="/guides" component={() => <Layout><GuidesPage /></Layout>} />
            <Route path="/guides/new" component={() => <Layout><CreateGuidePage /></Layout>} />
            <Route path="/guides/:id" component={({ params }) => <Layout><GuideDetailPage id={Number(params.id)} /></Layout>} />
            <Route path="/auth/callback" component={() => <AuthCallbackPage />} />
            <Route path="/search" component={() => <Layout><SearchPage /></Layout>} />
            <Route path="/saved" component={() => <Layout><SavedListsPage /></Layout>} />
            <Route path="/advertise" component={() => <Layout><AdvertisePage /></Layout>} />
            <Route path="/feed" component={() => <Layout><FeedPage /></Layout>} />
            <Route path="/my-listings" component={() => <Layout><MyListingsPage /></Layout>} />
            <Route path="/business" component={() => <Layout><BusinessesPage /></Layout>} />
            <Route path="/business/new" component={() => <Layout><CreateBusinessPage /></Layout>} />
            <Route path="/business/:slug" component={({ params }) => <Layout><BusinessPage slug={params.slug} /></Layout>} />
            <Route component={NotFound} />
          </Switch>
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
