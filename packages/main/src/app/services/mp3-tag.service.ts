// packages/main/src/app/services/mp3-tag.service.ts
import { Injectable, Logger } from '@nestjs/common';
// NOTE: Cannot import 'Tags' type as @types/node-id3 does not exist
import NodeID3 from 'node-id3'; // Import the library

// Define a basic interface for structure, acknowledging values are mostly 'any'
interface BasicNodeID3Tags {
    [key: string]: any;
    userDefinedText?: { description: string; value: string }[];
    // Update comment type to match expected signature
    comment?: { language: string; text: string };
  }

@Injectable()
export class Mp3TagService {
  private readonly logger = new Logger(Mp3TagService.name);

  async readTags(filePath: string, tagsToRead: string[]): Promise<Record<string, any>> {
    this.logger.debug(`Reading tags [${tagsToRead.join(', ')}] from: ${filePath}`);
    try {
      const allTags: any | boolean = NodeID3.read(filePath); // Use any due to lack of types

      if (typeof allTags !== 'object' || !allTags) {
        this.logger.debug(`No tags object found or failed to read tags for: ${filePath}`);
        return {};
      }

      const requestedTags: Record<string, any> = {};

      // Mapping from standard Frame IDs to common node-id3 aliases
      const aliasMap: Record<string, string> = {
        TPE1: 'artist',
        TIT2: 'title',
        TALB: 'album',
        TYER: 'year',
        TCON: 'genre',
        TRCK: 'trackNumber',
        TPOS: 'partOfSet',
        TCOM: 'composer',
        TPE2: 'performerInfo', // Often Album Artist
        TLEN: 'length',
        TBPM: 'bpm',
        TKEY: 'initialKey',
        // Add others as needed based on node-id3's output
      };

      for (const tagIdentifier of tagsToRead) {
        let foundValue: any = undefined; // Variable to hold the found tag value

        if (tagIdentifier.startsWith('TXXX:')) {
          // --- Handle TXXX ---
          const description = tagIdentifier.substring(5);
          const txxxArray = allTags.userDefinedText;
          if (Array.isArray(txxxArray)) {
            // Case-insensitive description match is safer
            const found = txxxArray.find((f: any) => f.description?.toLowerCase() === description.toLowerCase());
            if (found) {
              foundValue = found.value;
            }
          }
        } else if (tagIdentifier === 'COMM') {
          // --- Handle COMM ---
          if (allTags.comment) {
            // Prioritize the 'text' field if the comment is an object
            foundValue = typeof allTags.comment === 'object' && allTags.comment.text !== undefined
                         ? allTags.comment.text
                         : allTags.comment;
          }
        } else {
          // --- Handle Standard Tags ---
          // 1. Check the 'raw' object first using the exact ID3 Frame ID
          if (allTags.raw && Object.prototype.hasOwnProperty.call(allTags.raw, tagIdentifier)) {
            foundValue = allTags.raw[tagIdentifier];
          }
          // 2. If not in raw, check the top level using the known alias
          else {
            const alias = aliasMap[tagIdentifier];
            if (alias && Object.prototype.hasOwnProperty.call(allTags, alias)) {
              foundValue = allTags[alias];
            }
            // 3. As a last resort, check the top level using the direct Frame ID (less likely)
            else if (Object.prototype.hasOwnProperty.call(allTags, tagIdentifier)) {
              foundValue = allTags[tagIdentifier];
            }
          }
        }

        // Only add the tag to the result if we actually found a value
        if (foundValue !== undefined) {
          requestedTags[tagIdentifier] = foundValue;
        }
      }

      this.logger.debug(`Found tags for ${filePath}: ${JSON.stringify(requestedTags)}`);
      return requestedTags;

    } catch (error) {
       if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
           this.logger.debug(`File not found for tag reading: ${filePath}`);
       } else {
           this.logger.error(`Error reading tags from ${filePath}`, error instanceof Error ? error.stack : error);
       }
       return {}; // Return empty object on error
    }
  }

  async writeTags(filePath: string, tagsToWrite: Record<string, any>): Promise<boolean> {
    this.logger.debug(`Writing tags to: ${filePath}`, tagsToWrite);

    // --- Build the tag object correctly for NodeID3.update ---
    // Initialize with potential complex tag structures that node-id3 expects
    const tagsForNodeID3: BasicNodeID3Tags = {
        userDefinedText: [] // Initialize TXXX array
    };

    for (const key in tagsToWrite) {
      // Ensure we only process own properties
      if (Object.prototype.hasOwnProperty.call(tagsToWrite, key)) {
        if (key.startsWith('TXXX:')) {
          // Format TXXX tags correctly for node-id3
          const description = key.substring(5);
          const value = tagsToWrite[key];
          // Ensure array exists before pushing
          if (!Array.isArray(tagsForNodeID3.userDefinedText)) {
             tagsForNodeID3.userDefinedText = [];
          }
          tagsForNodeID3.userDefinedText.push({ description, value: String(value) }); // Ensure value is string
        } else if (key === 'COMM') {
            let commentText: string | undefined;
            // Default language to 'eng', ensure it's always a string
            let commentLang: string = 'eng';
        
            if (typeof tagsToWrite[key] === 'string') {
                // Input is just the comment text
                commentText = tagsToWrite[key];
            } else if (typeof tagsToWrite[key] === 'object' && tagsToWrite[key] !== null && 'text' in tagsToWrite[key]) {
                // Input is a comment object
                commentText = tagsToWrite[key].text;
                // Use provided language only if it's a non-empty string, otherwise keep default 'eng'
                commentLang = (typeof tagsToWrite[key].language === 'string' && tagsToWrite[key].language)
                              ? tagsToWrite[key].language
                              : 'eng';
            }
        
            // Only create the comment object if we actually have text
            if (commentText !== undefined) {
                // Ensure the created object matches the expected { language: string; text: string; }
                tagsForNodeID3.comment = { language: commentLang, text: commentText };
            }
        } else {
            // Assign standard tags directly
            tagsForNodeID3[key] = tagsToWrite[key];
        }
      }
    }

    // Remove empty TXXX array if nothing was actually added to avoid writing empty frame
    if (tagsForNodeID3.userDefinedText?.length === 0) {
      delete tagsForNodeID3.userDefinedText;
    }
    // ---------------------------------------------------------

    try {
      // CRITICAL ASSUMPTION: NodeID3.update preserves other tags/versions. MUST VERIFY VIA TESTING.
      const result: boolean | Error = NodeID3.update(tagsForNodeID3, filePath);

      if (result instanceof Error) {
        // If node-id3 returns an Error object on failure
        throw result;
      }

      if (result === true) {
        this.logger.log(`Successfully wrote tags to: ${filePath}`);
        return true;
      } else {
        // If node-id3 returns false or anything else on failure
        this.logger.warn(`NodeID3.update did not return true for: ${filePath}. Result: ${result}`);
        return false;
      }
    } catch (error) {
       // Handle thrown errors (including filesystem errors)
       if (error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'EPERM' || error.code === 'EACCES')) {
           this.logger.warn(`File system error writing tags to ${filePath}: ${error.code}`);
       } else {
           this.logger.error(`Error writing tags to ${filePath}`, error instanceof Error ? error.stack : error);
       }
       return false; // Return false on any error
    }
  }
}