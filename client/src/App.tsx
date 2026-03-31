import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { Suspense, lazy } from "react";
import Layout from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";

// ── Eager: tiny pages needed immediately ─────────────────────
import NotFound from "@/pages/not-found";

// ── Lazy: every page is its own chunk ────────────────────────
// Each import() becomes a separate JS file loaded only when that
// route is first visited. Subsequent visits use the browser cache.
const HomePage            = lazy(() => import("@/pages/HomePage"));
const ListingDetailPage   = lazy(() => import("@/pages/ListingDetailPage"));
const GroupsPage          = lazy(() => import("@/pages/GroupsPage"));
const GroupDetailPage     = lazy(() => import("@/pages/GroupDetailPage"));
const ProfilePage         = lazy(() => import("@/pages/ProfilePage"));
const CreateListingPage   = lazy(() => import("@/pages/CreateListingPage"));
const MessagesPage        = lazy(() => import("@/pages/MessagesPage"));
const AdminPage           = lazy(() => import("@/pages/AdminPage"));
const GuidesPage          = lazy(() => import("@/pages/GuidesPage"));
const GuideDetailPage     = lazy(() => import("@/pages/GuideDetailPage"));
const CreateGuidePage     = lazy(() => import("@/pages/CreateGuidePage"));
const AuthCallbackPage    = lazy(() => import("@/pages/AuthCallbackPage"));
const SearchPage          = lazy(() => import("@/pages/SearchPage"));
const SavedListsPage      = lazy(() => import("@/pages/SavedListsPage"));
const AdvertisePage       = lazy(() => import("@/pages/AdvertisePage"));
const FeedPage            = lazy(() => import("@/pages/FeedPage"));
const MyListingsPage      = lazy(() => import("@/pages/MyListingsPage"));
const BusinessesPage      = lazy(() => import("@/pages/BusinessesPage").then(m => ({ default: m.BusinessesPage })));
const BusinessPage        = lazy(() => import("@/pages/BusinessPage").then(m => ({ default: m.BusinessPage })));
const CreateBusinessPage  = lazy(() => import("@/pages/CreateBusinessPage").then(m => ({ default: m.CreateBusinessPage })));
const EventsPage          = lazy(() => import("@/pages/EventsPage"));
const ProjectsPage        = lazy(() => import("@/pages/ProjectsPage"));
const ProjectDetailPage   = lazy(() => import("@/pages/ProjectDetailPage"));
const SecuritySettingsPage = lazy(() => import("@/pages/SecuritySettingsPage"));

// ── Page loading fallback ─────────────────────────────────
function PageLoader() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={<Layout><PageLoader /></Layout>}>
        <Switch>
            <Route path="/" component={() => <Layout><HomePage /></Layout>} />
            {/* ID-only routes kept for backward compat (redirects handled inside each page) */}
            <Route path="/listing/:id" component={({ params }) => <Layout><ListingDetailPage id={Number(params.id)} /></Layout>} />
            <Route path="/listing/:id/:slug" component={({ params }) => <Layout><ListingDetailPage id={Number(params.id)} /></Layout>} />
            <Route path="/groups" component={() => <Layout><GroupsPage /></Layout>} />
            <Route path="/groups/:id" component={({ params }) => <Layout><GroupDetailPage id={Number(params.id)} /></Layout>} />
            <Route path="/groups/:id/:slug" component={({ params }) => <Layout><GroupDetailPage id={Number(params.id)} /></Layout>} />
            <Route path="/profile/:id" component={({ params }) => <Layout><ProfilePage id={Number(params.id)} /></Layout>} />
            <Route path="/profile/:id/:slug" component={({ params }) => <Layout><ProfilePage id={Number(params.id)} /></Layout>} />
            <Route path="/sell" component={() => <Layout><CreateListingPage /></Layout>} />
            <Route path="/messages" component={() => <Layout><MessagesPage /></Layout>} />
            <Route path="/messages/:userId" component={({ params }) => <Layout><MessagesPage threadUserId={Number(params.userId)} /></Layout>} />
            <Route path="/admin" component={() => <Layout><AdminPage /></Layout>} />
            <Route path="/guides" component={() => <Layout><GuidesPage /></Layout>} />
            <Route path="/guides/new" component={() => <Layout><CreateGuidePage /></Layout>} />
            <Route path="/guides/:id" component={({ params }) => <Layout><GuideDetailPage id={Number(params.id)} /></Layout>} />
            <Route path="/guides/:id/:slug" component={({ params }) => <Layout><GuideDetailPage id={Number(params.id)} /></Layout>} />
            <Route path="/auth/callback" component={() => <AuthCallbackPage />} />
            <Route path="/search" component={() => <Layout><SearchPage /></Layout>} />
            <Route path="/saved" component={() => <Layout><SavedListsPage /></Layout>} />
            <Route path="/advertise" component={() => <Layout><AdvertisePage /></Layout>} />
            <Route path="/feed" component={() => <Layout><FeedPage /></Layout>} />
            <Route path="/my-listings" component={() => <Layout><MyListingsPage /></Layout>} />
            <Route path="/business" component={() => <Layout><BusinessesPage /></Layout>} />
            <Route path="/business/new" component={() => <Layout><CreateBusinessPage /></Layout>} />
            <Route path="/business/:slug" component={({ params }) => <Layout><BusinessPage slug={params.slug} /></Layout>} />
            <Route path="/events" component={() => <Layout><EventsPage /></Layout>} />
            <Route path="/projects" component={() => <Layout><ProjectsPage /></Layout>} />
            <Route path="/projects/:id" component={({ params }) => <Layout><ProjectDetailPage id={Number(params.id)} /></Layout>} />
            <Route path="/settings/security" component={() => <Layout><SecuritySettingsPage /></Layout>} />
            <Route component={NotFound} />
        </Switch>
        </Suspense>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
