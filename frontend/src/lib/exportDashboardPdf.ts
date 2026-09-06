import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";

const PDF_EXPORT_CLASS = "pdf-export-mode";
const EXPORT_PREP_DELAY_MS = 900;
/** Source width for off-screen capture; wider gives sharper chart lines in A4 layout. */
const PDF_CAPTURE_WIDTH_PX = 1200;
/**
 * 1.5x ≈ 220 DPI on A4 — noticeably sharper charts without the 100MB+ blow-ups
 * seen at 2x/full-page PNG capture. Raise to 2 only for print-first exports.
 */
const PDF_CAPTURE_PIXEL_RATIO = 1.5;
/** Slightly above default 0.82; pairs with pixel ratio for clean lines without huge files. */
const PDF_JPEG_QUALITY = 0.88;
const PDF_BLOCK_GAP_MM = 2;
const SECTION_TITLE_HEIGHT_MM = 7;
/** Treat near-white pixels as empty when trimming capture padding. */
const PDF_TRIM_COLOR_THRESHOLD = 250;
const PDF_TRIM_ALPHA_THRESHOLD = 12;
const PDF_TRIM_PADDING_PX = 8;

interface PdfCanvasSlice {
  canvas: HTMLCanvasElement;
  widthMm: number;
  heightMm: number;
}

function isBackgroundPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < PDF_TRIM_ALPHA_THRESHOLD) {
    return true;
  }

  return (
    r >= PDF_TRIM_COLOR_THRESHOLD &&
    g >= PDF_TRIM_COLOR_THRESHOLD &&
    b >= PDF_TRIM_COLOR_THRESHOLD
  );
}

/** Remove trailing/leading blank margins from html-to-image captures. */
function cropCanvasToContent(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return canvas;
  }

  const { width, height } = canvas;
  if (width === 0 || height === 0) {
    return canvas;
  }

  const isEmptyRow = (y: number): boolean => {
    const row = context.getImageData(0, y, width, 1).data;
    for (let index = 0; index < row.length; index += 4) {
      if (
        !isBackgroundPixel(row[index], row[index + 1], row[index + 2], row[index + 3])
      ) {
        return false;
      }
    }
    return true;
  };

  let minY = 0;
  while (minY < height && isEmptyRow(minY)) {
    minY += 1;
  }

  let maxY = height - 1;
  while (maxY > minY && isEmptyRow(maxY)) {
    maxY -= 1;
  }

  if (maxY <= minY) {
    return canvas;
  }

  const padding = Math.ceil(PDF_TRIM_PADDING_PX * PDF_CAPTURE_PIXEL_RATIO);
  minY = Math.max(0, minY - padding);
  maxY = Math.min(height - 1, maxY + padding);

  const cropHeight = maxY - minY + 1;
  if (cropHeight >= height) {
    return canvas;
  }

  const cropped = document.createElement("canvas");
  cropped.width = width;
  cropped.height = cropHeight;

  const cropContext = cropped.getContext("2d");
  if (!cropContext) {
    return canvas;
  }

  cropContext.drawImage(canvas, 0, minY, width, cropHeight, 0, 0, width, cropHeight);
  return cropped;
}

function isCanvasMostlyEmpty(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return false;
  }

  const { width, height } = canvas;
  if (width === 0 || height === 0) {
    return true;
  }

  const stepY = Math.max(1, Math.floor(height / 24));
  const stepX = Math.max(1, Math.floor(width / 24));
  let contentPixels = 0;
  let sampledPixels = 0;

  for (let y = 0; y < height; y += stepY) {
    const row = context.getImageData(0, y, width, 1).data;
    for (let x = 0; x < width; x += stepX) {
      sampledPixels += 1;
      const index = x * 4;
      if (!isBackgroundPixel(row[index], row[index + 1], row[index + 2], row[index + 3])) {
        contentPixels += 1;
      }
    }
  }

  return sampledPixels > 0 && contentPixels / sampledPixels < 0.02;
}

function getSectionTitle(block: HTMLElement): string | undefined {
  const title = block.dataset.pdfSectionTitle?.trim();
  return title || undefined;
}

function drawSectionTitle(
  pdf: jsPDF,
  title: string,
  margin: number,
  cursorY: number,
): number {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(24, 24, 27);
  pdf.text(title, margin, cursorY + 4.5);
  return cursorY + SECTION_TITLE_HEIGHT_MM;
}

export function sanitizePdfFilename(name: string): string {
  const trimmed = name.trim() || "dashboard";
  return trimmed
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function shouldIncludePdfNode(node: Node): boolean {
  if (!(node instanceof Element)) {
    return true;
  }

  return !node.hasAttribute("data-pdf-exclude");
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality = PDF_JPEG_QUALITY): string {
  return canvas.toDataURL("image/jpeg", quality);
}

async function captureBlock(element: HTMLElement): Promise<HTMLCanvasElement> {
  const previousStyles = {
    height: element.style.height,
    minHeight: element.style.minHeight,
    overflow: element.style.overflow,
  };

  element.style.height = "auto";
  element.style.minHeight = "0";
  element.style.overflow = "visible";

  try {
    const captured = await toCanvas(element, {
      pixelRatio: PDF_CAPTURE_PIXEL_RATIO,
      backgroundColor: "#ffffff",
      cacheBust: true,
      filter: shouldIncludePdfNode,
    });

    return cropCanvasToContent(captured);
  } finally {
    element.style.height = previousStyles.height;
    element.style.minHeight = previousStyles.minHeight;
    element.style.overflow = previousStyles.overflow;
  }
}

function sliceCanvasVertically(
  canvas: HTMLCanvasElement,
  sliceHeightPx: number,
): HTMLCanvasElement[] {
  if (sliceHeightPx <= 0 || canvas.height <= sliceHeightPx) {
    return [canvas];
  }

  const slices: HTMLCanvasElement[] = [];

  for (let y = 0; y < canvas.height; y += sliceHeightPx) {
    const height = Math.min(sliceHeightPx, canvas.height - y);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = height;

    const context = slice.getContext("2d");
    if (!context) {
      throw new Error("Could not slice PDF capture canvas.");
    }

    context.drawImage(canvas, 0, y, canvas.width, height, 0, 0, canvas.width, height);
    slices.push(slice);
  }

  return slices;
}

function canvasHeightToMm(canvasHeightPx: number, canvasWidthPx: number, widthMm: number): number {
  return (canvasHeightPx * widthMm) / canvasWidthPx;
}

/** Split tall captures across pages at full width — never squash to fit one page. */
function buildPdfCanvasSlices(
  canvas: HTMLCanvasElement,
  contentWidthMm: number,
  maxSliceHeightMm: number,
): PdfCanvasSlice[] {
  const sliceHeightPx = Math.max(
    1,
    Math.floor((maxSliceHeightMm * canvas.width) / contentWidthMm),
  );

  return sliceCanvasVertically(canvas, sliceHeightPx)
    .map((slice) => ({
      canvas: slice,
      widthMm: contentWidthMm,
      heightMm: canvasHeightToMm(slice.height, canvas.width, contentWidthMm),
    }))
    .filter((slice) => !isCanvasMostlyEmpty(slice.canvas));
}

function collectPdfBlocks(root: HTMLElement): HTMLElement[] {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-block]"));
  return blocks.length > 0 ? blocks : [root];
}

function applyOffScreenCaptureStyles(element: HTMLElement): () => void {
  const previous = {
    position: element.style.position,
    left: element.style.left,
    top: element.style.top,
    width: element.style.width,
    visibility: element.style.visibility,
    pointerEvents: element.style.pointerEvents,
  };

  element.style.position = "fixed";
  element.style.left = "-10000px";
  element.style.top = "0";
  element.style.width = `${PDF_CAPTURE_WIDTH_PX}px`;
  element.style.visibility = "visible";
  element.style.pointerEvents = "none";

  return () => {
    element.style.position = previous.position;
    element.style.left = previous.left;
    element.style.top = previous.top;
    element.style.width = previous.width;
    element.style.visibility = previous.visibility;
    element.style.pointerEvents = previous.pointerEvents;
  };
}

function startNewPage(
  pdf: jsPDF,
  margin: number,
): number {
  pdf.addPage();
  return margin;
}

export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const restoreCaptureStyles = applyOffScreenCaptureStyles(element);
  element.classList.add(PDF_EXPORT_CLASS);

  try {
    await document.fonts.ready;
    await new Promise((resolve) => window.setTimeout(resolve, EXPORT_PREP_DELAY_MS));

    const blocks = collectPdfBlocks(element);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2;
    const pageBottom = pageHeight - margin;

    let cursorY = margin;
    let sectionTitleOnPage: string | null = null;

    for (const block of blocks) {
      const sectionTitle = getSectionTitle(block);
      const captured = await captureBlock(block);

      if (isCanvasMostlyEmpty(captured)) {
        continue;
      }

      const fullHeightMm = canvasHeightToMm(captured.height, captured.width, contentWidth);
      const needsPagination = fullHeightMm > contentHeight;
      const slices = needsPagination
        ? buildPdfCanvasSlices(captured, contentWidth, contentHeight)
        : [
            {
              canvas: captured,
              widthMm: contentWidth,
              heightMm: fullHeightMm,
            },
          ];

      if (slices.length === 0) {
        continue;
      }

      for (let sliceIndex = 0; sliceIndex < slices.length; sliceIndex += 1) {
        const slice = slices[sliceIndex];
        const isFirstSlice = sliceIndex === 0;
        const needsSectionTitle =
          isFirstSlice && sectionTitle != null && sectionTitleOnPage !== sectionTitle;
        const titleSpace = needsSectionTitle ? SECTION_TITLE_HEIGHT_MM + PDF_BLOCK_GAP_MM : 0;

        if (cursorY + titleSpace + slice.heightMm > pageBottom && cursorY > margin) {
          cursorY = startNewPage(pdf, margin);
          sectionTitleOnPage = null;
        }

        if (needsSectionTitle && sectionTitle) {
          cursorY = drawSectionTitle(pdf, sectionTitle, margin, cursorY);
          sectionTitleOnPage = sectionTitle;
        }

        pdf.addImage(
          canvasToJpegDataUrl(slice.canvas),
          "JPEG",
          margin,
          cursorY,
          slice.widthMm,
          slice.heightMm,
        );
        cursorY += slice.heightMm + PDF_BLOCK_GAP_MM;
      }
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    element.classList.remove(PDF_EXPORT_CLASS);
    restoreCaptureStyles();
  }
}
