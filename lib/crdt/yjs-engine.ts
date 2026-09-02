import * as Y from 'yjs';

export interface YjsDocSession {
  docId: string;
  doc: Y.Doc;
  ytext: Y.Text;
  lastModified: number;
}

// In-memory document session cache
const activeYDocs = new Map<string, YjsDocSession>();

/**
 * Get or create an active Y.Doc instance for a document
 */
export function getOrCreateYDoc(docId: string, initialText = ''): YjsDocSession {
  let session = activeYDocs.get(docId);
  if (!session) {
    const doc = new Y.Doc();
    const ytext = doc.getText('content');
    if (initialText) {
      ytext.insert(0, initialText);
    }
    session = {
      docId,
      doc,
      ytext,
      lastModified: Date.now(),
    };
    activeYDocs.set(docId, session);
  }
  return session;
}

/**
 * Encode current state as base64 string
 */
export function encodeDocStateBase64(doc: Y.Doc): string {
  const update = Y.encodeStateAsUpdate(doc);
  return Buffer.from(update).toString('base64');
}

/**
 * Apply a base64 encoded update to a Y.Doc
 */
export function applyBase64Update(doc: Y.Doc, base64Update: string, origin?: any): void {
  try {
    const update = Buffer.from(base64Update, 'base64');
    Y.applyUpdate(doc, update, origin);
  } catch (err) {
    console.error('Failed to apply Yjs binary update:', err);
  }
}

/**
 * Compute delta between client state vector and current doc
 */
export function computeDeltaUpdate(doc: Y.Doc, clientStateVectorBase64?: string): string {
  if (!clientStateVectorBase64) {
    return encodeDocStateBase64(doc);
  }
  try {
    const clientVector = Buffer.from(clientStateVectorBase64, 'base64');
    const diff = Y.encodeStateAsUpdate(doc, clientVector);
    return Buffer.from(diff).toString('base64');
  } catch {
    return encodeDocStateBase64(doc);
  }
}
