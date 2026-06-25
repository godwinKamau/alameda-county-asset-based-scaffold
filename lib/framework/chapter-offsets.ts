import ch3 from "@/data/framework/ch3.json";
import ch4 from "@/data/framework/ch4.json";
import ch5 from "@/data/framework/ch5.json";
import ch6 from "@/data/framework/ch6.json";
import ch7 from "@/data/framework/ch7.json";

const OFFSET_BY_CHAPTER: Record<number, number | null | undefined> = {
  3: ch3._meta?.pdf_page_offset,
  4: ch4._meta?.pdf_page_offset,
  5: ch5._meta?.pdf_page_offset,
  6: ch6._meta?.pdf_page_offset,
  7: ch7._meta?.pdf_page_offset,
};

export function getChapterPdfPageOffset(chapter: number): number | null {
  const offset = OFFSET_BY_CHAPTER[chapter];
  return typeof offset === "number" ? offset : null;
}
