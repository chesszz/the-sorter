// Draw outside the HTML capture so browser SVG layout cannot clip the footer.
export async function addScreenshotFooter(
  image: HTMLCanvasElement,
  footer: { attribution: string; timestamp: string; background: string; color: string }
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height + 48;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas rendering is unavailable');

  context.fillStyle = footer.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  context.fillStyle = footer.color;
  context.font = '14px sans-serif';
  context.textBaseline = 'middle';
  const y = image.height + 24;
  context.textAlign = 'left';
  context.fillText(footer.attribution, 16, y);
  context.textAlign = 'right';
  context.fillText(footer.timestamp, canvas.width - 16, y);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode screenshot'));
    }, 'image/png');
  });
}
