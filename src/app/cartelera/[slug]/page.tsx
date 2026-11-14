import { notFound } from "next/navigation";
import { connection } from "next/server";
import { loadBoard } from "@/lib/board";
import { Board } from "@/components/live/Board";

export default async function BoardPage({ params }: PageProps<"/cartelera/[slug]">) {
  await connection();
  const { slug } = await params;
  const data = await loadBoard(slug);
  if (!data) notFound();
  return <Board slug={slug} initial={data} />;
}
