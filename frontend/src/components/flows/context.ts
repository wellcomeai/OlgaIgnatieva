import { createContext, useContext } from "react";

import type { Product } from "@/types";

export interface EditorContextValue {
  stats: Record<string, number>;
  products: Product[];
  botUsername: string;
}

export const EditorContext = createContext<EditorContextValue>({ stats: {}, products: [], botUsername: "" });

export const useEditor = () => useContext(EditorContext);
