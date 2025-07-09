#!/usr/bin/env node

import { Effect } from 'effect';
import { convertUrlToEpub } from './converter.js';
import type { ConversionOptions } from './converter.js';

function printUsage() {
  console.log(`
Usage: url-to-epub <URL> <OUTPUT_PATH> [OPTIONS]

Arguments:
  URL          The URL of the article to convert
  OUTPUT_PATH  The path where the EPUB file will be saved

Options:
  --title <title>     Override the article title
  --author <author>   Override the article author
  --language <lang>   Set the language (default: en)
  --debug            Enable debug output
  --help             Show this help message

Examples:
  url-to-epub https://example.com/article.html output.epub
  url-to-epub https://example.com/article.html output.epub --debug
  url-to-epub https://example.com/article.html output.epub --title "My Article" --author "John Doe"
`);
}

function parseArgs(args: string[]): ConversionOptions | null {
  if (args.length < 2) {
    return null;
  }

  const [url, outputPath, ...options] = args;
  
  if (!url || !outputPath) {
    return null;
  }

  const result: ConversionOptions = {
    url,
    outputPath,
    debug: false
  };

  for (let i = 0; i < options.length; i++) {
    const arg = options[i];
    
    switch (arg) {
      case '--title':
        if (i + 1 < options.length) {
          result.title = options[i + 1];
          i++; // Skip next argument
        }
        break;
      case '--author':
        if (i + 1 < options.length) {
          result.author = options[i + 1];
          i++; // Skip next argument
        }
        break;
      case '--language':
        if (i + 1 < options.length) {
          result.language = options[i + 1];
          i++; // Skip next argument
        }
        break;
      case '--debug':
        result.debug = true;
        break;
      case '--help':
        printUsage();
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        return null;
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const options = parseArgs(args);
  
  if (!options) {
    console.error('❌ Invalid arguments');
    printUsage();
    process.exit(1);
  }

  const program = convertUrlToEpub(options);
  
  try {
    await Effect.runPromise(program);
    console.log('🎉 Conversion completed successfully!');
  } catch (error) {
    console.error('❌ Conversion failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});