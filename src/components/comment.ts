import { pathToFileURL } from 'node:url';
import { postStickyComment } from '../comment.js';
import { COMPONENTS_COMMENT_MARKER } from './report.js';

export async function componentComment(configPath?: string): Promise<void> {
  await postStickyComment({ configPath, marker: COMPONENTS_COMMENT_MARKER, reportFile: 'components-report.md' });
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isMain) {
  componentComment().catch((err) => { console.error(err); process.exit(1); });
}
