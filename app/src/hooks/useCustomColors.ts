import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomColor {
  id: string;
  color: string;
  name: string;
}

export function useCustomColors() {
  const [customColors, setCustomColors] = useState<CustomColor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load custom colors from database
  const loadColors = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCustomColors([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_custom_colors")
        .select("id, color, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading custom colors:", error);
        return;
      }

      setCustomColors(data || []);
    } catch (err) {
      console.error("Error loading custom colors:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add a new custom color
  const addColor = useCallback(async (color: string, name: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from("user_custom_colors")
        .insert({ user_id: user.id, color, name })
        .select("id, color, name")
        .single();

      if (error) {
        // Ignore duplicate errors silently
        if (error.code === "23505") {
          return true;
        }
        console.error("Error adding custom color:", error);
        return false;
      }

      if (data) {
        setCustomColors((prev) => [...prev, data]);
      }
      return true;
    } catch (err) {
      console.error("Error adding custom color:", err);
      return false;
    }
  }, []);

  // Delete a custom color
  const deleteColor = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("user_custom_colors")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting custom color:", error);
        return false;
      }

      setCustomColors((prev) => prev.filter((c) => c.id !== id));
      return true;
    } catch (err) {
      console.error("Error deleting custom color:", err);
      return false;
    }
  }, []);

  useEffect(() => {
    loadColors();
  }, [loadColors]);

  return {
    customColors,
    isLoading,
    addColor,
    deleteColor,
    refreshColors: loadColors,
  };
}
