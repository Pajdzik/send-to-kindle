import { describe, it, expect } from 'vitest';
import { ArticleFetcher } from './fetcher.js';

describe('Jepsen Serializable Article Test', () => {
  const fetcher = new ArticleFetcher();

  it('should extract content from complete jepsen.io serializable consistency article', () => {
    const html = `
      <html>
        <head>
          <title>Jepsen: Serializable</title>
          <meta name="author" content="Kyle Kingsbury">
          <meta property="article:published_time" content="2016-03-01">
        </head>
        <body>
          <nav>Site navigation</nav>
          <header>Header content</header>
          <article>
            <h1>Serializable</h1>
            
            <p>Serializability means that transactions appear to have occurred in some total order.</p>
            
            <p>Unlike linearizability, serializability allows transactions to appear to have occurred in any order—even one which is inconsistent with the real-time ordering of those transactions.</p>
            
            <p>Serializability is a multi-object property. A transaction can act on multiple objects at once.</p>
            
            <p>Serializability precludes dirty writes, dirty reads, fuzzy reads, and phantom reads.</p>
            
            <p>Unlike linearizability, serializability does not imply any kind of real-time consistency between processes.</p>
            
            <h2>Formal Definitions</h2>
            
            <p>The article references multiple formal specifications for serializability:</p>
            
            <h3>ANSI SQL 1999 Specification</h3>
            <p>Defines serializability as an execution producing the "same effect as some serial execution".</p>
            <p>Prohibits the "Phantom" phenomenon, where reading a set of rows can change between transactions.</p>
            
            <h3>Adya's Formalization</h3>
            <p>Prohibits four key phenomena:</p>
            <ul>
              <li>P0: Dirty Write - A transaction writes to an object previously written by another uncommitted transaction</li>
              <li>P1: Dirty Read - A transaction reads data written by an uncommitted transaction</li>
              <li>P2: Fuzzy Read - A transaction reads an object, then another transaction modifies it, and the first transaction reads it again</li>
              <li>P3: Phantom - A transaction reads a set of objects satisfying a search condition, then another transaction modifies the set</li>
            </ul>
            
            <h3>Cerone, Bernardi, & Gotsman Framework</h3>
            <p>Specifies serializability through three properties:</p>
            <ul>
              <li>Internal consistency - Operations within a transaction appear atomic</li>
              <li>External consistency - Transactions appear to execute in some total order</li>
              <li>Total visibility - All committed transactions are visible to all other transactions</li>
            </ul>
            
            <h2>Key Characteristics</h2>
            
            <p>Serializable systems have several important characteristics:</p>
            <ul>
              <li>Cannot be totally or sticky available during network partitions</li>
              <li>Implies repeatable read and snapshot isolation</li>
              <li>Does not guarantee real-time or per-process constraints</li>
              <li>Allows transactions to potentially not observe their own prior writes</li>
            </ul>
            
            <h2>Interesting Nuances</h2>
            
            <p>The article emphasizes several nuances about serializable systems:</p>
            <ul>
              <li>Serializable systems can potentially return empty states or discard write-only transactions</li>
              <li>The model allows some pathological transaction orderings</li>
              <li>Most implementations do not exploit these potential optimization opportunities</li>
              <li>While serializability provides strong guarantees, it does not impose strict real-time or per-process ordering constraints</li>
            </ul>
            
            <p>Serializability is a fundamental consistency model that ensures transactional atomicity across multi-object operations while allowing flexibility in transaction ordering.</p>
          </article>
          <aside class="sidebar">Related articles</aside>
          <footer>Footer content</footer>
          <script>console.log("analytics");</script>
        </body>
      </html>
    `;

    const result = fetcher.extractContent(html);
    
    // Test basic metadata extraction
    expect(result.title).toBe('Jepsen: Serializable');
    expect(result.author).toBe('Kyle Kingsbury');
    expect(result.publishedDate).toBe('2016-03-01');
    
    // Test core concept extraction
    expect(result.content).toContain('Serializability means that transactions appear to have occurred in some total order');
    expect(result.content).toContain('multi-object property');
    expect(result.content).toContain('precludes dirty writes, dirty reads, fuzzy reads, and phantom reads');
    expect(result.content).toContain('Unlike linearizability');
    
    // Test formal definitions section
    expect(result.content).toContain('ANSI SQL 1999 Specification');
    expect(result.content).toContain('Adya\'s Formalization');
    expect(result.content).toContain('Cerone, Bernardi, & Gotsman Framework');
    
    // Test technical details
    expect(result.content).toContain('P0: Dirty Write');
    expect(result.content).toContain('P1: Dirty Read');
    expect(result.content).toContain('P2: Fuzzy Read');
    expect(result.content).toContain('P3: Phantom');
    
    // Test characteristics
    expect(result.content).toContain('Internal consistency');
    expect(result.content).toContain('External consistency');
    expect(result.content).toContain('Total visibility');
    
    // Test nuances
    expect(result.content).toContain('pathological transaction orderings');
    expect(result.content).toContain('network partitions');
    expect(result.content).toContain('repeatable read and snapshot isolation');
    
    // Verify unwanted content is removed
    expect(result.content).not.toContain('Site navigation');
    expect(result.content).not.toContain('Header content');
    expect(result.content).not.toContain('Related articles');
    expect(result.content).not.toContain('Footer content');
    expect(result.content).not.toContain('console.log');
    expect(result.content).not.toContain('analytics');
  });
});