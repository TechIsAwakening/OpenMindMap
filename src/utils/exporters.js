import domtoimage from 'dom-to-image-more';
import { jsPDF } from 'jspdf';

const DEFAULT_FILENAME = 'openmindmap.pdf';
const DEFAULT_PADDING = 24;

function resolveSvgDimensions(svgElement) {
  if (!svgElement) {
    return { width: 0, height: 0 };
  }

  const viewBox = svgElement.viewBox?.baseVal;
  if (viewBox && viewBox.width && viewBox.height) {
    return { width: viewBox.width, height: viewBox.height };
  }

  const widthAttr = svgElement.getAttribute('width');
  const heightAttr = svgElement.getAttribute('height');
  if (widthAttr && heightAttr) {
    return { width: parseFloat(widthAttr), height: parseFloat(heightAttr) };
  }

  const { width, height } = svgElement.getBoundingClientRect();
  return {
    width: width || svgElement.clientWidth || 1,
    height: height || svgElement.clientHeight || 1,
  };
}

export async function exportMindmapToPdf(svgElement, options = {}) {
  if (!svgElement) {
    throw new Error("Impossible d'exporter : aucune référence vers la carte mentale.");
  }

  const {
    filename = DEFAULT_FILENAME,
    backgroundColor = '#0f172a',
    padding = DEFAULT_PADDING,
    quality = 1,
  } = options;

  const { width, height } = resolveSvgDimensions(svgElement);

  if (!width || !height) {
    throw new Error("Impossible d'exporter : dimensions de la carte introuvables.");
  }

  try {
    const dataUrl = await domtoimage.toPng(svgElement, {
      bgcolor: backgroundColor,
      quality,
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
      },
      width,
      height,
    });

    const pdf = new jsPDF({
      orientation: width > height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [width + padding * 2, height + padding * 2],
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const maxWidth = pageWidth - padding * 2;
    const maxHeight = pageHeight - padding * 2;
    const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
    const renderWidth = width * ratio;
    const renderHeight = height * ratio;
    const offsetX = (pageWidth - renderWidth) / 2;
    const offsetY = (pageHeight - renderHeight) / 2;

    pdf.addImage(dataUrl, 'PNG', offsetX, offsetY, renderWidth, renderHeight, undefined, 'FAST');
    pdf.save(filename);
  } catch (error) {
    if (error?.message?.includes('SecurityError')) {
      throw new Error(
        "L'export a échoué à cause de contenus externes non autorisés (CORS). " +
          'Assurez-vous que toutes les images et polices proviennent de la même origine.'
      );
    }

    throw error;
  }
}
