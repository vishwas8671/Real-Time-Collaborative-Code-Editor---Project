import { Link } from "react-router-dom";
import { ArrowRight, Code2, Users, MessageSquare, History, FileCode2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/context/AuthContext";

const features = [
  { icon: Zap, title: "Real-time sync", desc: "Every keystroke broadcast instantly to everyone in the room." },
  { icon: Users, title: "Live presence", desc: "See who's online, with colored avatars and join notifications." },
  { icon: MessageSquare, title: "In-room chat", desc: "Talk to your collaborators without leaving the editor." },
  { icon: FileCode2, title: "Multiple files", desc: "Organize your work across files and switch tabs effortlessly." },
  { icon: History, title: "Version history", desc: "Auto-saved snapshots so you can roll back any time." },
  { icon: Code2, title: "8 languages", desc: "Monaco editor with first-class syntax highlighting and IntelliSense." },
];

const Index = () => {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Code2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold">Coderly</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost"><Link to={user ? "/dashboard" : "/auth"}>{user ? "Dashboard" : "Sign in"}</Link></Button>
          {!user && (
            <Button asChild className="bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-90">
              <Link to="/auth">Get started</Link>
            </Button>
          )}
        </div>
      </header>

      <main>
        <section className="container relative overflow-hidden py-20 sm:py-28">
          <div className="absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-3xl" />
          </div>
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-xs font-medium backdrop-blur">
              <span className="h-2 w-2 animate-pulse-glow rounded-full bg-success" />
              Powered by realtime collaboration
            </div>
            <h1 className="font-display text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
              Code together,<br /><span className="text-gradient">in real time.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Coderly is a collaborative editor where your team writes code in shared rooms — with live presence, chat, version history and zero setup.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-90">
                <Link to={user ? "/dashboard" : "/auth"}>
                  {user ? "Open dashboard" : "Start coding free"} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#features">See features</a>
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="container py-20">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Everything you need to ship together</h2>
            <p className="mt-3 text-muted-foreground">Built for pair-programming, classrooms, interviews and quick collab sessions.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="group relative overflow-hidden border-border/60 p-6 transition-all hover:shadow-elegant">
                <div className="absolute inset-0 -z-10 bg-gradient-primary opacity-0 transition-opacity group-hover:opacity-5" />
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="container pb-24">
          <Card className="relative overflow-hidden border-border/60 bg-gradient-hero p-12 text-center shadow-elegant">
            <h2 className="font-display text-3xl font-bold text-primary-foreground sm:text-4xl">Ready to write code together?</h2>
            <p className="mt-3 text-primary-foreground/90">Create a room in seconds and invite anyone with a single code.</p>
            <Button asChild size="lg" variant="secondary" className="mt-8">
              <Link to={user ? "/dashboard" : "/auth"}>Launch Coderly <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        Built with Lovable Cloud · {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default Index;
