import { useMemo } from 'react';
import { DiffView, DiffModeEnum } from '@git-diff-view/react';
import { generateDiffFile } from '@git-diff-view/file';
import '@/styles/diff-style-overrides.css';
import '@/styles/edit-diff-overrides.css';

type Props = {
  content: string;
  lang: string | null;
  theme?: 'light' | 'dark';
};

/**
 * View syntax highlighted file content.
 */
function FileContentView({ content, lang, theme }: Props) {
  // Uses the syntax highlighter from @git-diff-view/react without any diff-related features.
  // This allows uniform styling with EditDiffRenderer.
  const diffFile = useMemo(() => {
    // comprobación de tamaño para evitar fallos de parseo con archivos grandes
    const MAX_FILE_SIZE_CHARS = 1_000_000; // ~1MB de texto
    if (content.length > MAX_FILE_SIZE_CHARS) {
      console.warn(`File too large for syntax highlighting: ${content.length} chars`);
      return null;
    }

    try {
      const instance = generateDiffFile(
        '', // old file
        '', // old content (empty)
        '', // new file
        content, // new content
        '', // old lang
        lang || 'plaintext' // new lang
      );
      instance.initRaw();
      return instance;
    } catch (e) {
      console.error('Failed to generate syntax highlighted view:', e);
      return null;
    }
  }, [content, lang]);

  return diffFile ? (
    <div className="border mt-2">
      <DiffView
        diffFile={diffFile}
        diffViewWrap={false}
        diffViewTheme={theme}
        diffViewHighlight
        diffViewMode={DiffModeEnum.Unified}
        diffViewFontSize={12}
      />
    </div>
  ) : (
    <pre className="text-xs font-mono overflow-x-auto whitespace-pre">
      {content}
    </pre>
  );
}

export default FileContentView;
