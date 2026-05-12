import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileData {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  credits: number;
  subscription_tier: string;
  subscription_status: string | null;
  current_period_end: string | null;
  is_unlimited: boolean;
}

export function useProfile() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<ProfileData | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, credits, subscription_tier, subscription_status, current_period_end, is_unlimited")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }

      if (!data) {
        return {
          id: user.id,
          full_name: null,
          avatar_url: null,
          credits: 0,
          subscription_tier: "none",
          subscription_status: null,
          current_period_end: null,
          is_unlimited: false,
        };
      }

      return data as ProfileData;
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ full_name }: { full_name: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({ full_name })
        .eq("id", user.id);

      if (error) {
        console.error("Profile update error:", error);
        throw new Error(error.message || "Could not update profile.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile-credits"] });
    },
  });

  const updateAvatarMutation = useMutation({
    mutationFn: async (avatarUrl: string | null) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile-credits"] });
    },
  });

  return {
    profile,
    isLoading,
    refetch,
    updateProfile: updateProfileMutation.mutateAsync,
    updateAvatar: updateAvatarMutation.mutateAsync,
    isUpdatingProfile: updateProfileMutation.isPending,
    isUpdatingAvatar: updateAvatarMutation.isPending,
  };
}
