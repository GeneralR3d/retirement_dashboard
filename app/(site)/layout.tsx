import Footer from "@/app/components/footer";

// Full-width shell for standalone pages (SRS demo, About, Terms, Privacy) —
// no inputs pane, single scrolling column with the footer at the bottom.
export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
