-- Create a table to store user's custom colors
CREATE TABLE public.user_custom_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, color)
);

-- Enable Row Level Security
ALTER TABLE public.user_custom_colors ENABLE ROW LEVEL SECURITY;

-- Users can view their own custom colors
CREATE POLICY "Users can view their own custom colors" 
ON public.user_custom_colors 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own custom colors
CREATE POLICY "Users can insert their own custom colors" 
ON public.user_custom_colors 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own custom colors
CREATE POLICY "Users can delete their own custom colors" 
ON public.user_custom_colors 
FOR DELETE 
USING (auth.uid() = user_id);