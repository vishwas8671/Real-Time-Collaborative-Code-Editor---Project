import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LogIn, Loader2, Clock, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES, generateRoomCode, langLabel, starterFor } from "@/lib/languages";
import { toast } from "sonner";

interface Room { id: string; room_code: string; name: string; language: string; created_at: string; created_by: string; }

const Dashboard = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({ name: "", language: "javascript" });

  const load = async () => {
    if (!user) return;
    const { data: parts } = await supabase.from("room_participants").select("room_id").eq("user_id", user.id);
    const ids = (parts ?? []).map((p) => p.room_id);
    const { data: ownRooms } = await supabase.from("rooms").select("*").or(`created_by.eq.${user.id}${ids.length ? `,id.in.(${ids.join(",")})` : ""}`).order("created_at", { ascending: false });
    setRooms((ownRooms as Room[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const createRoom = async () => {
    if (!user || !form.name.trim()) { toast.error("Name is required"); return; }
    setCreating(true);
    try {
      const code = generateRoomCode();
      const { data: room, error } = await supabase.from("rooms").insert({
        name: form.name.trim().slice(0, 80),
        language: form.language,
        room_code: code,
        created_by: user.id,
      }).select().single();
      if (error) throw error;
      await supabase.from("room_participants").insert({ room_id: room.id, user_id: user.id });
      await supabase.from("files").insert({
        room_id: room.id,
        name: `main.${LANGUAGES.find(l=>l.id===form.language)?.ext ?? "txt"}`,
        language: form.language,
        content: starterFor(form.language),
        created_by: user.id,
      });
      toast.success(`Room "${room.name}" created`);
      nav(`/room/${room.room_code}`);
    } catch (e: any) {
      toast.error(e.message ?? "Could not create room");
    } finally {
      setCreating(false);
      setOpenCreate(false);
    }
  };

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoining(true);
    const { data, error } = await supabase.from("rooms").select("room_code").eq("room_code", code).maybeSingle();
    setJoining(false);
    if (error || !data) { toast.error("Room not found"); return; }
    nav(`/room/${data.room_code}`);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="container py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Your rooms</h1>
            <p className="mt-1 text-muted-foreground">Create a new room or join one with a code.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                placeholder="ROOM CODE"
                maxLength={8}
                className="w-36 font-mono uppercase tracking-widest"
              />
              <Button variant="outline" onClick={joinRoom} disabled={joining}>
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Join
              </Button>
            </div>
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-90">
                  <Plus className="h-4 w-4" /> New room
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create a coding room</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="rname">Room name</Label>
                    <Input id="rname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Algorithm interview" maxLength={80} />
                  </div>
                  <div>
                    <Label>Default language</Label>
                    <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={createRoom} disabled={creating} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90">
                    {creating && <Loader2 className="h-4 w-4 animate-spin" />} Create room
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-36 animate-pulse-glow border-border/60" />)}
          </div>
        ) : rooms.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 border-dashed border-border/60 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground"><Plus className="h-5 w-5" /></div>
            <div>
              <p className="font-medium">No rooms yet</p>
              <p className="text-sm text-muted-foreground">Create your first room to start coding together.</p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => (
              <Card key={r.id} onClick={() => nav(`/room/${r.room_code}`)} className="group cursor-pointer border-border/60 p-5 transition-all hover:-translate-y-0.5 hover:shadow-elegant">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold">{r.name}</h3>
                  <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{langLabel(r.language)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-mono"><Hash className="h-3 w-3" />{r.room_code}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;