import { writeFile } from 'node:fs/promises';
import { fetchAndExtractArticle } from 'article-fetcher';
import type { ArticleContent } from 'article-fetcher';
import { convertToEpub } from 'epub-converter';
import type { EpubOptions } from 'epub-converter';

export interface ConversionOptions {
  url: string;
  outputPath: string;
  title?: string;
  author?: string;
  language?: string;
  debug?: boolean;
}

export const convertUrlToEpub = async (options: ConversionOptions): Promise<void> => {
  try {
    if (options.debug) {
      console.log(`🔄 Starting conversion for URL: ${options.url}`);
    }

    if (options.debug) {
      console.log('📄 Fetching article content...');
    }

    const article: ArticleContent = await fetchAndExtractArticle(options.url);

    if (options.debug) {
      console.log('✅ Article fetched successfully:');
      console.log(`   Title: ${article.title}`);
      console.log(`   Author: ${article.author || 'Unknown'}`);
      console.log(`   Content length: ${article.content.length} characters`);
    }

    if (options.debug) {
      console.log('📚 Converting to EPUB format...');
    }

    const epubOptions: EpubOptions = {
      title: options.title || article.title,
      author: options.author || article.author,
      language: options.language || 'en',
      date: article.publishedDate,
      identifier: `url-to-epub-${Date.now()}`,
    };

    const epubBuffer = await convertToEpub(article.content, epubOptions);

    if (options.debug) {
      console.log(`✅ EPUB generated successfully (${epubBuffer.length} bytes)`);
    }

    if (options.debug) {
      console.log(`💾 Writing EPUB to file: ${options.outputPath}`);
    }

    await writeFile(options.outputPath, epubBuffer);

    if (options.debug) {
      console.log(`✅ EPUB file saved successfully: ${options.outputPath}`);
    }
  } catch (error) {
    throw new Error(`Conversion failed: ${error}`);
  }
};