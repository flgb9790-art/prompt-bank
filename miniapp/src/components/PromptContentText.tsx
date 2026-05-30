import { normalizePromptContent } from "../utils/promptContentFormat";

type Props = {
  content: string;
  className?: string;
};

export function PromptContentText({ content, className = "" }: Props) {
  return <div className={`prompt-content-text ${className}`.trim()}>{normalizePromptContent(content)}</div>;
}
