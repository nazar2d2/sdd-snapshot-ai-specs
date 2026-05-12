import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  RefreshCw,
  ShieldCheck,
  Coins,
  UserCheck,
  BarChart3,
  Users,
  Crown,
  ArrowLeft,
  Lock,
  Search,
  ArrowUpDown,
  Plus,
  Zap,
  UserX,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Save,
  Infinity,
  Calendar,
  TrendingUp,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Layers,
  AlertTriangle,
  StopCircle,
  ExternalLink,
  UserPlus,
  KeyRound,
  ShoppingCart,
  User,
  Skull,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AdminProfileTab } from "@/components/AdminProfileTab";


interface AdminStats {
  total_users: number;
  total_jobs: number;
  total_credits_distributed: number;
}

interface AnalyticsData {
  total_users: number;
  total_jobs: number;
  total_credits: number;
  period_new_users: number;
  period_jobs: number;
  period_jobs_done: number;
  period_jobs_failed: number;
  period_jobs_running: number;
  daily_signups: { day: string; count: number }[];
  daily_jobs: { day: string; total: number; done: number; failed: number }[];
  job_status_breakdown: { status: string; count: number }[];
  top_users_by_jobs: { email: string; jobs: number; credits: number }[];
  credit_distribution: { bucket: string; count: number }[];
  success_rate: number;
  avg_tasks_per_job: number;
}

type AnalyticsPeriod = 7 | 30 | 90 | 365;

const PERIOD_OPTIONS: { label: string; value: AnalyticsPeriod }[] = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "1 year", value: 365 },
];

const STATUS_COLORS: Record<string, string> = {
  done: "#22c55e",
  failed: "#ef4444",
  running: "#f59e0b",
  pending: "#6b7280",
};

const CHART_COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

interface UserProfile {
  id: string;
  email: string;
  credits: number;
  is_unlimited: boolean;
  full_name: string | null;
  subscription_tier: string;
  subscription_status: string | null;
  created_at: string;
}

interface WhitelistRow {
  email: string;
  created_at: string;
  reason: string | null;
  created_by: string | null;
}

type AdminTab = "analytics" | "users" | "whitelist" | "jobs" | "purchases" | "profile";

const adminMenuItems = [
  { id: "analytics" as AdminTab, title: "Analytics", icon: BarChart3 },
  { id: "users" as AdminTab, title: "All Users", icon: Users },
  { id: "whitelist" as AdminTab, title: "VIP Users", icon: Crown },
  { id: "jobs" as AdminTab, title: "Jobs", icon: Layers },
  { id: "purchases" as AdminTab, title: "Purchases", icon: ShoppingCart },
  { id: "profile" as AdminTab, title: "Profile", icon: User },
];

interface Purchase {
  id: string;
  email: string;
  customer_name: string | null;
  amount: number;
  currency: string;
  package: string;
  mode: string;
  status: string;
  created_at: string;
}

interface AdminJob {
  id: string;
  user_id: string;
  email: string;
  status: string;
  niche: string;
  tasks_total: number;
  tasks_done: number;
  tasks_failed: number;
  provider_id: string;
  created_at: string;
  completed_at: string | null;
  config: any;
}

interface AdminJobTask {
  id: string;
  view_name: string;
  variant_name: string;
  variant_color: string | null;
  status: string;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  result_url: string | null;
  is_base: boolean;
  created_at: string;
}

type JobStatusFilter = "all" | "pending" | "running" | "done" | "failed";

function RealtimeDot({ status }: { status: string }) {
  const color =
    status === "SUBSCRIBED"
      ? "bg-emerald-500"
      : status === "CHANNEL_ERROR"
        ? "bg-destructive"
        : "bg-amber-500";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full animate-pulse", color)} />
      <span className="capitalize">{status.toLowerCase().replace("_", " ")}</span>
    </span>
  );
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<AdminTab>("analytics");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [whitelistEmail, setWhitelistEmail] = useState("");
  const [whitelistRows, setWhitelistRows] = useState<WhitelistRow[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<string>("disconnected");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortCreditsAsc, setSortCreditsAsc] = useState<boolean | null>(null);

  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [creditTarget, setCreditTarget] = useState<{ id: string; email: string } | null>(null);
  const [creditAmount, setCreditAmount] = useState("1000");

  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const [userDetailOpen, setUserDetailOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editCredits, setEditCredits] = useState("");
  const [editUnlimited, setEditUnlimited] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTier, setEditTier] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);

  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>(30);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobStatusFilter, setJobStatusFilter] = useState<JobStatusFilter>("all");
  const [jobSearch, setJobSearch] = useState("");
  const [jobDetailOpen, setJobDetailOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<AdminJob | null>(null);
  const [jobTasks, setJobTasks] = useState<AdminJobTask[]>([]);
  const [jobTasksLoading, setJobTasksLoading] = useState(false);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);

  const ADMIN_PAGE_SIZE = 20;
  const [usersPage, setUsersPage] = useState(1);
  const [jobsPage, setJobsPage] = useState(1);
  const [purchasesPage, setPurchasesPage] = useState(1);

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    email: "",
    password: "",
    full_name: "",
    credits: "0",
    tier: "none",
  });

  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, whitelistRes] = await Promise.allSettled([
        supabase.rpc("get_admin_stats"),
        supabase.rpc("get_admin_profiles", { p_limit: 250, p_offset: 0 }),
        supabase
          .from("whitelisted_users")
          .select("email, created_at, reason, created_by")
          .order("created_at", { ascending: false }),
      ]);

      const errors: string[] = [];

      if (statsRes.status === "fulfilled") {
        if (statsRes.value.error) errors.push(statsRes.value.error.message);
        else setStats(statsRes.value.data as unknown as AdminStats);
      } else {
        errors.push(statsRes.reason?.message ?? "Stats fetch failed");
      }

      if (usersRes.status === "fulfilled") {
        if (usersRes.value.error) errors.push(usersRes.value.error.message);
        else {
          const raw = usersRes.value.data as unknown;
          const payload = raw as { rows?: UserProfile[] } | UserProfile[] | null;
          const list = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.rows)
              ? payload.rows
              : [];
          setUsers(list);
        }
      } else {
        errors.push(usersRes.reason?.message ?? "Users fetch failed");
      }

      if (whitelistRes.status === "fulfilled") {
        if (whitelistRes.value.error) errors.push(whitelistRes.value.error.message);
        else setWhitelistRows((whitelistRes.value.data as unknown as WhitelistRow[]) || []);
      } else {
        errors.push(whitelistRes.reason?.message ?? "Whitelist fetch failed");
      }

      if (errors.length > 0) {
        console.warn("Admin partial load errors:", errors);
        toast({
          variant: "destructive",
          title: "Partial refresh failed",
          description: errors[0],
        });
      }
      setLastSyncAt(new Date());
    } catch (error: any) {
      console.error("Admin Load Error:", error);
      toast({ variant: "destructive", title: "Admin refresh failed", description: error?.message ?? "Unknown error" });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async (days: AnalyticsPeriod) => {
    setAnalyticsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_admin_analytics", { p_days: days });
      if (error) throw error;
      setAnalyticsData(data as unknown as AnalyticsData);
    } catch (error: any) {
      console.error("Analytics fetch error:", error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const fetchJobs = useCallback(async (status?: JobStatusFilter, email?: string) => {
    setJobsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_admin_jobs", {
        p_status: status === "all" ? undefined : status,
        p_email: email?.trim() || undefined,
        p_limit: 200,
        p_offset: 0,
      });
      if (error) throw error;
      const raw = data as unknown;
      const payload = raw as { rows?: AdminJob[] } | AdminJob[] | null;
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.rows)
          ? payload.rows
          : [];
      setJobs(list);
    } catch (error: any) {
      console.error("Jobs fetch error:", error);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  const fetchJobTasks = async (jobId: string) => {
    setJobTasksLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_admin_job_tasks", { p_job_id: jobId });
      if (error) throw error;
      setJobTasks((data as unknown as AdminJobTask[]) || []);
    } catch (error: any) {
      console.error("Tasks fetch error:", error);
      setJobTasks([]);
    } finally {
      setJobTasksLoading(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    setActionLoading(`cancel-${jobId}`);
    try {
      const { data, error } = await supabase.rpc("admin_cancel_job", { p_job_id: jobId });
      if (error) throw error;
      const res = data as unknown as { success: boolean; message: string };
      if (!res?.success) throw new Error(res?.message || "Failed");
      toast({ title: "Job Cancelled", description: res.message, variant: "success" });
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: "failed" } : j)));
      if (selectedJob?.id === jobId) setSelectedJob((prev) => prev ? { ...prev, status: "failed" } : prev);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Cancel Failed", description: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  const openJobDetail = (job: AdminJob) => {
    setSelectedJob(job);
    setJobDetailOpen(true);
    fetchJobTasks(job.id);
  };

  const fetchPurchases = useCallback(async () => {
    setPurchasesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-purchases", {
        method: "GET",
      });
      if (error) throw error;
      setPurchases((data as any)?.purchases || []);
    } catch (error: any) {
      console.error("Purchases fetch error:", error);
      toast({ variant: "destructive", title: "Failed to load purchases", description: error.message });
    } finally {
      setPurchasesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin && activeTab === "analytics") {
      fetchAnalytics(analyticsPeriod);
    }
  }, [isAdmin, activeTab, analyticsPeriod, fetchAnalytics]);

  useEffect(() => {
    if (isAdmin && activeTab === "jobs") {
      fetchJobs(jobStatusFilter, jobSearch);
    }
  }, [isAdmin, activeTab, jobStatusFilter, fetchJobs]);

  useEffect(() => {
    if (isAdmin && activeTab === "purchases") {
      fetchPurchases();
    }
  }, [isAdmin, activeTab, fetchPurchases]);

  useEffect(() => {
    const checkAdminAuth = async () => {
      setAuthChecking(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        setAuthChecking(false);
        return;
      }
      const { data: adminResult, error } = await supabase.rpc("is_admin");
      setIsAdmin(!error && !!adminResult);
      setAuthChecking(false);
    };
    checkAdminAuth();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();
    let debounceTimer: number | undefined;
    const debouncedRefresh = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => fetchData(), 400);
    };
    const channel = supabase
      .channel("admin-dashboard-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        const next = payload.new as any;
        if (next?.id) {
          setUsers((prev) => prev.map((u) => {
            if (u.id !== next.id) return u;
            const patch: Partial<UserProfile> = {};
            if (typeof next.credits === "number") patch.credits = next.credits;
            if (typeof next.is_unlimited === "boolean") patch.is_unlimited = next.is_unlimited;
            if ("full_name" in next) patch.full_name = next.full_name;
            if (typeof next.subscription_tier === "string") patch.subscription_tier = next.subscription_tier;
            if ("subscription_status" in next) patch.subscription_status = next.subscription_status;
            return { ...u, ...patch };
          }));
        }
        debouncedRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whitelisted_users" }, (payload) => {
        const eventType = payload.eventType;
        const next = payload.new as any;
        const prevRow = payload.old as any;
        if ((eventType === "INSERT" || eventType === "UPDATE") && next?.email) {
          setWhitelistRows((prev) => {
            const normalized = String(next.email).trim().toLowerCase();
            const rest = prev.filter((r) => r.email.trim().toLowerCase() !== normalized);
            return [
              {
                email: normalized,
                created_at: next.created_at ?? new Date().toISOString(),
                reason: next.reason ?? null,
                created_by: next.created_by ?? null,
              },
              ...rest,
            ];
          });
        }
        if (eventType === "DELETE" && (prevRow?.email || next?.email)) {
          const email = String(prevRow?.email ?? next?.email).trim().toLowerCase();
          setWhitelistRows((prev) => prev.filter((r) => r.email.trim().toLowerCase() !== email));
        }
        debouncedRefresh();
      })
      .subscribe((status, err) => {
        setRealtimeStatus(status);
        if (err) {
          console.error("Realtime subscribe error", err);
          toast({ variant: "destructive", title: "Realtime error", description: err.message ?? "Connection failed" });
        }
      });
    const poll = window.setInterval(() => fetchData(), 30_000);
    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [fetchData, isAdmin]);

  const handleGiveCredits = async (userId: string, email: string, amount: number) => {
    setActionLoading(`${userId}-credits`);
    try {
      const { data, error } = await supabase.rpc("give_admin_credits", { target_email: email, amount });
      if (error) throw error;
      const result = data as unknown as { success: boolean; message: string; new_balance: number };
      if (result?.success) {
        toast({ title: "Credits Added", description: `+${amount.toLocaleString()} to ${email}`, variant: "success" });
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, credits: result.new_balance } : u)));
      } else {
        throw new Error(result?.message || "Unknown error");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to add credits", description: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  const openCustomCreditsDialog = (userId: string, email: string) => {
    setCreditTarget({ id: userId, email });
    setCreditAmount("1000");
    setCreditDialogOpen(true);
  };

  const submitCustomCredits = () => {
    if (!creditTarget) return;
    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Invalid amount", description: "Enter a positive number." });
      return;
    }
    setCreditDialogOpen(false);
    handleGiveCredits(creditTarget.id, creditTarget.email, amount);
  };

  const handleAddWhitelist = async () => {
    if (!whitelistEmail) return;
    setActionLoading("whitelist-add");
    try {
      const normalizedEmail = whitelistEmail.trim().toLowerCase();
      const { data, error } = await supabase.functions.invoke("admin-whitelist", {
        body: { action: "add", email: normalizedEmail, grantCredits: 1_000_000 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setWhitelistRows((prev) => {
        const rest = prev.filter((r) => r.email.trim().toLowerCase() !== normalizedEmail);
        return [{ email: normalizedEmail, created_at: new Date().toISOString(), reason: null, created_by: "admin" }, ...rest];
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.email.trim().toLowerCase() === normalizedEmail ? { ...u, credits: Math.max(u.credits, 1_000_000) } : u,
        ),
      );
      toast({ title: "User Whitelisted", description: `${normalizedEmail} granted VIP access.`, variant: "success" });
      setWhitelistEmail("");
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  const confirmRemoveWhitelist = (email: string) => {
    setRemoveTarget(email);
    setRemoveDialogOpen(true);
  };

  const handleRemoveWhitelist = async () => {
    if (!removeTarget) return;
    setRemoveDialogOpen(false);
    const email = removeTarget;
    setActionLoading(`whitelist-remove:${email}`);
    try {
      const normalized = email.trim().toLowerCase();
      const { data, error } = await supabase.functions.invoke("admin-whitelist", {
        body: { action: "remove", email: normalized },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setWhitelistRows((prev) => prev.filter((r) => r.email.trim().toLowerCase() !== normalized));
      toast({ title: "Removed", description: `${email} removed from VIP list.`, variant: "success" });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setActionLoading(null);
      setRemoveTarget(null);
    }
  };

  const openUserDetail = (user: UserProfile) => {
    setEditingUser(user);
    setEditCredits(String(user.credits));
    setEditUnlimited(user.is_unlimited);
    setEditName(user.full_name ?? "");
    setEditTier(user.subscription_tier ?? "none");
    setUserDetailOpen(true);
  };

  const handleSetCredits = async () => {
    if (!editingUser) return;
    const val = parseInt(editCredits);
    if (isNaN(val) || val < 0) {
      toast({ variant: "destructive", title: "Invalid", description: "Enter a non-negative number." });
      return;
    }
    setActionLoading(`${editingUser.id}-set-credits`);
    try {
      const { data, error } = await supabase.rpc("admin_set_credits", {
        target_user_id: editingUser.id,
        new_credits: val,
      });
      if (error) throw error;
      const res = data as unknown as { success: boolean; message: string; new_balance: number };
      if (!res?.success) throw new Error(res?.message || "Failed");
      toast({ title: "Credits Set", description: `${editingUser.email} now has ${val.toLocaleString()} credits.`, variant: "success" });
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, credits: res.new_balance } : u)));
      setEditingUser((prev) => prev ? { ...prev, credits: res.new_balance } : prev);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setActionLoading(`${editingUser.id}-update`);
    try {
      const { data, error } = await supabase.rpc("admin_update_user", {
        target_user_id: editingUser.id,
        p_is_unlimited: editUnlimited,
        p_full_name: editName,
        p_subscription_tier: editTier || "none",
      });
      if (error) throw error;
      const res = data as unknown as { success: boolean; message: string; user: any };
      if (!res?.success) throw new Error(res?.message || "Failed");
      const updated = {
        ...editingUser,
        is_unlimited: res.user.is_unlimited,
        full_name: res.user.full_name,
        subscription_tier: res.user.subscription_tier,
      };
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, ...updated } : u)));
      setEditingUser(updated);
      toast({ title: "User Updated", description: `${editingUser.email} profile saved.`, variant: "success" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDeleteUser = (user: UserProfile) => {
    setDeleteTarget(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleteDialogOpen(false);
    setActionLoading(`${deleteTarget.id}-delete`);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: deleteTarget.id },
      });
      if (error) throw error;
      const res = data as any;
      if (res?.error) throw new Error(res.error);
      toast({ title: "User Deleted", description: res?.message || "User deleted", variant: "success" });
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      const deletedEmail = deleteTarget.email.trim().toLowerCase();
      setWhitelistRows((prev) => prev.filter((r) => r.email.trim().toLowerCase() !== deletedEmail));
      if (editingUser?.id === deleteTarget.id) {
        setUserDetailOpen(false);
        setEditingUser(null);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Delete Failed", description: error.message });
    } finally {
      setActionLoading(null);
      setDeleteTarget(null);
    }
  };

  const handleCreateUser = async () => {
    const email = createUserForm.email.trim().toLowerCase();
    const password = createUserForm.password;
    if (!email || !email.includes("@")) {
      toast({ variant: "destructive", title: "Invalid email", description: "Enter a valid email address." });
      return;
    }
    if (!password || password.length < 6) {
      toast({ variant: "destructive", title: "Weak password", description: "Password must be at least 6 characters." });
      return;
    }
    setActionLoading("create-user");
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email,
          password,
          full_name: createUserForm.full_name || null,
          credits: parseInt(createUserForm.credits) || 0,
          tier: createUserForm.tier || "none",
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const created = (data as any)?.user;
      toast({ title: "User Created", description: `${email} has been added.`, variant: "success" });
      if (created?.id) {
        setUsers((prev) => [
          {
            id: created.id,
            email,
            credits: created.credits ?? 0,
            is_unlimited: false,
            full_name: created.full_name ?? null,
            subscription_tier: created.subscription_tier ?? "none",
            subscription_status: null,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
      setCreateUserOpen(false);
      setCreateUserForm({ email: "", password: "", full_name: "", credits: "0", tier: "none" });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Create Failed", description: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  const whitelistedEmailSet = useMemo(() => {
    return new Set(whitelistRows.map((r) => r.email.trim().toLowerCase()));
  }, [whitelistRows]);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((u) => u.email.toLowerCase().includes(q));
    }
    if (sortCreditsAsc !== null) {
      result = [...result].sort((a, b) => (sortCreditsAsc ? a.credits - b.credits : b.credits - a.credits));
    }
    return result;
  }, [users, searchQuery, sortCreditsAsc]);

  // Reset pages on filter changes
  useEffect(() => { setUsersPage(1); }, [searchQuery, sortCreditsAsc]);
  useEffect(() => { setJobsPage(1); }, [jobStatusFilter, jobSearch]);

  const usersTotalPages = Math.ceil(filteredUsers.length / ADMIN_PAGE_SIZE);
  const paginatedUsers = filteredUsers.slice((usersPage - 1) * ADMIN_PAGE_SIZE, usersPage * ADMIN_PAGE_SIZE);

  const jobsTotalPages = Math.ceil(jobs.length / ADMIN_PAGE_SIZE);
  const paginatedJobs = jobs.slice((jobsPage - 1) * ADMIN_PAGE_SIZE, jobsPage * ADMIN_PAGE_SIZE);

  const purchasesTotalPages = Math.ceil(purchases.length / ADMIN_PAGE_SIZE);
  const paginatedPurchases = purchases.slice((purchasesPage - 1) * ADMIN_PAGE_SIZE, purchasesPage * ADMIN_PAGE_SIZE);

  if (authChecking) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center space-y-5">
          <div className="mx-auto w-fit rounded-full bg-destructive/10 p-3">
            <Lock className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground">
            You must be logged in as an administrator to access this dashboard.
          </p>
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => navigate("/admin/login")}>
              Log In
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => navigate("/")}>
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-white/[0.06]">
        <SidebarHeader className="p-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <span className="font-display text-base font-semibold text-foreground tracking-tight group-data-[collapsible=icon]:hidden">
              Admin
            </span>
          </div>
        </SidebarHeader>
        <Separator className="mx-3 w-auto opacity-40" />
        <SidebarContent className="pt-4">
          <SidebarGroup className="p-3 pt-0">
            <SidebarGroupContent>
              <SidebarMenu className="gap-2">
                {adminMenuItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        size="lg"
                        onClick={() => setActiveTab(item.id)}
                        className={cn(
                          "rounded-lg border transition-all duration-200 cursor-pointer",
                          "group-data-[collapsible=icon]:!h-11 group-data-[collapsible=icon]:!w-11 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center",
                          isActive
                            ? "bg-white/[0.06] text-foreground border-white/10"
                            : "bg-white/[0.02] text-muted-foreground border-transparent hover:bg-white/[0.04] hover:text-foreground hover:border-white/5",
                        )}
                      >
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span className="truncate text-[12px] font-medium tracking-tight opacity-90 group-data-[collapsible=icon]:hidden">
                          {item.title}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-3 pt-2">
          <Separator className="mx-2 w-auto opacity-40 mb-3" />
          <SidebarMenuButton
            tooltip="Back to App"
            onClick={() => navigate("/app")}
            className="w-full rounded-lg border border-transparent bg-white/[0.02] text-muted-foreground hover:bg-white/[0.04] hover:text-foreground hover:border-white/5 transition-all duration-200 group-data-[collapsible=icon]:!h-11 group-data-[collapsible=icon]:!w-11 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center"
          >
            <ArrowLeft className="w-5 h-5 shrink-0" />
            <span className="truncate text-[12px] font-medium tracking-tight opacity-90 group-data-[collapsible=icon]:hidden">
              Back to App
            </span>
          </SidebarMenuButton>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-6 py-3">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-5 opacity-40" />
            <div>
              <h1 className="text-lg font-display font-semibold text-foreground capitalize tracking-tight">
                {activeTab === "whitelist" ? "VIP Users" : activeTab === "profile" ? "Profile" : activeTab}
              </h1>
              <div className="flex items-center gap-2">
                <RealtimeDot status={realtimeStatus} />
                {lastSyncAt && (
                  <span className="text-[10px] text-muted-foreground/60">
                    Synced {lastSyncAt.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              fetchData();
              if (activeTab === "analytics") fetchAnalytics(analyticsPeriod);
              if (activeTab === "jobs") fetchJobs(jobStatusFilter, jobSearch);
              if (activeTab === "purchases") fetchPurchases();
            }}
            disabled={loading || analyticsLoading || jobsLoading || purchasesLoading}
            className="border-white/[0.08] hover:bg-white/[0.04]"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", (loading || analyticsLoading || jobsLoading || purchasesLoading) && "animate-spin")} />
            Refresh
          </Button>
        </header>

        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* ── ANALYTICS TAB ──────────────────────────────── */}
            {activeTab === "analytics" && (
              <div className="space-y-5">
                {/* Period filter bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Period:</span>
                    <div className="flex gap-1">
                      {PERIOD_OPTIONS.map((opt) => (
                        <Button
                          key={opt.value}
                          size="sm"
                          variant={analyticsPeriod === opt.value ? "default" : "outline"}
                          className={cn(
                            "h-7 text-xs px-3",
                            analyticsPeriod !== opt.value && "border-white/[0.08] hover:bg-white/[0.04]",
                          )}
                          onClick={() => setAnalyticsPeriod(opt.value)}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {analyticsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                {/* KPI stat cards - row 1 */}
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-muted-foreground">Total Users</span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <UserCheck className="h-3.5 w-3.5 text-primary" />
                      </div>
                    </div>
                    <div className="text-2xl font-display font-bold text-foreground tracking-tight">
                      {(analyticsData?.total_users ?? stats?.total_users ?? 0).toLocaleString()}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      +{analyticsData?.period_new_users ?? 0} in {analyticsPeriod}d
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-muted-foreground">Generations</span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
                        <Zap className="h-3.5 w-3.5 text-accent" />
                      </div>
                    </div>
                    <div className="text-2xl font-display font-bold text-foreground tracking-tight">
                      {(analyticsData?.period_jobs ?? 0).toLocaleString()}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {(analyticsData?.total_jobs ?? stats?.total_jobs ?? 0).toLocaleString()} all-time
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-muted-foreground">Success Rate</span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      </div>
                    </div>
                    <div className="text-2xl font-display font-bold text-foreground tracking-tight">
                      {analyticsData?.success_rate ?? 0}%
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {analyticsData?.period_jobs_failed ?? 0} failed in {analyticsPeriod}d
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-muted-foreground">Total Credit Balance</span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                        <Coins className="h-3.5 w-3.5 text-amber-500" />
                      </div>
                    </div>
                    <div className="text-2xl font-display font-bold text-foreground tracking-tight">
                      {(analyticsData?.total_credits ?? stats?.total_credits_distributed ?? 0).toLocaleString()}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Avg {analyticsData?.avg_tasks_per_job ?? 0} tasks/job
                    </p>
                  </div>
                </div>

                {/* Row 2: mini status cards */}
                <div className="grid gap-3 grid-cols-3">
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground tabular-nums">
                        {(analyticsData?.period_jobs_done ?? 0).toLocaleString()}
                      </div>
                      <span className="text-[10px] text-muted-foreground">Completed</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                      <XCircle className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground tabular-nums">
                        {(analyticsData?.period_jobs_failed ?? 0).toLocaleString()}
                      </div>
                      <span className="text-[10px] text-muted-foreground">Failed</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground tabular-nums">
                        {(analyticsData?.period_jobs_running ?? 0).toLocaleString()}
                      </div>
                      <span className="text-[10px] text-muted-foreground">In Progress</span>
                    </div>
                  </div>
                </div>

                {/* Row 3: Daily generations bar chart (full-width) */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      Daily Generations
                    </h3>
                    <span className="text-[10px] text-muted-foreground">Last {analyticsPeriod} days</span>
                  </div>
                  <div className="h-[220px]">
                    {(analyticsData?.daily_jobs?.length ?? 0) > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData!.daily_jobs} barGap={1}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis
                            dataKey="day"
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={(v) => new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" })}
                            interval={Math.max(0, Math.floor((analyticsData?.daily_jobs?.length ?? 0) / 8) - 1)}
                            stroke="rgba(255,255,255,0.06)"
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            stroke="rgba(255,255,255,0.06)"
                            allowDecimals={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 8,
                              fontSize: 12,
                              color: "hsl(var(--foreground))",
                            }}
                            labelFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="done" name="Completed" fill="#22c55e" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                        No generation data for this period
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 4: User signups area chart + Job status pie */}
                <div className="grid gap-4 sm:grid-cols-5">
                  <div className="sm:col-span-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        User Signups
                      </h3>
                      <Badge variant="outline" className="text-[10px] border-white/[0.08]">
                        +{analyticsData?.period_new_users ?? 0} total
                      </Badge>
                    </div>
                    <div className="h-[200px]">
                      {(analyticsData?.daily_signups?.length ?? 0) > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analyticsData!.daily_signups}>
                            <defs>
                              <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis
                              dataKey="day"
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              tickFormatter={(v) => new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" })}
                              interval={Math.max(0, Math.floor((analyticsData?.daily_signups?.length ?? 0) / 6) - 1)}
                              stroke="rgba(255,255,255,0.06)"
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              stroke="rgba(255,255,255,0.06)"
                              allowDecimals={false}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--popover))",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 8,
                                fontSize: 12,
                                color: "hsl(var(--foreground))",
                              }}
                              labelFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
                            />
                            <Area
                              type="monotone"
                              dataKey="count"
                              name="New Users"
                              stroke="hsl(var(--primary))"
                              fill="url(#signupGrad)"
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                          No signup data for this period
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <h3 className="text-sm font-medium text-foreground mb-4">Job Status Breakdown</h3>
                    <div className="h-[200px]">
                      {(analyticsData?.job_status_breakdown?.length ?? 0) > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analyticsData!.job_status_breakdown}
                              dataKey="count"
                              nameKey="status"
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={75}
                              paddingAngle={3}
                              strokeWidth={0}
                            >
                              {analyticsData!.job_status_breakdown.map((entry, i) => (
                                <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--popover))",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 8,
                                fontSize: 12,
                                color: "hsl(var(--foreground))",
                              }}
                            />
                            <Legend
                              wrapperStyle={{ fontSize: 11 }}
                              formatter={(value: string) => (
                                <span className="text-muted-foreground capitalize">{value}</span>
                              )}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                          No job data
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 5: Top users + Credit distribution */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-500" />
                      Top Users by Jobs
                    </h3>
                    <div className="h-[220px]">
                      {(analyticsData?.top_users_by_jobs?.length ?? 0) > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={analyticsData!.top_users_by_jobs}
                            layout="vertical"
                            margin={{ left: 10, right: 16, top: 0, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                            <XAxis
                              type="number"
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              stroke="rgba(255,255,255,0.06)"
                              allowDecimals={false}
                            />
                            <YAxis
                              type="category"
                              dataKey="email"
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              width={120}
                              stroke="rgba(255,255,255,0.06)"
                              tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 16) + "…" : v}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--popover))",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 8,
                                fontSize: 12,
                                color: "hsl(var(--foreground))",
                              }}
                              formatter={(value: number) => [value.toLocaleString(), "Jobs"]}
                            />
                            <Bar dataKey="jobs" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={18} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                          No data for this period
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-500" />
                      Credit Distribution
                    </h3>
                    <div className="h-[220px]">
                      {(analyticsData?.credit_distribution?.length ?? 0) > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analyticsData!.credit_distribution}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis
                              dataKey="bucket"
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              stroke="rgba(255,255,255,0.06)"
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              stroke="rgba(255,255,255,0.06)"
                              allowDecimals={false}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--popover))",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 8,
                                fontSize: 12,
                                color: "hsl(var(--foreground))",
                              }}
                              formatter={(value: number) => [value.toLocaleString(), "Users"]}
                            />
                            <Bar dataKey="count" name="Users" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={36} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                          No credit data
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 6: Recent users + VIP summary (kept compact at bottom) */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
                    <h3 className="text-sm font-medium text-foreground">Recent Users</h3>
                    <div className="space-y-2">
                      {users.slice(0, 5).map((u) => (
                        <div key={u.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-7 w-7 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                              {u.email.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-foreground/90 truncate text-xs">{u.email}</span>
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {u.credits.toLocaleString()}
                          </span>
                        </div>
                      ))}
                      {users.length === 0 && (
                        <p className="text-xs text-muted-foreground py-4 text-center">No users yet</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
                    <h3 className="text-sm font-medium text-foreground">VIP Summary</h3>
                    <div className="space-y-2">
                      {whitelistRows.slice(0, 5).map((row) => {
                        const mu = users.find((u) => u.email.trim().toLowerCase() === row.email.trim().toLowerCase());
                        return (
                          <div key={row.email} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="secondary" className="bg-primary/15 text-primary text-[10px] shrink-0">
                                VIP
                              </Badge>
                              <span className="text-foreground/90 truncate text-xs">{row.email}</span>
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                              {(mu?.credits ?? 0).toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                      {whitelistRows.length === 0 && (
                        <p className="text-xs text-muted-foreground py-4 text-center">No VIP users yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── USERS TAB ──────────────────────────────────── */}
            {activeTab === "users" && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="flex items-center justify-between gap-4 p-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-medium text-foreground">
                    User Database
                    <span className="text-muted-foreground font-normal ml-2">
                      {stats && users.length < (stats.total_users ?? 0)
                        ? `(showing ${filteredUsers.length} of ${stats.total_users})`
                        : `(${filteredUsers.length})`}
                    </span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="relative max-w-xs w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-8 text-xs bg-white/[0.02] border-white/[0.08]"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-xs shrink-0"
                      onClick={() => {
                        setCreateUserForm({ email: "", password: "", full_name: "", credits: "0", tier: "none" });
                        setCreateUserOpen(true);
                      }}
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                      Add User
                    </Button>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">
                        <button
                          onClick={() =>
                            setSortCreditsAsc((prev) => (prev === null ? false : prev === false ? true : null))
                          }
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          Credits
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Joined</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((user) => {
                      const isVip = whitelistedEmailSet.has(user.email.trim().toLowerCase());
                      return (
                        <TableRow key={user.id} className="border-white/[0.04] group">
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                                {user.email.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-sm text-foreground">{user.email}</span>
                                  {isVip && (
                                    <Badge variant="secondary" className="bg-primary/15 text-primary text-[10px] shrink-0">
                                      VIP
                                    </Badge>
                                  )}
                                  {user.is_unlimited && (
                                    <Badge variant="secondary" className="bg-amber-500/15 text-amber-500 text-[10px] shrink-0">
                                      <Infinity className="h-3 w-3" />
                                    </Badge>
                                  )}
                                </div>
                                {user.full_name && (
                                  <span className="text-[11px] text-muted-foreground/70 truncate block">{user.full_name}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm tabular-nums">{user.credits.toLocaleString()}</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-normal border-white/[0.08]",
                                user.subscription_tier !== "none"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "text-muted-foreground",
                              )}
                            >
                              {user.subscription_tier === "none" ? "Free" : user.subscription_tier}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-white/[0.08] hover:bg-white/[0.04]"
                                disabled={actionLoading === `${user.id}-credits`}
                                onClick={() => handleGiveCredits(user.id, user.email, 100)}
                              >
                                +100
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 hover:bg-white/[0.06]"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => openUserDetail(user)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View / Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openCustomCreditsDialog(user.id, user.email)}>
                                    <Coins className="h-4 w-4 mr-2" />
                                    Add Credits
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => confirmDeleteUser(user)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete User
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {paginatedUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">
                          {searchQuery ? "No users match your search." : "No users found."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {usersTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-xs text-muted-foreground">
                      Showing {(usersPage - 1) * ADMIN_PAGE_SIZE + 1}–{Math.min(usersPage * ADMIN_PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs border-white/[0.08]" disabled={usersPage <= 1} onClick={() => setUsersPage((p) => p - 1)}>Previous</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-white/[0.08]" disabled={usersPage >= usersTotalPages} onClick={() => setUsersPage((p) => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── WHITELIST TAB ────────────────────────────────── */}
            {activeTab === "whitelist" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5 space-y-3">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    Grant VIP Access
                  </h3>
                  <div className="flex gap-3">
                    <Input
                      placeholder="user@example.com"
                      value={whitelistEmail}
                      onChange={(e) => setWhitelistEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddWhitelist()}
                      className="max-w-md bg-white/[0.02] border-white/[0.08]"
                    />
                    <Button
                      onClick={handleAddWhitelist}
                      disabled={!!actionLoading || !whitelistEmail.trim()}
                      className="bg-primary hover:bg-primary/90 shrink-0"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Grant VIP (1M Credits)
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sets the user's balance to at least 1,000,000 credits.
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <div className="p-4 border-b border-white/[0.06]">
                    <h3 className="text-sm font-medium text-foreground">
                      VIP Users
                      <span className="text-muted-foreground font-normal ml-2">({whitelistRows.length})</span>
                    </h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/[0.06] hover:bg-transparent">
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs">Balance</TableHead>
                        <TableHead className="text-xs">Added</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {whitelistRows.map((row) => {
                        const matchingUser = users.find(
                          (u) => u.email.trim().toLowerCase() === row.email.trim().toLowerCase(),
                        );
                        return (
                          <TableRow key={row.email} className="border-white/[0.04]">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-foreground">{row.email}</span>
                                <Badge variant="secondary" className="bg-primary/15 text-primary text-[10px]">
                                  VIP
                                </Badge>
                              </div>
                              {row.reason && (
                                <div className="text-xs text-muted-foreground mt-0.5">{row.reason}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm tabular-nums">
                              {(matchingUser?.credits ?? 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(row.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                {matchingUser && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs border-white/[0.08] hover:bg-white/[0.04]"
                                      onClick={() => handleGiveCredits(matchingUser.id, matchingUser.email, 100_000)}
                                    >
                                      +100k
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs border-white/[0.08] hover:bg-white/[0.04]"
                                      onClick={() => openCustomCreditsDialog(matchingUser.id, matchingUser.email)}
                                    >
                                      Custom
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  onClick={() => confirmRemoveWhitelist(row.email)}
                                  disabled={actionLoading === `whitelist-remove:${row.email}`}
                                >
                                  Remove
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {whitelistRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-12">
                            <UserX className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">No VIP users yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Add one using the form above</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* ── JOBS TAB ─────────────────────────────────────── */}
            {activeTab === "jobs" && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(["all", "pending", "running", "done", "failed"] as JobStatusFilter[]).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={jobStatusFilter === s ? "default" : "outline"}
                        className={cn(
                          "h-7 text-xs capitalize",
                          jobStatusFilter !== s && "border-white/[0.08] hover:bg-white/[0.04]",
                        )}
                        onClick={() => setJobStatusFilter(s)}
                      >
                        {s === "all" ? "All" : s}
                        {s !== "all" && (
                          <span
                            className="ml-1.5 h-2 w-2 rounded-full inline-block"
                            style={{ background: STATUS_COLORS[s] || "#6b7280" }}
                          />
                        )}
                      </Button>
                    ))}
                  </div>
                   <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase.rpc('reap_stale_jobs' as any, { max_age_minutes: 60 });
                          if (error) throw error;
                          const result = data as any;
                          toast({
                            title: "Stale jobs reaped",
                            description: `${result?.reaped_jobs ?? 0} jobs, ${result?.reaped_tasks ?? 0} tasks marked as failed`,
                            variant: "success" as any,
                          });
                          fetchJobs(jobStatusFilter, jobSearch);
                        } catch (err: any) {
                          toast({ title: "Reap failed", description: err.message, variant: "destructive" });
                        }
                      }}
                    >
                      <Skull className="h-3.5 w-3.5" /> Reap Stale
                    </Button>
                    <div className="relative flex-1 sm:w-56">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by email..."
                        value={jobSearch}
                        onChange={(e) => setJobSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") fetchJobs(jobStatusFilter, jobSearch);
                        }}
                        className="pl-9 h-8 text-xs bg-white/[0.02] border-white/[0.08]"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-white/[0.08] hover:bg-white/[0.04]"
                      onClick={() => fetchJobs(jobStatusFilter, jobSearch)}
                      disabled={jobsLoading}
                    >
                      {jobsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/[0.06] hover:bg-transparent">
                        <TableHead className="text-xs">User</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Tasks</TableHead>
                        <TableHead className="text-xs">Niche</TableHead>
                        <TableHead className="text-xs">Created</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedJobs.map((job) => {
                        const progress = job.tasks_total > 0
                          ? Math.round(((job.tasks_done + job.tasks_failed) / job.tasks_total) * 100)
                          : 0;
                        return (
                          <TableRow key={job.id} className="border-white/[0.04] group">
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-7 w-7 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                                  {job.email.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-sm text-foreground truncate block">{job.email}</span>
                                  <span className="text-[10px] text-muted-foreground/60 truncate block font-mono">{job.id.slice(0, 8)}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-normal border-white/[0.08] capitalize",
                                  job.status === "done" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                                  job.status === "failed" && "bg-red-500/10 text-red-400 border-red-500/20",
                                  job.status === "running" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                                  job.status === "pending" && "bg-gray-500/10 text-gray-400 border-gray-500/20",
                                )}
                              >
                                {job.status === "running" && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                                {job.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="text-xs tabular-nums">
                                  <span className="text-emerald-400">{job.tasks_done}</span>
                                  {job.tasks_failed > 0 && (
                                    <span className="text-red-400 ml-1">/ {job.tasks_failed}f</span>
                                  )}
                                  <span className="text-muted-foreground"> / {job.tasks_total}</span>
                                </div>
                                <div className="w-20 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${progress}%`,
                                      background: job.tasks_failed > 0 ? "#ef4444" : "#22c55e",
                                    }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground capitalize">{job.niche || "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(job.created_at).toLocaleString(undefined, {
                                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                              })}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-white/[0.08] hover:bg-white/[0.04]"
                                  onClick={() => openJobDetail(job)}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  Details
                                </Button>
                                {(job.status === "pending" || job.status === "running") && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 text-xs"
                                    onClick={() => handleCancelJob(job.id)}
                                    disabled={actionLoading === `cancel-${job.id}`}
                                  >
                                    {actionLoading === `cancel-${job.id}` ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <>
                                        <StopCircle className="h-3.5 w-3.5 mr-1" />
                                        Cancel
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {paginatedJobs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12">
                            {jobsLoading ? (
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                            ) : (
                              <>
                                <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">No jobs found</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Adjust filters or wait for new generations</p>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {jobsTotalPages > 1 && (
                    <div className="flex items-center justify-between pt-3">
                      <span className="text-xs text-muted-foreground">
                        Showing {(jobsPage - 1) * ADMIN_PAGE_SIZE + 1}–{Math.min(jobsPage * ADMIN_PAGE_SIZE, jobs.length)} of {jobs.length}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs border-white/[0.08]" disabled={jobsPage <= 1} onClick={() => setJobsPage((p) => p - 1)}>Previous</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs border-white/[0.08]" disabled={jobsPage >= jobsTotalPages} onClick={() => setJobsPage((p) => p + 1)}>Next</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PURCHASES TAB ──────────────────────────────────── */}
            {activeTab === "purchases" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Recent Purchases</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Live overview of completed Stripe checkout sessions.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-white/[0.08]"
                    onClick={fetchPurchases}
                    disabled={purchasesLoading}
                  >
                    {purchasesLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Refetch Purchases
                  </Button>
                </div>

                <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/[0.06] hover:bg-transparent">
                        <TableHead className="text-xs">Customer</TableHead>
                        <TableHead className="text-xs">Package</TableHead>
                        <TableHead className="text-xs">Amount</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchasesLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : purchases.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12">
                            <ShoppingCart className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">No purchases found</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Completed Stripe checkouts will appear here</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedPurchases.map((purchase) => (
                          <TableRow key={purchase.id} className="border-white/[0.04]">
                            <TableCell>
                              <div className="min-w-0">
                                <span className="text-sm text-foreground truncate block">{purchase.email}</span>
                                {purchase.customer_name && (
                                  <span className="text-[10px] text-muted-foreground/60 truncate block">{purchase.customer_name}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-foreground">{purchase.package}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium text-foreground tabular-nums">
                                {purchase.currency === "EUR" ? "€" : purchase.currency === "USD" ? "$" : purchase.currency}{purchase.amount.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] border-white/[0.08]",
                                  purchase.mode === "subscription"
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : "bg-white/[0.04]"
                                )}
                              >
                                {purchase.mode === "subscription" ? "Subscription" : "One-time"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] border-white/[0.08]",
                                  purchase.status === "paid"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                )}
                              >
                                {purchase.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {new Date(purchase.created_at).toLocaleDateString()} {new Date(purchase.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {purchasesTotalPages > 1 && (
                    <div className="flex items-center justify-between pt-3">
                      <span className="text-xs text-muted-foreground">
                        Showing {(purchasesPage - 1) * ADMIN_PAGE_SIZE + 1}–{Math.min(purchasesPage * ADMIN_PAGE_SIZE, purchases.length)} of {purchases.length}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs border-white/[0.08]" disabled={purchasesPage <= 1} onClick={() => setPurchasesPage((p) => p - 1)}>Previous</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs border-white/[0.08]" disabled={purchasesPage >= purchasesTotalPages} onClick={() => setPurchasesPage((p) => p + 1)}>Next</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PROFILE TAB ──────────────────────────────────── */}
            {activeTab === "profile" && (
              <AdminProfileTab />
            )}

          </div>
        </main>
      </SidebarInset>

      {/* Custom Credits Dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Credits</DialogTitle>
            <DialogDescription>
              Add a custom credit amount to <span className="font-medium text-foreground">{creditTarget?.email}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="credit-amount">Amount</Label>
            <Input
              id="credit-amount"
              type="number"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCustomCredits()}
              min={1}
              placeholder="1000"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCustomCredits}>
              <Coins className="h-4 w-4 mr-2" />
              Add {parseInt(creditAmount) > 0 ? parseInt(creditAmount).toLocaleString() : 0} Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove VIP Confirmation */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove VIP Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-medium text-foreground">{removeTarget}</span> from the VIP list
              and revoke their unlimited status. Their existing credit balance will not be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveWhitelist}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove VIP Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Detail / Edit Dialog */}
      <Dialog open={userDetailOpen} onOpenChange={setUserDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-muted-foreground" />
              Manage User
            </DialogTitle>
            <DialogDescription>
              {editingUser?.email}
              {editingUser && (
                <span className="text-muted-foreground/60 ml-2">
                  Joined {new Date(editingUser.created_at).toLocaleDateString()}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-5 py-2">
              {/* Credits Section */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">Credits</Label>
                  <span className="text-xs text-muted-foreground/60">
                    Current: {editingUser.credits.toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={editCredits}
                    onChange={(e) => setEditCredits(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSetCredits()}
                    min={0}
                    className="bg-white/[0.02] border-white/[0.08]"
                  />
                  <Button
                    size="sm"
                    onClick={handleSetCredits}
                    disabled={actionLoading === `${editingUser.id}-set-credits`}
                    className="shrink-0"
                  >
                    {actionLoading === `${editingUser.id}-set-credits` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        Set
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex gap-1.5">
                  {[0, 100, 1000, 10000, 100000, 1000000].map((val) => (
                    <Button
                      key={val}
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] border-white/[0.08] hover:bg-white/[0.04] px-2"
                      onClick={() => setEditCredits(String(val))}
                    >
                      {val === 0 ? "Reset" : val.toLocaleString()}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Profile Fields */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
                <Label className="text-xs font-medium text-muted-foreground">Profile</Label>

                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-xs">Full Name</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="No name set"
                    className="bg-white/[0.02] border-white/[0.08]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-tier" className="text-xs">Subscription Tier</Label>
                  <select
                    id="edit-tier"
                    value={editTier}
                    onChange={(e) => setEditTier(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="none">Free</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="edit-unlimited" className="text-xs">Unlimited Mode</Label>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Bypass credit checks entirely</p>
                  </div>
                  <Switch
                    id="edit-unlimited"
                    checked={editUnlimited}
                    onCheckedChange={setEditUnlimited}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="sm:mr-auto"
              onClick={() => {
                if (editingUser) {
                  setUserDetailOpen(false);
                  confirmDeleteUser(editingUser);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete User
            </Button>
            <Button variant="outline" onClick={() => setUserDetailOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateUser}
              disabled={actionLoading === `${editingUser?.id}-update`}
            >
              {actionLoading === `${editingUser?.id}-update` ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.email}</span>{" "}
              and all their data including profile, generation jobs, and images. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Job Detail Dialog */}
      <Dialog open={jobDetailOpen} onOpenChange={setJobDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Job Details
            </DialogTitle>
            <DialogDescription>
              {selectedJob && (
                <span className="font-mono text-xs">{selectedJob.id}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedJob && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">User</span>
                  <p className="text-sm text-foreground">{selectedJob.email}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</span>
                  <div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-normal border-white/[0.08] capitalize",
                        selectedJob.status === "done" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                        selectedJob.status === "failed" && "bg-red-500/10 text-red-400 border-red-500/20",
                        selectedJob.status === "running" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                      )}
                    >
                      {selectedJob.status}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Niche</span>
                  <p className="text-sm text-foreground capitalize">{selectedJob.niche || "—"}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Progress</span>
                  <p className="text-sm tabular-nums">
                    <span className="text-emerald-400">{selectedJob.tasks_done}</span>
                    {selectedJob.tasks_failed > 0 && <span className="text-red-400"> / {selectedJob.tasks_failed}f</span>}
                    <span className="text-muted-foreground"> / {selectedJob.tasks_total}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Created</span>
                  <p className="text-sm text-foreground">{new Date(selectedJob.created_at).toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Completed</span>
                  <p className="text-sm text-foreground">
                    {selectedJob.completed_at ? new Date(selectedJob.completed_at).toLocaleString() : "—"}
                  </p>
                </div>
              </div>

              {selectedJob.config && (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Config</span>
                  <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono bg-black/20 rounded p-2 max-h-32 overflow-y-auto">
                    {JSON.stringify(selectedJob.config, null, 2)}
                  </pre>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Tasks</span>
                  {jobTasksLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
                {jobTasks.length > 0 ? (
                  <div className="rounded-lg border border-white/[0.06] overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/[0.06] hover:bg-transparent">
                          <TableHead className="text-[10px]">View</TableHead>
                          <TableHead className="text-[10px]">Variant</TableHead>
                          <TableHead className="text-[10px]">Status</TableHead>
                          <TableHead className="text-[10px]">Attempts</TableHead>
                          <TableHead className="text-[10px]">Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobTasks.map((task) => (
                          <TableRow key={task.id} className="border-white/[0.04]">
                            <TableCell className="text-xs capitalize">
                              {task.is_base && (
                                <Badge variant="secondary" className="bg-primary/15 text-primary text-[8px] mr-1.5">BASE</Badge>
                              )}
                              {task.view_name}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {task.variant_color && (
                                  <span
                                    className="h-3 w-3 rounded-full border border-white/[0.12] shrink-0"
                                    style={{ background: task.variant_color }}
                                  />
                                )}
                                <span className="text-xs">{task.variant_name || "—"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] font-normal border-white/[0.08] capitalize",
                                  task.status === "done" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                                  task.status === "failed" && "bg-red-500/10 text-red-400 border-red-500/20",
                                  task.status === "running" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                                )}
                              >
                                {task.status}
                              </Badge>
                              {task.last_error && (
                                <p className="text-[10px] text-red-400/80 mt-0.5 max-w-[200px] truncate" title={task.last_error}>
                                  {task.last_error}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-xs tabular-nums text-muted-foreground">
                              {task.attempt_count}/{task.max_attempts}
                            </TableCell>
                            <TableCell>
                              {task.result_url ? (
                                <a
                                  href={task.result_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                                >
                                  View <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground/50">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : !jobTasksLoading ? (
                  <p className="text-xs text-muted-foreground/60 text-center py-4">No tasks found</p>
                ) : null}
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedJob && (selectedJob.status === "pending" || selectedJob.status === "running") && (
              <Button
                variant="destructive"
                size="sm"
                className="mr-auto"
                onClick={() => {
                  handleCancelJob(selectedJob.id);
                }}
                disabled={actionLoading === `cancel-${selectedJob.id}`}
              >
                {actionLoading === `cancel-${selectedJob.id}` ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <StopCircle className="h-3.5 w-3.5 mr-1.5" />
                )}
                Cancel Job
              </Button>
            )}
            <Button variant="outline" onClick={() => setJobDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              Create New User
            </DialogTitle>
            <DialogDescription>
              Add a new user to the platform. They'll be able to log in immediately with these credentials.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-user-email" className="text-xs">Email *</Label>
              <Input
                id="new-user-email"
                type="email"
                value={createUserForm.email}
                onChange={(e) => setCreateUserForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="user@example.com"
                className="bg-white/[0.02] border-white/[0.08]"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-user-password" className="text-xs">Password *</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-user-password"
                  type="text"
                  value={createUserForm.password}
                  onChange={(e) => setCreateUserForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Min 6 characters"
                  className="pl-9 bg-white/[0.02] border-white/[0.08]"
                />
              </div>
              <p className="text-[10px] text-muted-foreground/60">
                Visible for admin convenience. User can reset later.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-user-name" className="text-xs">Full Name</Label>
              <Input
                id="new-user-name"
                value={createUserForm.full_name}
                onChange={(e) => setCreateUserForm((prev) => ({ ...prev, full_name: e.target.value }))}
                placeholder="Optional"
                className="bg-white/[0.02] border-white/[0.08]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="new-user-credits" className="text-xs">Starting Credits</Label>
                <Input
                  id="new-user-credits"
                  type="number"
                  value={createUserForm.credits}
                  onChange={(e) => setCreateUserForm((prev) => ({ ...prev, credits: e.target.value }))}
                  min={0}
                  className="bg-white/[0.02] border-white/[0.08]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-tier" className="text-xs">Subscription Tier</Label>
                <select
                  id="new-user-tier"
                  value={createUserForm.tier}
                  onChange={(e) => setCreateUserForm((prev) => ({ ...prev, tier: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="none">Free</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={
                actionLoading === "create-user" ||
                !createUserForm.email.trim() ||
                createUserForm.password.length < 6
              }
            >
              {actionLoading === "create-user" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
