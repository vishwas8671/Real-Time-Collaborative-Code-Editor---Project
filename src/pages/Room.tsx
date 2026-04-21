import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import {
  Copy, FileCode2, History, MessageSquare, Plus, Send, Trash2, Users, X, Check, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LANGUAGES, langLabel } from "@/lib/languages";
import { toast } from "sonner";

interface FileRow { id: string; name: string; language: string; content: string; updated_at: string; }
interface ChatRow { id: string; user_id: string; content: string; created_at: string; }
interface VersionRow { id: string; content: string; created_at: string; saved_by: string; }
interface PresenceUser { user_id: string; username: string; color: string; }

const SAVE_DEBOUNCE = 800;
const VERSION_INTERVAL_MS = 60_000;

const Room = () => {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const { theme } = useTheme();

  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [files, setFiles] = useState<FileRow[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, { username: string; color: string }>>({});
  const [chatInput, setChatInput] = useState("");
  const [sidebar, setSidebar] = useState<"files" | "users" | "chat">("files");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [newFileName, setNewFileName] = useState("");
  const [newFileLang, setNewFileLang] = useState("javascript");

  const localEditRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const activeFile = useMemo(() => files.find((f) => f.id === activeFileId) ?? null, [files, activeFileId]);

  // Load room + initial data
  useEffect(() => {
    if (!user || !code) return;
    (async () => {
      const { data: room, error } = await supabase.from("rooms").select("*").eq("room_code", code.toUpperCase()).maybeSingle();
      if (error || !room) { toast.error("Room not found"); nav("/dashboard"); return; }
      setRoomId(room.id);
      setRoomName(room.name);

      // Ensure participant
      await supabase.from("room_participants").upsert({ room_id: room.id, user_id: user.id }, { onConflict: "room_id,user_id" });

      const [{ data: fs }, { data: msgs }] = await Promise.all([
        supabase.from("files").select("*").eq("room_id", room.id).order("created_at"),
        supabase.from("chat_messages").select("*").eq("room_id", room.id).order("created_at").limit(200),
      ]);
      const fileRows = (fs as FileRow[]) ?? [];
      setFiles(fileRows);
      if (fileRows.length) {
        setActiveFileId(fileRows[0].id);
        setDraft(fileRows[0].content);
      }
      setMessages((msgs as ChatRow[]) ?? []);
    })();
  }, [user, code, nav]);

  // Load profiles for chat/presence ids on demand
  useEffect(() => {
    const ids = new Set<string>();
    messages.forEach((m) => ids.add(m.user_id));
    presence.forEach((p) => ids.add(p.user_id));
    const missing = Array.from(ids).filter((id) => !profilesById[id]);
    if (missing.length === 0) return;
    supabase.from("profiles").select("id, username, avatar_color").in("id", missing).then(({ data }) => {
      if (!data) return;
      setProfilesById((prev) => {
        const next = { ...prev };
        for (const p of data) next[p.id] = { username: p.username, color: p.avatar_color };
        return next;
      });
    });
  }, [messages, presence, profilesById]);

  // Realtime subscriptions
  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase.channel(`room-${roomId}`, { config: { presence: { key: user.id } } });

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "files", filter: `room_id=eq.${roomId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as FileRow;
          setFiles((prev) => prev.find((f) => f.id === row.id) ? prev : [...prev, row]);
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as FileRow;
          setFiles((prev) => prev.map((f) => f.id === row.id ? { ...f, ...row } : f));
          if (row.id === activeFileIdRef.current && !localEditRef.current) {
            setDraft(row.content);
          }
        } else if (payload.eventType === "DELETE") {
          const row = payload.old as FileRow;
          setFiles((prev) => prev.filter((f) => f.id !== row.id));
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as ChatRow]);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, PresenceUser[]>;
        const list: PresenceUser[] = [];
        const seen = new Set<string>();
        Object.values(state).flat().forEach((p) => {
          if (!seen.has(p.user_id)) { list.push(p); seen.add(p.user_id); }
        });
        setPresence(list);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        const np = newPresences[0] as unknown as PresenceUser | undefined;
        if (np && np.user_id !== user.id) toast(`${np.username} joined`);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        const np = leftPresences[0] as unknown as PresenceUser | undefined;
        if (np && np.user_id !== user.id) toast(`${np.username} left`);
      });

    (async () => {
      const { data: prof } = await supabase.from("profiles").select("username, avatar_color").eq("id", user.id).maybeSingle();
      await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            username: prof?.username ?? "user",
            color: prof?.avatar_color ?? "#6366f1",
          });
        }
      });
    })();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, user]);

  // Track active file id for the realtime callback
  const activeFileIdRef = useRef<string | null>(null);
  useEffect(() => { activeFileIdRef.current = activeFileId; }, [activeFileId]);

  // Auto-scroll chat
  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sidebar]);

  // When switching files, load draft from row
  useEffect(() => {
    if (!activeFile) return;
    localEditRef.current = false;
    setDraft(activeFile.content);
  }, [activeFileId]);

  const handleEditorChange = (value: string | undefined) => {
    if (!activeFile || value === undefined) return;
    localEditRef.current = true;
    setDraft(value);
    setSavingState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("files").update({ content: value }).eq("id", activeFile.id);
      if (!error) {
        setSavingState("saved");
        setFiles((prev) => prev.map((f) => f.id === activeFile.id ? { ...f, content: value } : f));
        setTimeout(() => setSavingState("idle"), 1200);
      }
      localEditRef.current = false;
    }, SAVE_DEBOUNCE);

    if (!versionTimer.current) {
      versionTimer.current = setTimeout(async () => {
        if (!user || !activeFileIdRef.current) { versionTimer.current = null; return; }
        await supabase.from("file_versions").insert({
          file_id: activeFileIdRef.current,
          content: value,
          saved_by: user.id,
        });
        versionTimer.current = null;
      }, VERSION_INTERVAL_MS);
    }
  };

  const changeLanguage = async (lang: string) => {
    if (!activeFile) return;
    await supabase.from("files").update({ language: lang }).eq("id", activeFile.id);
    setFiles((prev) => prev.map((f) => f.id === activeFile.id ? { ...f, language: lang } : f));
  };

  const createFile = async () => {
    if (!user || !roomId || !newFileName.trim()) return;
    const ext = LANGUAGES.find((l) => l.id === newFileLang)?.ext ?? "txt";
    const name = newFileName.includes(".") ? newFileName.trim() : `${newFileName.trim()}.${ext}`;
    const { data, error } = await supabase.from("files").insert({
      room_id: roomId, name: name.slice(0, 80), language: newFileLang, content: "", created_by: user.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setNewFileName("");
    setActiveFileId(data.id);
  };

  const deleteFile = async (id: string) => {
    if (files.length <= 1) { toast.error("Keep at least one file"); return; }
    await supabase.from("files").delete().eq("id", id);
    if (activeFileId === id) {
      const next = files.find((f) => f.id !== id);
      if (next) setActiveFileId(next.id);
    }
  };

  const sendMessage = async () => {
    if (!user || !roomId || !chatInput.trim()) return;
    const content = chatInput.trim().slice(0, 1000);
    setChatInput("");
    await supabase.from("chat_messages").insert({ room_id: roomId, user_id: user.id, content });
  };

  const openHistory = async () => {
    if (!activeFile) return;
    setHistoryOpen(true);
    const { data } = await supabase.from("file_versions").select("*").eq("file_id", activeFile.id).order("created_at", { ascending: false }).limit(50);
    setVersions((data as VersionRow[]) ?? []);
  };

  const restoreVersion = async (v: VersionRow) => {
    if (!activeFile) return;
    await supabase.from("files").update({ content: v.content }).eq("id", activeFile.id);
    setDraft(v.content);
    setHistoryOpen(false);
    toast.success("Version restored");
  };

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast.success("Room code copied");
  };

  const editorTheme = theme === "dark" ? "vs-dark" : "vs";

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader>
        <div className="hidden items-center gap-2 md:flex">
          <span className="text-sm text-muted-foreground">{roomName}</span>
          <Button variant="outline" size="sm" onClick={copyCode} className="gap-2 font-mono">
            <Copy className="h-3 w-3" /> {code}
          </Button>
        </div>
      </AppHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-72 flex-col border-r border-border/60 bg-card/50">
          <Tabs value={sidebar} onValueChange={(v) => setSidebar(v as any)} className="flex flex-1 flex-col">
            <TabsList className="m-2 grid grid-cols-3">
              <TabsTrigger value="files" className="gap-1.5"><FileCode2 className="h-3.5 w-3.5" />Files</TabsTrigger>
              <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" />{presence.length}</TabsTrigger>
              <TabsTrigger value="chat" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" />Chat</TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="m-0 flex flex-1 flex-col overflow-hidden">
              <div className="border-b border-border/60 p-3">
                <div className="flex gap-1.5">
                  <Input
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createFile()}
                    placeholder="filename"
                    className="h-8 text-sm"
                  />
                  <Select value={newFileLang} onValueChange={setNewFileLang}>
                    <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.id} value={l.id}>.{l.ext}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="icon" onClick={createFile} className="h-8 w-8 shrink-0"><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-0.5 p-2">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => setActiveFileId(f.id)}
                      className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                        activeFileId === f.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                      }`}
                    >
                      <FileCode2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="flex-1 truncate font-mono text-xs">{f.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteFile(f.id); }}
                        className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        aria-label="Delete file"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="users" className="m-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-1 p-3">
                  {presence.length === 0 && <p className="text-sm text-muted-foreground">No one online.</p>}
                  {presence.map((p) => (
                    <div key={p.user_id} className="flex items-center gap-2 rounded-md p-2 hover:bg-muted">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.username.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="text-sm">{p.username}</span>
                      {p.user_id === user?.id && <span className="ml-auto text-xs text-muted-foreground">you</span>}
                      <span className="ml-auto h-2 w-2 rounded-full bg-success" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="chat" className="m-0 flex flex-1 flex-col overflow-hidden">
              <div ref={chatScrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
                {messages.length === 0 && <p className="text-center text-sm text-muted-foreground">Say hi 👋</p>}
                {messages.map((m) => {
                  const prof = profilesById[m.user_id];
                  const isMe = m.user_id === user?.id;
                  return (
                    <div key={m.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: prof?.color ?? "#888" }}
                      >
                        {(prof?.username ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                      <div className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {!isMe && <p className="mb-0.5 text-xs font-medium opacity-70">{prof?.username ?? "user"}</p>}
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border/60 p-2">
                <div className="flex gap-1.5">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                    placeholder="Message…"
                    maxLength={1000}
                    className="h-9"
                  />
                  <Button size="icon" onClick={sendMessage} className="h-9 w-9 shrink-0"><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        {/* Editor */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-card/30 px-4 py-2">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm">{activeFile?.name ?? "—"}</span>
              <span className="text-xs text-muted-foreground">
                {savingState === "saving" && <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />saving</span>}
                {savingState === "saved" && <span className="inline-flex items-center gap-1 text-success"><Check className="h-3 w-3" />saved</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {activeFile && (
                <Select value={activeFile.language} onValueChange={changeLanguage}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <Button size="sm" variant="outline" onClick={openHistory} className="gap-1.5">
                <History className="h-3.5 w-3.5" />History
              </Button>
            </div>
          </div>
          <div className="flex-1">
            {activeFile ? (
              <Editor
                height="100%"
                theme={editorTheme}
                language={activeFile.language}
                value={draft}
                onChange={handleEditorChange}
                options={{
                  fontSize: 14,
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontLigatures: true,
                  minimap: { enabled: false },
                  smoothScrolling: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 16 },
                  tabSize: 2,
                  wordWrap: "on",
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No file selected</div>
            )}
          </div>
        </main>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Version history — {activeFile?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 pr-3">
              {versions.length === 0 && <p className="text-sm text-muted-foreground">No snapshots yet — keep typing!</p>}
              {versions.map((v) => {
                const prof = profilesById[v.saved_by];
                return (
                  <Card key={v.id} className="border-border/60 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: prof?.color ?? "#888" }}>
                          {(prof?.username ?? "?").slice(0, 1).toUpperCase()}
                        </span>
                        <span>{prof?.username ?? "user"}</span>
                        <span className="text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => restoreVersion(v)}>Restore</Button>
                    </div>
                    <pre className="max-h-32 overflow-auto rounded bg-muted p-2 font-mono text-xs">
                      {v.content.slice(0, 500)}{v.content.length > 500 ? "…" : ""}
                    </pre>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Room;