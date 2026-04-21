
-- Restrict file mutations to room participants
DROP POLICY "authed updates files" ON public.files;
DROP POLICY "authed deletes files" ON public.files;

CREATE OR REPLACE FUNCTION public.is_room_participant(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_participants
    WHERE room_id = _room_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.rooms WHERE id = _room_id AND created_by = _user_id
  );
$$;

CREATE POLICY "participants update files" ON public.files
  FOR UPDATE TO authenticated USING (public.is_room_participant(room_id, auth.uid()));
CREATE POLICY "participants delete files" ON public.files
  FOR DELETE TO authenticated USING (public.is_room_participant(room_id, auth.uid()));

-- Fix search_path on touch function
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
