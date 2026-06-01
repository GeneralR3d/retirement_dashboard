import { readFileSync } from "fs";
import { join } from "path";
import MarkdownPage from "../terms/markdown-page";

export const metadata = {
  title: "Privacy Policy — Retirement.SG",
};

export default function PrivacyPage() {
  const content = readFileSync(
    join(process.cwd(), "content", "privacy-policy.md"),
    "utf-8"
  );

  return <MarkdownPage content={content} />;
}
