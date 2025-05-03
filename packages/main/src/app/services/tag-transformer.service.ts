// packages/main/src/app/services/tag-transformer.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

@Injectable()
export class TagTransformerService {
  // frames that may come back as arrays
  private readonly multiValueFrames = ['TCON', 'TCMP', 'TCOM'];

  // extra user-defined fields we build comments from
  private readonly extraTxxxFrames = [
    'TXXX:energylevel',
    'TXXX:keinelyrics',
    'TXXX:kaufmonat',
    'TXXX:kaufgrund',
    'TXXX:kaufort',
    'TXXX:livegesehen',
  ];

  /**  
   * All the tag keys we want to ask NodeID3 to read in one go  
   * (multi-value, genre, comment, userDefinedText, plus any
   * bidirectional tags from settings)  
   */
  public readonly allTagKeys: string[];

  constructor(private readonly config: ConfigService) {
    this.allTagKeys = [
      // arrays → comma-strings
      ...this.multiValueFrames,
      // always-single
      'TCON',
      'COMM',
      // comment-builders
      ...this.extraTxxxFrames,
      // finally any bidirectional frames the user configured
      ...this.config.getBidirectionalTags(),
    ];
  }

  /** Flatten any array-valued frames into comma-separated strings */
  private flattenMultiValues(tags: Record<string, any>) {
    for (const f of this.multiValueFrames) {
      const v = tags[f];
      if (Array.isArray(v)) tags[f] = v.join(', ');
    }
  }

  /** Strip anything before “‖” and remove “1980s”-style decades */
  private cleanGenre(raw: string): string {
    const after = raw.replace(/((?:^|;)\s*)[^;]+?\s*‖\s*/g, '$1');
    return after
      .replace(/\b\d{4}s\b/g, '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .join(', ');
  }

  /** Build a multi-line COMMENT from several source fields */
  private buildComment(tags: Record<string, any>): string {
    const parts: string[] = [];

    if (tags['TXXX:energylevel']) {
      parts.push(`[ e${tags['TXXX:energylevel']} ]`);
    }

    const genre = (tags.TCON as string || '').toLowerCase();
    const lyrics = (tags['TXXX:keinelyrics'] as string || '').toLowerCase();
    let typ = 'I';
    if (genre.includes('a cappella'))      typ = 'A';
    else if (lyrics.includes('instrumental')) typ = 'I';
    else if (genre.includes('female vocals')) typ = 'Vfemale';
    else if (genre.includes('male vocals'))   typ = 'Vmale';
    else if (genre.includes('duet'))          typ = 'Vduet';
    else if (genre.includes('mixed vocals'))  typ = 'Vmixed';
    parts.push(`[ typ${typ} ]`);

    for (const [prefix, frame] of [
      ['km', 'TXXX:kaufmonat'],
      ['kg', 'TXXX:kaufgrund'],
      ['ko', 'TXXX:kaufort'],
      ['lg', 'TXXX:livegesehen'],
    ] as const) {
      const v = tags[frame];
      if (v) parts.push(`[ ${prefix}${v} ]`);
    }

    // append any existing comment
    if (tags.COMM) parts.push(tags.COMM);
    return parts.join('\n');
  }

  /** Apply *all* transformations in one call */
  public transformAll(tags: Record<string, any>): Record<string, any> {
    this.flattenMultiValues(tags);
    if (typeof tags.TCON === 'string') {
      tags.TCON = this.cleanGenre(tags.TCON);
    }
    tags.COMM = this.buildComment(tags);
    return tags;
  }

  /** Is this tag one of the user-configured bidirectional frames? */
  public isBidirectional(tag: string): boolean {
    return this.config.getBidirectionalTags().includes(tag);
  }
}
