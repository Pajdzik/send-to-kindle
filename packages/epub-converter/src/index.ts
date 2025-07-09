import { Effect } from "effect";
import JSZip from "jszip";

export interface EpubOptions {
  title: string;
  author?: string;
  language?: string;
  identifier?: string;
  publisher?: string;
  description?: string;
  date?: string;
}

export const convertToEpub = (htmlContent: string, options: EpubOptions): Effect.Effect<Uint8Array, Error> =>
  Effect.tryPromise({
    try: async () => {
      const zip = new JSZip();
      
      // Create mimetype file (must be first and uncompressed)
      zip.file("mimetype", "application/epub+zip");
      
      // Create META-INF directory
      const metaInf = zip.folder("META-INF");
      if (!metaInf) throw new Error("Failed to create META-INF folder");
      
      // Create container.xml
      const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
      metaInf.file("container.xml", containerXml);
      
      // Create OEBPS directory
      const oebps = zip.folder("OEBPS");
      if (!oebps) throw new Error("Failed to create OEBPS folder");
      
      // Create content.opf (package document)
      const contentOpf = createContentOpf(options);
      oebps.file("content.opf", contentOpf);
      
      // Create toc.ncx (navigation control file)
      const tocNcx = createTocNcx(options);
      oebps.file("toc.ncx", tocNcx);
      
      // Create the main HTML file
      const mainHtml = createMainHtml(htmlContent, options);
      oebps.file("chapter.xhtml", mainHtml);
      
      // Create basic CSS
      const css = createBasicCss();
      oebps.file("style.css", css);
      
      // Generate the EPUB file
      const epubBuffer = await zip.generateAsync({
        type: "uint8array",
        compression: "DEFLATE",
        compressionOptions: { level: 9 }
      });
      
      return epubBuffer;
    },
    catch: (error) => new Error(`Failed to create EPUB: ${error}`)
  });

function createContentOpf(options: EpubOptions): string {
  const identifier = options.identifier || `urn:uuid:${generateUUID()}`;
  const language = options.language || "en";
  const author = options.author || "Unknown Author";
  const date = options.date || new Date().toISOString().split('T')[0];
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookID">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookID">${identifier}</dc:identifier>
    <dc:title>${escapeXml(options.title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>${language}</dc:language>
    <dc:date>${date}</dc:date>
    ${options.publisher ? `<dc:publisher>${escapeXml(options.publisher)}</dc:publisher>` : ''}
    ${options.description ? `<dc:description>${escapeXml(options.description)}</dc:description>` : ''}
    <meta property="dcterms:modified">${new Date().toISOString()}</meta>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="chapter"/>
  </spine>
</package>`;
}

function createTocNcx(options: EpubOptions): string {
  const identifier = options.identifier || `urn:uuid:${generateUUID()}`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${identifier}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(options.title)}</text>
  </docTitle>
  <navMap>
    <navPoint id="navpoint-1" playOrder="1">
      <navLabel>
        <text>${escapeXml(options.title)}</text>
      </navLabel>
      <content src="chapter.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`;
}

function createMainHtml(htmlContent: string, options: EpubOptions): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(options.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>${escapeXml(options.title)}</h1>
  ${htmlContent}
</body>
</html>`;
}

function createBasicCss(): string {
  return `body {
  font-family: serif;
  line-height: 1.6;
  margin: 1em;
  color: #000;
}

h1, h2, h3, h4, h5, h6 {
  color: #000;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

h1 {
  font-size: 1.8em;
  border-bottom: 2px solid #000;
  padding-bottom: 0.3em;
}

p {
  margin-bottom: 1em;
  text-align: justify;
}

img {
  max-width: 100%;
  height: auto;
}

blockquote {
  margin: 1em 0;
  padding-left: 1em;
  border-left: 3px solid #ccc;
  font-style: italic;
}

code {
  font-family: monospace;
  background-color: #f5f5f5;
  padding: 0.2em 0.4em;
  border-radius: 3px;
}

pre {
  background-color: #f5f5f5;
  padding: 1em;
  border-radius: 5px;
  overflow-x: auto;
}

pre code {
  background-color: transparent;
  padding: 0;
}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}