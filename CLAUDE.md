# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a Node.js monorepo using TypeScript with workspaces. The main package is `article-fetcher` in `packages/article-fetcher/`.

### article-fetcher Package

The `article-fetcher` package extracts content from web articles. It parses HTML to extract titles, metadata (author, publication date), and main content while filtering out navigation, sidebars, and other unwanted elements.

## Development Commands

- `npm run build` - Build all packages using Turbo
- `npm run dev` - Start development mode with watch for all packages
- `npm run test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Lint code using Biome
- `npm run format` - Format code using Biome
- `npm run format:check` - Check code formatting
- `npm run typecheck` - Type check all packages

## Package-specific Commands

Within each package directory (e.g., `packages/article-fetcher/`):
- `npm run build` - Build the package
- `npm run dev` - Build in watch mode
- `npm run test` - Run package tests
- `npm run test:watch` - Run package tests in watch mode
- `npm run typecheck` - Type check the package

## Tools Configuration

- **TypeScript**: Uses project references with glob pattern for packages
- **Biome**: Configured for formatting and linting with strict rules
- **Vitest**: Testing framework with coverage reporting
- **Turbo**: Build system for monorepo orchestration

## Architecture Notes

- All packages use ESM modules (`"type": "module"`)
- TypeScript configured with strict mode and modern target (ES2022)
- Composite builds enabled for fast incremental compilation
- Test files use `.test.ts` or `.spec.ts` extensions
- Import statements use `.js` extensions for proper ESM resolution