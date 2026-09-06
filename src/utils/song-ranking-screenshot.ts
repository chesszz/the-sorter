import type { WithRank } from '~/types';
import type { Song } from '~/types/songs';
import { getAssetUrl } from '~/utils/assets';
import { getSongName } from '~/utils/names';

const WIDTH = 1280;
const PADDING = 16;
const COLUMN_GAP = 24;
const HEADER_HEIGHT = 44;
const ROW_HEIGHT = 97;
const THUMBNAIL_SIZE = 96;
const FOOTER_HEIGHT = 48;
const PHANTOM_RED = '#cc1515';

type ScreenshotOptions = {
  title?: string;
  description?: string;
  songs: WithRank<Song>[];
  locale: string;
  labels: {
    ranking: string;
    title: string;
    thumbnail: string;
    attribution: string;
    timestamp: string;
  };
  colors: {
    background: string;
    text: string;
  };
};

const loadImage = (src: string): Promise<HTMLImageElement | undefined> =>
  new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => resolve(undefined), { once: true });
    image.src = src;
  });

const drawCoverImage = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  size: number
) => {
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = (image.naturalWidth - sourceSize) / 2;
  const sourceY = (image.naturalHeight - sourceSize) / 2;
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, x, y, size, size);
};

const fitText = (context: CanvasRenderingContext2D, value: string, maxWidth: number) => {
  if (context.measureText(value).width <= maxWidth) return value;
  let result = value;
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
};

const wrapText = (context: CanvasRenderingContext2D, value: string, maxWidth: number) => {
  const lines: string[] = [];
  for (const paragraph of value.split('\n')) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const character of paragraph) {
      const candidate = line + character;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
};

export async function renderSongRankingScreenshot(options: ScreenshotOptions): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas rendering is unavailable');

  const columns = [
    options.songs.slice(0, Math.ceil(options.songs.length / 2)),
    options.songs.slice(Math.ceil(options.songs.length / 2))
  ].filter((column) => column.length > 0);
  const columnWidth = (WIDTH - PADDING * 2 - COLUMN_GAP * (columns.length - 1)) / columns.length;

  context.font = '16px sans-serif';
  const descriptionLines = options.description
    ? wrapText(context, options.description, WIDTH - PADDING * 2)
    : [];
  const titleHeight = options.title ? 36 : 0;
  const descriptionHeight = descriptionLines.length * 24;
  const textGap = options.title && descriptionLines.length ? 8 : 0;
  const tableGap = titleHeight || descriptionHeight ? 8 : 0;
  const tableTop = PADDING + titleHeight + textGap + descriptionHeight + tableGap;
  const rowCount = Math.max(0, ...columns.map((column) => column.length));
  const contentHeight = tableTop + HEADER_HEIGHT + rowCount * ROW_HEIGHT + PADDING;
  canvas.width = WIDTH;
  canvas.height = contentHeight + FOOTER_HEIGHT;

  context.fillStyle = options.colors.background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (options.title) {
    context.fillStyle = options.colors.text;
    context.font = 'bold 28px sans-serif';
    context.textBaseline = 'top';
    context.fillText(options.title, PADDING, PADDING);
  }

  if (descriptionLines.length) {
    context.fillStyle = options.colors.text;
    context.font = '16px sans-serif';
    descriptionLines.forEach((line, index) => {
      context.fillText(line, PADDING, PADDING + titleHeight + textGap + index * 24);
    });
  }

  const imageEntries = await Promise.all(
    options.songs.map(
      async (song) =>
        [
          song.id,
          song.thumbnail ? await loadImage(getAssetUrl(song.thumbnail)) : undefined
        ] as const
    )
  );
  const images = new Map(imageEntries);

  columns.forEach((column, columnIndex) => {
    const x = PADDING + columnIndex * (columnWidth + COLUMN_GAP);
    const rankWidth = 162;
    const thumbnailWidth = 152;
    const titleWidth = columnWidth - rankWidth - thumbnailWidth;

    context.fillStyle = '#68656f';
    context.font = '14px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const headerY = tableTop + HEADER_HEIGHT / 2;
    context.fillText(options.labels.ranking, x + rankWidth / 2, headerY);
    context.fillText(options.labels.title, x + rankWidth + titleWidth / 2, headerY);
    context.fillText(
      options.labels.thumbnail,
      x + rankWidth + titleWidth + thumbnailWidth / 2,
      headerY
    );

    context.strokeStyle = PHANTOM_RED;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, tableTop + HEADER_HEIGHT - 0.5);
    context.lineTo(x + columnWidth, tableTop + HEADER_HEIGHT - 0.5);
    context.stroke();

    column.forEach((song, rowIndex) => {
      const rowY = tableTop + HEADER_HEIGHT + rowIndex * ROW_HEIGHT;
      context.fillStyle = PHANTOM_RED;
      context.fillRect(x, rowY, 8, ROW_HEIGHT);
      context.strokeStyle = PHANTOM_RED;
      context.beginPath();
      context.moveTo(x, rowY + ROW_HEIGHT - 0.5);
      context.lineTo(x + columnWidth, rowY + ROW_HEIGHT - 0.5);
      context.stroke();

      context.fillStyle = options.colors.text;
      context.font = '14px sans-serif';
      context.textAlign = 'left';
      context.fillText(`${song.rank}`, x + 20, rowY + ROW_HEIGHT / 2);

      context.fillStyle = PHANTOM_RED;
      context.font = 'bold 17px sans-serif';
      const songName = getSongName(song.name, song.englishName, options.locale);
      context.fillText(
        fitText(context, songName, titleWidth - 40),
        x + rankWidth + 20,
        rowY + ROW_HEIGHT / 2
      );

      const image = images.get(song.id);
      if (image) {
        const imageX = x + columnWidth - thumbnailWidth + (thumbnailWidth - THUMBNAIL_SIZE) / 2;
        drawCoverImage(context, image, imageX, rowY, THUMBNAIL_SIZE);
      }
    });
  });

  const footerY = contentHeight + FOOTER_HEIGHT / 2;
  context.fillStyle = options.colors.text;
  context.font = '14px sans-serif';
  context.textBaseline = 'middle';
  context.textAlign = 'left';
  context.fillText(options.labels.attribution, PADDING, footerY);
  context.textAlign = 'right';
  context.fillText(options.labels.timestamp, WIDTH - PADDING, footerY);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode screenshot'));
    }, 'image/png');
  });
}
