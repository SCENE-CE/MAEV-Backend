export function isYouTubeVideo(url: string): boolean {
  const youtubeRegex =
    /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|.+\?v=)?([^&\n?#]+)/;
  return youtubeRegex.test(url);
}

export async function isPeerTubeVideo(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch the URL');

    const htmlContent = await response.text();
    return htmlContent.includes(
      '<meta property="og:platform" content="PeerTube">',
    );
  } catch (error) {
    console.error(`Error checking PeerTube meta tag: ${error.message}`);
    return false;
  }
}

export async function getYoutubeThumbnail(id: string): Promise<Buffer> {
  const response = await fetch(`https://img.youtube.com/vi/${id}/default.jpg`);
  if (!response.ok) throw new Error('Failed to fetch YouTube thumbnail');
  return Buffer.from(await response.arrayBuffer());
}

export async function getPeerTubeThumbnail(
  url: string,
  videoId: string,
): Promise<Buffer> {
  const baseDomain = new URL(url).origin;
  const apiURL = `${baseDomain}/api/v1/videos/${videoId}`;
  const response = await fetch(apiURL);

  if (!response.ok) {
    throw new Error('Failed to fetch PeerTube video details');
  }

  const data = await response.json();
  let thumbnailUrl = data.thumbnailPath;
  if (!thumbnailUrl.startsWith('http')) {
    thumbnailUrl = `${baseDomain}${thumbnailUrl}`;
  }

  const thumbnailResponse = await fetch(thumbnailUrl);
  if (!thumbnailResponse.ok) {
    throw new Error('Failed to fetch PeerTube thumbnail');
  }

  const contentType = thumbnailResponse.headers.get('Content-Type');
  if (!contentType?.startsWith('image/')) {
    throw new Error('Fetched data is not a valid image');
  }

  const arrayBuffer = await thumbnailResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getPeerTubeVideoDetails(
  url: string,
  videoId: string,
): Promise<any> {
  const baseDomain = new URL(url).origin;
  const apiURL = `${baseDomain}/api/v1/videos/${videoId}`;
  const response = await fetch(apiURL);

  if (!response.ok) {
    throw new Error('Failed to fetch PeerTube video details');
  }

  const data = await response.json();
  return data;
}

export function getYouTubeVideoID(url: string): string | null {
  const youtubeRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|.+\?v=)|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
}

export function getPeerTubeVideoID(url: string): string | null {
  const peerTubeRegex = /(?:videos\/watch|w)\/([a-zA-Z0-9-]+)/;
  const match = url.match(peerTubeRegex);
  return match ? match[1] : null;
}

export type YoutubeVideoJson = {
  title: string;
  author_name: string;
  author_url: string;
  type: 'video';
  height: number;
  width: number;
  version: string;
  provider_name: string;
  provider_url: string;
  thumbnail_height: number;
  thumbnail_width: number;
  thumbnail_url: string;
  html: string;
};

export async function getYoutubeJson(
  videoUrl: string,
): Promise<YoutubeVideoJson | undefined> {
  try {
    const normalizedUrl = videoUrl.replace(/^https?:\/\//, '');

    const videoResponse = await fetch(
      `https://www.youtube.com/oembed?url=https://${normalizedUrl}&format=json`,
    );
    console.log('videoResponse');
    console.log(videoResponse);
    const toreturn = await videoResponse.json();
    return toreturn;
  } catch (error: any) {
    console.error(`Error getYoutubeJson: ${error.message}`);
  }
}

export async function isImage(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}`, { method: 'GET' });
    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${response.statusText}`,
      );
    }
    return response.headers.get('Content-Type')?.startsWith('image') || false;
  } catch (error) {
    console.error(`Error getting image: ${error.message}`);
    return false;
  }
}

function iso8601DurationToSeconds(isoDuration: string): number {
  // Regular expression to match ISO 8601 duration format
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const matches = isoDuration.match(regex);

  if (!matches) {
    throw new Error('Invalid ISO 8601 duration format');
  }

  // Extract hours, minutes, and seconds
  const hours = matches[1] ? parseInt(matches[1], 10) : 0;
  const minutes = matches[2] ? parseInt(matches[2], 10) : 0;
  const seconds = matches[3] ? parseInt(matches[3], 10) : 0;

  // Convert to total seconds
  return hours * 3600 + minutes * 60 + seconds;
}

export async function getVideoDuration(videoUrl: string): Promise<number> {
  try {
    const response = await fetch(videoUrl);
    const html = await response.text();
    const regex = /itemprop="duration" content="([^"]+)"/;

    const match = regex.exec(html)?.[1];
    if (match) {
      return iso8601DurationToSeconds(match);
    }
    throw new Error('Duration not found in the HTML.');
  } catch (error) {
    throw new Error(`Failed to fetch video duration: ${error.message}`);
  }
}
