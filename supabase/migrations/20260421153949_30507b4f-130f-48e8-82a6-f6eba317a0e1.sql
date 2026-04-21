
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by all authed" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  colors TEXT[] := ARRAY['#6366f1','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#84cc16'];
BEGIN
  INSERT INTO public.profiles (id, username, email, avatar_color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    NEW.email,
    colors[1 + floor(random()*8)::int]
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Rooms
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'javascript',
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone authed reads rooms" ON public.rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "authed creates rooms" ON public.rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "owner updates room" ON public.rooms FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "owner deletes room" ON public.rooms FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Room participants (membership log)
CREATE TABLE public.room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants readable" ON public.room_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "self joins" ON public.room_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "self leaves" ON public.room_participants FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Files in a room
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms ON DELETE CASCADE,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'javascript',
  content TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed reads files" ON public.files FOR SELECT TO authenticated USING (true);
CREATE POLICY "authed creates files" ON public.files FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "authed updates files" ON public.files FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authed deletes files" ON public.files FOR DELETE TO authenticated USING (true);

-- File versions
CREATE TABLE public.file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.files ON DELETE CASCADE,
  content TEXT NOT NULL,
  saved_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed reads versions" ON public.file_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authed creates versions" ON public.file_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() = saved_by);

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed reads chat" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "self sends chat" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Touch updated_at on files
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER files_touch BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime
ALTER TABLE public.files REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.room_participants REPLICA IDENTITY FULL;
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.files;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;

-- Indexes
CREATE INDEX ON public.files(room_id);
CREATE INDEX ON public.chat_messages(room_id, created_at);
CREATE INDEX ON public.room_participants(room_id);
CREATE INDEX ON public.file_versions(file_id, created_at DESC);
