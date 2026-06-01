import { readFileSync } from "fs";
import { join } from "path";
import MarkdownPage from "./markdown-page";

export const metadata = {
  title: "Terms of Use — Retirement.SG",
};

export default function TermsPage() {
  const content = readFileSync(
    join(process.cwd(), "content", "terms-of-use.md"),
    "utf-8"
  );

  return <MarkdownPage content={content} />;
}
