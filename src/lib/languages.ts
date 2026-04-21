export const LANGUAGES = [
  { id: "javascript", label: "JavaScript", ext: "js" },
  { id: "typescript", label: "TypeScript", ext: "ts" },
  { id: "python", label: "Python", ext: "py" },
  { id: "java", label: "Java", ext: "java" },
  { id: "cpp", label: "C++", ext: "cpp" },
  { id: "html", label: "HTML", ext: "html" },
  { id: "css", label: "CSS", ext: "css" },
  { id: "json", label: "JSON", ext: "json" },
] as const;

export type LanguageId = typeof LANGUAGES[number]["id"];

export const langLabel = (id: string) =>
  LANGUAGES.find((l) => l.id === id)?.label ?? id;

export const starterFor = (id: string) => {
  switch (id) {
    case "python":
      return "# Welcome to Coderly!\nprint('Hello, world!')\n";
    case "java":
      return "public class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Hello, world!\");\n  }\n}\n";
    case "cpp":
      return "#include <iostream>\nint main() {\n  std::cout << \"Hello, world!\" << std::endl;\n  return 0;\n}\n";
    case "html":
      return "<!doctype html>\n<html>\n  <body>\n    <h1>Hello, world!</h1>\n  </body>\n</html>\n";
    case "css":
      return "body { font-family: system-ui; }\n";
    case "json":
      return "{\n  \"hello\": \"world\"\n}\n";
    default:
      return "// Welcome to Coderly!\nconsole.log('Hello, world!');\n";
  }
};

export const generateRoomCode = () => {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};