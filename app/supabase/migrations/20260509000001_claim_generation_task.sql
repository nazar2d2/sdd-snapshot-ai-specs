-- STATE-02: Atomic task claim using SELECT FOR UPDATE SKIP LOCKED.
-- Prevents concurrent workers from claiming the same task via the optimistic-lock race window.
CREATE OR REPLACE FUNCTION public.claim_generation_task(
  task_id   uuid,
  p_attempt integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Lock the specific task row; if another session holds a lock, skip immediately (no wait).
  SELECT id INTO v_id
  FROM public.generation_tasks
  WHERE id = task_id
    AND status = 'pending'
  FOR UPDATE SKIP LOCKED;

  IF v_id IS NULL THEN
    -- Task was already claimed or does not exist in pending state.
    RETURN NULL;
  END IF;

  UPDATE public.generation_tasks
  SET
    status        = 'running',
    attempt_count = p_attempt,
    updated_at    = now()
  WHERE id = v_id;

  RETURN v_id;
END;
$$;
