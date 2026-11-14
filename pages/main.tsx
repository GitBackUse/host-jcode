import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import { Studio } from "@/components/Studio";
import "@/styles.css";
createRoot(document.getElementById("root")!).render(<><Studio /><Toaster /></>);
