import { Effect, pipe } from 'effect';
import { writeFile } from 'node:fs/promises';
import { fetchAndExtractArticle } from 'article-fetcher';
import { convertToEpub } from 'epub-converter';
import type { ArticleContent } from 'article-fetcher';
import type { EpubOptions } from 'epub-converter';

export interface ConversionOptions {
  url: string;
  outputPath: string;
  title?: string;
  author?: string;
  language?: string;
  debug?: boolean;
}

export const convertUrlToEpub = (options: ConversionOptions): Effect.Effect<void, Error> =>
  pipe(
    Effect.sync(() => {
      if (options.debug) {
        console.log(`🔄 Starting conversion for URL: ${options.url}`);
      }
    }),
    Effect.flatMap(() => 
      pipe(
        Effect.sync(() => {
          if (options.debug) {
            console.log('📄 Fetching article content...');
          }
        }),
        Effect.flatMap(() => 
          Effect.tryPromise({
            try: () => fetchAndExtractArticle(options.url),
            catch: (error) => new Error(`Failed to fetch article: ${error}`)
          })
        ),
        Effect.tap((article) => 
          Effect.sync(() => {
            if (options.debug) {
              console.log('✅ Article fetched successfully:');
              console.log(`   Title: ${article.title}`);
              console.log(`   Author: ${article.author || 'Unknown'}`);
              console.log(`   Content length: ${article.content.length} characters`);
            }
          })
        )
      )
    ),
    Effect.flatMap((article: ArticleContent) => 
      pipe(
        Effect.sync(() => {
          if (options.debug) {
            console.log('📚 Converting to EPUB format...');
          }
        }),
        Effect.flatMap(() => {
          const epubOptions: EpubOptions = {
            title: options.title || article.title,
            author: options.author || article.author,
            language: options.language || 'en',
            date: article.publishedDate,
            identifier: `url-to-epub-${Date.now()}`
          };
          
          return convertToEpub(article.content, epubOptions);
        }),
        Effect.tap((epubBuffer) => 
          Effect.sync(() => {
            if (options.debug) {
              console.log(`✅ EPUB generated successfully (${epubBuffer.length} bytes)`);
            }
          })
        )
      )
    ),
    Effect.flatMap((epubBuffer: Uint8Array) => 
      pipe(
        Effect.sync(() => {
          if (options.debug) {
            console.log(`💾 Writing EPUB to file: ${options.outputPath}`);
          }
        }),
        Effect.flatMap(() => 
          Effect.tryPromise({
            try: () => writeFile(options.outputPath, epubBuffer),
            catch: (error) => new Error(`Failed to write EPUB file: ${error}`)
          })
        ),
        Effect.tap(() => 
          Effect.sync(() => {
            if (options.debug) {
              console.log(`✅ EPUB file saved successfully: ${options.outputPath}`);
            }
          })
        )
      )
    )
  );