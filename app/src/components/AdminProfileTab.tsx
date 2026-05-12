import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/integrations/supabase/hooks/useProfile";
import { useCredits } from "@/integrations/supabase/hooks/useCredits";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Camera, Check, Coins, CreditCard, Loader2, Sparkles, User } from "lucide-react";
import { ChangePasswordCard } from "@/components/ChangePasswordCard";

const profileSchema = z.object({
  full_name: z.string().max(100).nullable().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function AdminProfileTab() {
  const { profile, isLoading, updateProfile, updateAvatar, isUpdatingProfile, isUpdatingAvatar } = useProfile();
  const { credits, isLoading: isCreditsLoading } = useCredits();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState("");
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) {
        setUser(u);
        setUserEmail(u.email ?? "");
      }
    });
  }, []);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: profile?.full_name ?? "" },
  });

  useEffect(() => {
    if (profile) form.reset({ full_name: profile.full_name ?? "" });
  }, [profile?.id, profile?.full_name]);

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      await updateProfile({ full_name: values.full_name || null });
      toast({ title: "Profile updated", description: "Your info has been saved.", variant: "success" });
    } catch (err: unknown) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Could not update profile.", variant: "destructive" });
    }
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    if (!["jpeg", "jpg", "png", "webp", "gif"].includes(ext)) {
      toast({ title: "Invalid file", description: "Please use JPEG, PNG, WebP, or GIF.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Avatar must be under 2MB.", variant: "destructive" });
      return;
    }
    try {
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateAvatar(publicUrl);
      toast({ title: "Avatar updated", description: "Your profile photo has been saved.", variant: "success" });
    } catch (err: unknown) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Could not upload avatar.", variant: "destructive" });
    } finally {
      e.target.value = "";
    }
  };

  const formatPlanTier = (tier: string) => tier === "none" ? "Free" : tier.charAt(0).toUpperCase() + tier.slice(1);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch { return dateStr; }
  };

  const getStatusColor = (status: string | null) => {
    if (!status || status === "none") return "bg-muted-foreground/40";
    if (status === "active") return "bg-emerald-500";
    if (status === "trialing") return "bg-amber-500";
    return "bg-muted-foreground/40";
  };

  if (isLoading && !profile) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const displayName = profile?.full_name || userEmail?.split("@")[0] || "User";
  const initial = (profile?.full_name || userEmail)?.charAt(0).toUpperCase() ?? "U";

  return (
    <div className="space-y-8">
      {/* Hero: Avatar + identity */}
      <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-logo-purple/[0.03] via-transparent to-electric-blue/[0.03] pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <button type="button" onClick={handleAvatarClick} disabled={isUpdatingAvatar} className="relative group shrink-0 transition-transform duration-200 hover:scale-105">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-logo-purple to-electric-blue opacity-60 blur-[1px]" />
            <Avatar className="relative h-28 w-28 rounded-full ring-2 ring-background shadow-lg">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt="Avatar" />
              <AvatarFallback className="text-3xl bg-white/[0.06] text-foreground font-medium">{initial}</AvatarFallback>
            </Avatar>
            <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background shadow-sm" />
            <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10" style={{ margin: "-4px" }}>
              {isUpdatingAvatar ? <Loader2 className="w-8 h-8 text-white animate-spin" /> : <Camera className="w-8 h-8 text-white" />}
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarChange} />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-2xl font-semibold text-foreground tracking-tight">{displayName}</h2>
              <Badge variant="outline" className="w-fit border-primary/30 text-foreground">
                Admin
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">{userEmail}</p>
            <button type="button" onClick={handleAvatarClick} disabled={isUpdatingAvatar} className="mt-3 text-sm text-primary hover:text-primary/80 font-medium transition-colors inline-flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" /> Change photo
            </button>
            <p className="text-xs text-muted-foreground/80 mt-1">JPEG, PNG, WebP or GIF. Max 2MB.</p>
          </div>
        </div>
      </div>

      {/* Two-column: Account info | Credits & Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account info */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-200 hover:border-white/[0.1] border-l-2 border-l-logo-purple/40">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-1.5 rounded-md bg-gradient-to-br from-logo-purple/20 to-electric-blue/20">
              <User className="w-4 h-4 text-logo-purple" />
            </div>
            <h3 className="text-lg font-semibold text-foreground tracking-tight">Account</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Update your display name. Email cannot be changed.</p>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin_full_name" className="text-sm font-medium">Display name</Label>
              <Input id="admin_full_name" placeholder="Your name" className="bg-white/[0.03] border-white/10 focus-visible:ring-primary/30" {...form.register("full_name")} />
              {form.formState.errors.full_name && <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_email" className="text-sm font-medium">Email</Label>
              <Input id="admin_email" type="email" value={userEmail} disabled className="opacity-60 cursor-not-allowed bg-white/[0.02]" />
            </div>
            <Button type="submit" disabled={isUpdatingProfile} className="mt-2 rounded-lg bg-gradient-to-r from-logo-purple to-electric-blue text-primary-foreground shadow-button hover:shadow-button-hover hover:opacity-90 transition-all">
              {isUpdatingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Save changes
            </Button>
          </form>
        </div>

        {/* Credits */}
        <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-200 hover:border-white/[0.1] border-l-2 border-l-logo-purple/40 overflow-hidden">
          <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-logo-purple/[0.06] rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-1.5 rounded-md bg-gradient-to-br from-logo-purple/20 to-electric-blue/20">
                <Coins className="w-4 h-4 text-logo-purple" />
              </div>
              <h3 className="text-lg font-semibold text-foreground tracking-tight">Credits</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Your balance for image generation.</p>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-bold tracking-tight">
                  {isCreditsLoading ? (
                    <span className="text-muted-foreground">...</span>
                  ) : profile?.is_unlimited ? (
                    <span className="bg-gradient-to-r from-logo-purple to-electric-blue bg-clip-text text-transparent flex items-center gap-2">
                      <Sparkles className="w-6 h-6 text-logo-purple" /> Unlimited
                    </span>
                  ) : (
                    <span className="bg-gradient-to-r from-logo-purple to-electric-blue bg-clip-text text-transparent">
                      {(credits ?? 0).toLocaleString()}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {profile?.is_unlimited ? "No limits on your account" : "credits available"}
                </p>
              </div>
            </div>
            {!profile?.is_unlimited && !isCreditsLoading && (
              <div className="mt-5">
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-logo-purple to-electric-blue transition-all duration-700" style={{ width: `${Math.min(100, Math.max(5, ((credits ?? 0) / Math.max(credits ?? 1, 100)) * 100))}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Security: Change Password */}
      <ChangePasswordCard />
    </div>
  );
}
