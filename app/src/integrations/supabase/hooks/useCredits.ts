import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProfileData {
    credits: number;
    subscription_tier: string | null;
    stripe_customer_id: string | null;
    subscription_status: string | null;
    current_period_end: string | null;
}

export function useCredits() {
    const { data: profile, isLoading, refetch } = useQuery({
        queryKey: ["profile-credits"],
        queryFn: async (): Promise<ProfileData | null> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            // NOTE: the generated TS types in this project don't include the `profiles` table,
            // so we must query it using an `any` cast.
            const { data, error } = await (supabase as any)
                .from("profiles")
                .select("credits, subscription_tier, stripe_customer_id, subscription_status, current_period_end")
                .eq("id", user.id)
                .maybeSingle();

            if (error) {
                console.error("Error fetching profile:", error);
                return {
                    credits: 0,
                    subscription_tier: "none",
                    stripe_customer_id: null,
                    subscription_status: null,
                    current_period_end: null,
                };
            }

            if (!data) {
                return {
                    credits: 0,
                    subscription_tier: "none",
                    stripe_customer_id: null,
                    subscription_status: null,
                    current_period_end: null,
                };
            }

            return {
                ...(data as unknown as ProfileData),
            };
        },
    });

    return {
        credits: profile?.credits ?? 0,
        subscriptionTier: profile?.subscription_tier ?? "none",
        isLoading,
        refetch,
    };
}
