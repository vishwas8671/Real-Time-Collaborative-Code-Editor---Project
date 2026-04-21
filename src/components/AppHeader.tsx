import { Link, useNavigate } from "react-router-dom";
import { Code2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const AppHeader = ({ children }: { children?: React.ReactNode }) => {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState<string>("");
  const [color, setColor] = useState<string>("#6366f1");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("username, avatar_color").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) { setUsername(data.username); setColor(data.avatar_color); }
    });
  }, [user]);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Code2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold">Coderly</span>
        </Link>
        <div className="flex flex-1 items-center justify-end gap-2">
          {children}
          <ThemeToggle />
          {user && (
            <>
              <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 sm:flex">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: color }}
                >
                  {username.slice(0, 1).toUpperCase() || "?"}
                </span>
                <span className="text-sm font-medium">{username || "user"}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={async () => { await signOut(); nav("/"); }} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};