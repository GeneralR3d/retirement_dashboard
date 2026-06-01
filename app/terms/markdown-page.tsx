"use client";

import ReactMarkdown from "react-markdown";

export default function MarkdownPage({ content }: { content: string }) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="prose prose-neutral dark:prose-invert max-w-none [&>h1]:text-3xl [&>h1]:font-black [&>h1]:mb-2 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mt-8 [&>h2]:mb-3 [&>h3]:font-semibold [&>h3]:mt-6 [&>h3]:mb-2 [&>p]:mb-4 [&>p]:leading-relaxed [&>ul]:mb-4 [&>ul]:list-disc [&>ul]:pl-6 [&>ul>li]:mb-1 [&>ol]:mb-4 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol>li]:mb-1 [&>hr]:my-8 [&>hr]:border-foreground/15 [&>strong]:font-bold text-foreground/85 dark:text-foreground/70">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
