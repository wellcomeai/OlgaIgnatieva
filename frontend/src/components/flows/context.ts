import { createContext, useContext } from "react";

import type { Product } from "@/types";

export interface EditorContextValue {
  stats: Record<string, number>;
  products: Product[];
  botUsername: string;
  botId: string;
}

export const EditorContext = createContext<EditorContextValue>({ stats: {}, products: [], botUsername: "", botId: "" });

export const useEditor = () => useContext(EditorContext);
