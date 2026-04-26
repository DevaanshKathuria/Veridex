declare module "react-highlight-words" {
  import { ComponentType, HTMLAttributes } from "react";

  interface HighlighterProps extends HTMLAttributes<HTMLSpanElement> {
    searchWords: string[];
    textToHighlight: string;
    autoEscape?: boolean;
    highlightClassName?: string;
  }

  const Highlighter: ComponentType<HighlighterProps>;
  export default Highlighter;
}
