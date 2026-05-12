import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarLayout } from "@/components/SidebarLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireAdmin } from "@/components/RequireAdmin";
import Homepage from "./pages/Homepage";
import Generator from "./pages/Generator";
import PromptBuilder from "./pages/PromptBuilder";
import Profile from "./pages/Profile";
import MyImages from "./pages/MyImages";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import NotFound from "./pages/NotFound";
import Maintenance from "./pages/Maintenance";
import PricingPage from "./pages/PricingPage";

// ── Toggle this to enable/disable maintenance mode for app routes ──
const MAINTENANCE_MODE = false;

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          {/* Admin routes - separate login */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <Admin />
              </RequireAdmin>
            }
          />

          {/* Public marketing homepage */}
          <Route path="/" element={<Homepage />} />

          {/* Auth routes without sidebar */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/pricing" element={<PricingPage />} />

          {/* Protected app routes with sidebar */}
          <Route
            path="/app"
            element={
              MAINTENANCE_MODE ? <Maintenance /> : (
                <RequireAuth>
                  <SidebarLayout>
                    <Generator />
                  </SidebarLayout>
                </RequireAuth>
              )
            }
          />
          <Route
            path="/prompt-builder"
            element={
              MAINTENANCE_MODE ? <Maintenance /> : (
                <RequireAuth>
                  <SidebarLayout>
                    <PromptBuilder />
                  </SidebarLayout>
                </RequireAuth>
              )
            }
          />
          <Route
            path="/profile"
            element={
              MAINTENANCE_MODE ? <Maintenance /> : (
                <RequireAuth>
                  <SidebarLayout>
                    <Profile />
                  </SidebarLayout>
                </RequireAuth>
              )
            }
          />
          <Route
            path="/my-images"
            element={
              MAINTENANCE_MODE ? <Maintenance /> : (
                <RequireAuth>
                  <SidebarLayout>
                    <MyImages />
                  </SidebarLayout>
                </RequireAuth>
              )
            }
          />
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
